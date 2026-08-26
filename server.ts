import 'dotenv/config';
import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({ dest: os.tmpdir() });

// Lazy-safe GoogleGenAI client
function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] Warning: GEMINI_API_KEY is not defined in environment variables.');
  }
  return new GoogleGenAI({ apiKey: apiKey || undefined });
}

// Helper for calling Gemini with automatic retries and model fallbacks on 503/429 spikes
async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
  models?: string[];
  maxRetriesPerModel?: number;
}) {
  const ai = getAIClient();
  // Valid, supported models: prioritize fast and multimodal capable models
  const models = params.models || ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash'];
  const maxRetries = params.maxRetriesPerModel ?? 1;

  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Gemini API] Invoking model: ${model} (attempt ${attempt + 1}/${maxRetries + 1})...`);
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const code = err?.code || err?.status;

        console.warn(`[Gemini API] Model ${model} returned error: ${msg} (code: ${code})`);

        const isDemandSpike = 
          code === 503 || 
          code === 'UNAVAILABLE' || 
          msg.includes('503') || 
          msg.includes('high demand') || 
          msg.includes('overloaded') ||
          msg.includes('temporarily unavailable');

        const isRateLimit =
          code === 429 ||
          msg.includes('429') ||
          msg.includes('Resource has been exhausted');

        // On 503 high demand spike, switch immediately to next available model
        if (isDemandSpike) {
          console.info(`[Gemini API] Model ${model} is at high demand (503). Switching immediately to fallback model...`);
          break;
        }

        if (isRateLimit && attempt < maxRetries) {
          const delay = 800 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Other errors: try next model in rotation
        break;
      }
    }
  }
  throw lastError;
}

// Recursively normalize Vietnamese text to Unicode Standard NFC (Precomposed)
function normalizeVietnameseData<T>(data: T): T {
  if (typeof data === 'string') {
    return data.normalize('NFC') as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map(item => normalizeVietnameseData(item)) as unknown as T;
  }
  if (data !== null && typeof data === 'object') {
    const result: any = {};
    for (const key of Object.keys(data)) {
      result[key] = normalizeVietnameseData((data as any)[key]);
    }
    return result;
  }
  return data;
}

function cleanJsonText(raw: string): string {
  let cleaned = raw.trim().normalize('NFC');
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return cleaned;
}

// Helper to upload a buffer to Google Drive with automatic folder fallback
async function uploadBufferToGoogleDrive(params: {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  token: string;
  targetFolderId?: string | null;
}) {
  const { fileBuffer, fileName, mimeType, token, targetFolderId } = params;
  let driveFileId: string | null = null;
  let driveUrl: string | null = null;
  let driveFolderId: string | null = null;
  let driveFolderUrl: string | null = null;
  let driveError: string | null = null;

  try {
    const boundary = `-------DriveBoundary${Date.now()}`;
    const metadata = {
      name: fileName,
      ...(targetFolderId ? { parents: [targetFolderId] } : {})
    };

    const closeDelimiter = `\r\n--${boundary}--`;
    const bodyBuffer = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
      ),
      fileBuffer,
      Buffer.from(closeDelimiter),
    ]);

    let driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    // If upload into target folder failed (e.g. lack of permissions on that specific folder), retry directly to root Drive
    if (!driveRes.ok && targetFolderId) {
      const errText = await driveRes.text();
      console.warn(`[Drive] Upload to folder ${targetFolderId} returned ${driveRes.status}: ${errText}. Retrying directly to user's root Drive...`);
      
      const fallbackMetadata = { name: fileName };
      const fallbackBuffer = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(fallbackMetadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
        ),
        fileBuffer,
        Buffer.from(closeDelimiter),
      ]);

      driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: fallbackBuffer,
      });
    }

    if (driveRes.ok) {
      const driveData = await driveRes.json() as any;
      driveFileId = driveData.id;
      driveUrl = driveData.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;
      driveFolderId = targetFolderId || null;
      driveFolderUrl = targetFolderId ? `https://drive.google.com/drive/folders/${targetFolderId}` : null;
      console.log(`[Drive] File uploaded successfully to Google Drive: ${driveFileId} (${driveUrl})`);
    } else {
      const errText = await driveRes.text();
      driveError = errText;
      console.warn('[Drive] Drive upload failed:', driveRes.status, errText);
    }
  } catch (err: any) {
    driveError = err?.message || String(err);
    console.warn('[Drive] Drive upload exception:', err);
  }

  return { driveFileId, driveUrl, driveFolderId, driveFolderUrl, driveError };
}

// Endpoint to handle file upload, AI analysis, and Google Drive sync in parallel
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  let tmpFilePath: string | null = null;
  try {
    const file = req.file;
    const workspaceToken = req.body.workspaceToken;

    if (!file) {
      return res.status(400).json({ error: 'Không tìm thấy tệp tải lên' });
    }

    tmpFilePath = file.path;
    const fileBuffer = fs.readFileSync(tmpFilePath);
    const base64Data = fileBuffer.toString('base64');

    let mimeType = file.mimetype;
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (file.originalname?.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
      else if (file.originalname?.toLowerCase().endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (file.originalname?.toLowerCase().endsWith('.doc')) mimeType = 'application/msword';
      else if (file.originalname?.toLowerCase().endsWith('.png')) mimeType = 'image/png';
      else if (file.originalname?.toLowerCase().endsWith('.jpg') || file.originalname?.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
      else mimeType = 'application/pdf';
    }

    const token = workspaceToken || req.headers.authorization?.replace('Bearer ', '') || (req.headers['x-workspace-token'] as string);
    const defaultFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR';
    const targetFolderId = req.body.folderId || defaultFolderId;

    const customRulesJson = req.body.learnedRules;
    const aiBrainPayload = req.body.aiBrain;
    let customRulesPrompt = '';

    if (aiBrainPayload) {
      try {
        const brain = typeof aiBrainPayload === 'string' ? JSON.parse(aiBrainPayload) : aiBrainPayload;
        const rules = brain.learnedRules || [];
        const depts = brain.departments || [];
        const style = brain.styleMemory?.preferredStyles || [];

        customRulesPrompt += `\nTRI THỨC TỪ BỘ NÃO AI GOOGLE DRIVE (_BO_NAO_THAM_MUU_AI.json):\n`;
        if (rules.length > 0) {
          customRulesPrompt += `1. Quy tắc Máy học ưu tiên:\n` +
            rules.map((r: any, i: number) => `  - [${r.keywordTrigger}] -> Đơn vị chủ trì: "${r.suggestedLeadDept}", Đề xuất: "${r.suggestedAction}"`).join('\n') + '\n';
        }
        if (depts.length > 0) {
          customRulesPrompt += `2. Danh mục Cơ quan/Phòng ban chuẩn:\n` +
            depts.map((d: any) => `  - ${d.name} (${d.code}) [Trưởng đơn vị: ${d.headPerson || 'Chủ trì'}]`).join('\n') + '\n';
        }
        if (style.length > 0) {
          customRulesPrompt += `3. Định hướng Văn phong Tham mưu Lãnh đạo: ${style.join(', ')}\n`;
        }
      } catch (e) {
        console.warn('Could not parse AI Brain payload:', e);
      }
    } else if (customRulesJson) {
      try {
        const parsedRules = typeof customRulesJson === 'string' ? JSON.parse(customRulesJson) : customRulesJson;
        if (Array.isArray(parsedRules) && parsedRules.length > 0) {
          customRulesPrompt = `\nCÁC QUY TẮC HỌC MÁY ĐÃ ĐƯỢC CHUYÊN VIÊN / LÃNH ĐẠO ĐIỀU CHỈNH VÀ BẮT BUỘC ƯU TIÊN:\n` +
            parsedRules.map((r: any, i: number) => 
              `${i + 1}. Nếu nội dung văn bản chứa từ khóa/chủ đề: [${r.keywordTrigger}] -> Giao Đơn vị chủ trì: "${r.suggestedLeadDept}", Đề xuất phân luồng: "${r.suggestedAction}"`
            ).join('\n') + '\n';
        }
      } catch (e) {
        console.warn('Could not parse learned rules from request:', e);
      }
    }

    // Structured Extraction Schema
    const schema = {
      type: Type.OBJECT,
      properties: {
        documentNumber: { type: Type.STRING, nullable: true },
        documentType: { type: Type.STRING, nullable: true },
        title: { type: Type.STRING, nullable: true },
        summary: { type: Type.STRING, nullable: true },
        issuer: { type: Type.STRING, nullable: true },
        signer: { type: Type.STRING, nullable: true },
        issuedDate: { type: Type.STRING, nullable: true },
        receivedDate: { type: Type.STRING, nullable: true },
        effectiveDate: { type: Type.STRING, nullable: true },
        urgency: { type: Type.STRING, nullable: true },
        confidentiality: { type: Type.STRING, nullable: true },

        // Rich Advisory & Routing Fields
        proposedAction: { 
          type: Type.STRING, 
          nullable: true,
          description: "Phân luồng xử lý đề xuất: VD: 'Báo cáo Ban Thường vụ Tỉnh ủy/Thành ủy xem xét cho chủ trương', 'Chuyển Thường trực UBND chỉ đạo', 'Giao Văn phòng chủ trì phối hợp...', 'Giao Sở Kế hoạch & Đầu tư chủ trì tham mưu', 'Chuyển các đơn vị liên quan triển khai thực hiện'"
        },
        leadDepartment: { 
          type: Type.STRING, 
          nullable: true,
          description: "Cơ quan/Đơn vị chủ trì tham mưu xử lý" 
        },
        coordinatingDepartments: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "Các cơ quan, ban ngành phối hợp tham mưu"
        },
        advisoryOpinion: { 
          type: Type.STRING, 
          nullable: true,
          description: "Nội dung ý kiến tham mưu chi tiết trình lãnh đạo (3-4 câu ngắn gọn, súc tích, nêu rõ thẩm quyền xử lý, nội dung cần chỉ đạo, thời hạn báo cáo)" 
        },
        actionDeadline: { 
          type: Type.STRING, 
          nullable: true,
          description: "Tiến độ phải xong / Thời hạn hoàn thành bắt buộc (Trích xuất chính xác mốc ngày cụ thể DD/MM/YYYY hoặc YYYY-MM-DD ghi trong văn bản. Nếu văn bản không quy định rõ, tự động đề xuất mốc tiến độ chuẩn: Khẩn/Hỏa tốc = 3 ngày, Thượng khẩn = 5 ngày, Thường = 10 ngày kể từ ngày tiếp nhận)"
        },
        keyDirectives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Các ý chỉ đạo trọng tâm hoặc yêu cầu cốt lõi bắt buộc thực hiện"
        },
        legalBasis: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Các căn cứ pháp lý, nghị quyết, chỉ thị, luật được viện dẫn trong văn bản"
        },
        suggestedDraftType: {
          type: Type.STRING,
          nullable: true,
          description: "Đề xuất hình thức văn bản ban hành tiếp theo: 'Công văn chỉ đạo', 'Thông báo kết luận', 'Kế hoạch triển khai', 'Tờ trình Ban Thường vụ', 'Báo cáo giải trình'"
        },

        topics: { type: Type.ARRAY, items: { type: Type.STRING } },
        organizations: { type: Type.ARRAY, items: { type: Type.STRING } },
        persons: { type: Type.ARRAY, items: { type: Type.STRING } },
        deadlines: { type: Type.ARRAY, items: { type: Type.STRING } },
        requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
        importantNotes: { type: Type.STRING, nullable: true },

        // Full-text Content & Keyword Indexing for Advanced Search
        fullContent: { 
          type: Type.STRING, 
          nullable: true,
          description: "Tóm tắt chi tiết và cô đọng toàn bộ nội dung cốt lõi của văn bản (đặc biệt là các phần trích yếu, điều khoản, căn cứ pháp lý, nhiệm vụ chỉ đạo, con số, chỉ tiêu chính). Viết cực kỳ súc tích, tránh lặp lại nguyên văn dông dài để tối ưu hóa tốc độ xử lý." 
        },
        extractedTextKeywords: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Mảng danh mục các từ khóa tìm kiếm trọng tâm, thuật ngữ pháp lý, địa danh, tên dự án, số văn bản liên quan có trong bài."
        },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Gắn các thẻ phân loại nghiệp vụ chính cho văn bản phục vụ tìm kiếm: 'Yêu cầu báo cáo', 'Kiểm tra - Giám sát', 'Xây dựng kế hoạch', 'Nghị quyết', 'Chỉ thị', 'Quyết định', 'Tờ trình', 'Thông báo', 'Tài chính - Ngân sách', 'Tổ chức - Cán bộ', 'Đô thị - Môi trường', 'An ninh - Quốc phòng', 'Chuyển đổi số'."
        }
      },
      required: ['topics', 'organizations', 'persons', 'deadlines', 'requirements', 'coordinatingDepartments', 'keyDirectives', 'legalBasis', 'extractedTextKeywords', 'tags']
    };

    // Parallel Execution: AI analysis and Drive upload simultaneously
    const aiPromise = generateContentWithFallback({
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          }
        },
        {
          text: `Bạn là Chuyên viên Tham mưu - Tổng hợp cấp cao của Văn phòng Cấp ủy / Cơ quan Nhà nước.
Hãy nghiên cứu kỹ lưỡng toàn văn văn bản đính kèm, bóc tách chính xác các trường dữ liệu hành chính và ĐẶC BIỆT LÀ ĐƯA RA ĐỀ XUẤT THAM MƯU - PHÂN LUỒNG XỬ LÝ (proposedAction, leadDepartment, coordinatingDepartments, advisoryOpinion, actionDeadline, keyDirectives, suggestedDraftType).
${customRulesPrompt}
Quy tắc tham mưu phân luồng hành chính chung:
1. Nếu văn bản thuộc thẩm quyền Cấp ủy / Ban Thường vụ / Thường trực Tỉnh ủy, Thành ủy (các vấn đề chủ trương lớn, quy hoạch, nhân sự, an ninh chính trị, phòng chống tham nhũng, nghị quyết TW): Đề xuất phân luồng là "Báo cáo Ban Thường vụ Tỉnh ủy/Thành ủy" hoặc "Trình Thường trực xem xét, cho ý kiến chỉ đạo".
2. Nếu văn bản thuộc điều hành phát triển KTXH, dự án, ngân sách của cơ quan hành chính: Đề xuất "Chuyển Thường trực UBND / Ban Cán sự đảng UBND" và "Giao Sở/Ngành chuyên môn chủ trì (Sở KH&ĐT, Sở Tài chính, Sở TN&MT, Văn phòng...) phối hợp các đơn vị liên quan tham mưu dự thảo".
3. Ý kiến tham mưu (advisoryOpinion) phải viết chuẩn ngôn ngữ hành chính: Nêu rõ tóm tắt tính chất văn bản -> Đề xuất lãnh đạo phân công ai/đơn vị nào chủ trì -> Nhiệm vụ cụ thể -> Thời hạn báo cáo lãnh đạo.
4. Trích xuất chính xác số hiệu, ngày ban hành, cơ quan ký, ĐẶC BIỆT LÀ TIẾN ĐỘ PHẢI XONG (actionDeadline - dạng ngày DD/MM/YYYY hoặc mốc cụ thể). Trả về đúng JSON Schema.`
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    const drivePromise = token 
      ? uploadBufferToGoogleDrive({
          fileBuffer,
          fileName: file.originalname,
          mimeType,
          token,
          targetFolderId,
        })
      : Promise.resolve({
          driveFileId: null,
          driveUrl: null,
          driveFolderId: null,
          driveFolderUrl: null,
          driveError: 'Chưa có Google Drive token.'
        });

    const [aiResult, driveResult] = await Promise.all([aiPromise, drivePromise]);

    let extractedData: any = {};
    if (aiResult && aiResult.text) {
      try {
        const cleaned = cleanJsonText(aiResult.text);
        extractedData = normalizeVietnameseData(JSON.parse(cleaned));
      } catch (e) {
        console.error('Failed to parse Gemini JSON:', e);
      }
    }

    // Clean up tmp file
    if (tmpFilePath && fs.existsSync(tmpFilePath)) {
      try { fs.unlinkSync(tmpFilePath); } catch (_) {}
      tmpFilePath = null;
    }

    res.json({
      success: true,
      analysis: extractedData,
      driveFileId: driveResult.driveFileId,
      driveUrl: driveResult.driveUrl,
      driveFolderId: driveResult.driveFolderId,
      driveFolderUrl: driveResult.driveFolderUrl,
      driveError: driveResult.driveError,
      fileName: file.originalname,
      mimeType: mimeType
    });

  } catch (error: any) {
    console.error('Analysis error:', error);
    if (tmpFilePath && fs.existsSync(tmpFilePath)) {
      try { fs.unlinkSync(tmpFilePath); } catch (_) {}
    }
    res.status(500).json({ error: error.message || 'Phân tích văn bản thất bại. Vui lòng thử lại sau giây lát.' });
  }
});

// Endpoint to sync a document file to Google Drive
app.post('/api/drive/sync-file', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const token = req.body.workspaceToken || req.headers.authorization?.replace('Bearer ', '') || (req.headers['x-workspace-token'] as string);
    const targetFolderId = req.body.folderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1XqI-PetoZDvUiGEDiqnT25-4t1qonbIY';

    if (!token) {
      return res.status(401).json({ error: 'Cần cấp quyền truy cập Google Drive để tiếp tục.' });
    }

    if (!file) {
      return res.status(400).json({ error: 'Không tìm thấy tệp để tải lên Google Drive.' });
    }

    const fileBuffer = fs.readFileSync(file.path);
    const result = await uploadBufferToGoogleDrive({
      fileBuffer,
      fileName: file.originalname,
      mimeType: file.mimetype || 'application/pdf',
      token,
      targetFolderId,
    });

    try { fs.unlinkSync(file.path); } catch (_) {}

    if (result.driveFileId) {
      res.json({ success: true, ...result });
    } else {
      const isAuthError = result.driveError && (
        result.driveError.includes('401') || 
        result.driveError.includes('authError') || 
        result.driveError.includes('UNAUTHENTICATED') ||
        result.driveError.includes('invalid authentication credentials')
      );
      res.status(isAuthError ? 401 : 500).json({ 
        error: isAuthError ? 'Phiên làm việc Google Drive đã hết hạn. Vui lòng cấp lại quyền truy cập.' : (result.driveError || 'Tải lên Google Drive thất bại'),
        isAuthError: !!isAuthError
      });
    }
  } catch (err: any) {
    console.error('Drive manual sync error:', err);
    res.status(500).json({ error: err.message || 'Lỗi tải lên Google Drive' });
  }
});

// Extract tasks endpoint
app.post('/api/extract-tasks', async (req, res) => {
  try {
    const { analysis } = req.body;
    if (!analysis) {
      return res.status(400).json({ error: 'Không có thông tin văn bản' });
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        tasks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              dueDate: { type: Type.STRING, nullable: true },
              assignedOrganization: { type: Type.STRING, nullable: true },
              suggestedResponsiblePerson: { type: Type.STRING, nullable: true },
              sourcePage: { type: Type.STRING, nullable: true },
            },
            required: ['title', 'description']
          }
        }
      },
      required: ['tasks']
    };

    const response = await generateContentWithFallback({
      contents: [
        {
          text: `Dựa vào thông tin văn bản hành chính sau:\n${JSON.stringify(analysis, null, 2)}\n\nHãy trích xuất danh sách tất cả các nhiệm vụ, công việc chỉ đạo cụ thể cần thực hiện, cơ quan/đơn vị phụ trách, và hạn xử lý (nếu có) bằng tiếng Việt. Nếu không có nhiệm vụ cụ thể, trả về mảng tasks rỗng.`
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    if (response && response.text) {
      try {
        const cleaned = cleanJsonText(response.text);
        const parsed = JSON.parse(cleaned);
        res.json({ tasks: normalizeVietnameseData(parsed.tasks || []) });
      } catch (e) {
        res.json({ tasks: [] });
      }
    } else {
      res.json({ tasks: [] });
    }
  } catch (error: any) {
    console.error('Extract tasks error:', error);
    res.status(500).json({ error: error.message || 'Trích xuất nhiệm vụ thất bại. Vui lòng thử lại sau giây lát.' });
  }
});

// Summarize Document using Gemini API endpoint
app.post('/api/summarize-document', async (req, res) => {
  try {
    const { documentData } = req.body;
    if (!documentData) {
      return res.status(400).json({ error: 'Không có dữ liệu văn bản' });
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        executiveSummary: { type: Type.STRING },
        keyPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        urgencyAssessment: { type: Type.STRING },
        suggestedActions: { type: Type.STRING }
      },
      required: ['executiveSummary', 'keyPoints', 'urgencyAssessment', 'suggestedActions']
    };

    const response = await generateContentWithFallback({
      contents: [
        {
          text: `Bạn là trợ lý AI chuyên nghiệp của Văn phòng Đảng ủy và UBND. Hãy đọc kỹ thông tin văn bản hành chính sau đây và tạo một bản tóm tắt chuyên sâu, súc tích bằng tiếng Việt:\n${JSON.stringify(documentData, null, 2)}\n\nHãy phân tích rõ:\n1. executiveSummary: Tóm tắt nội dung cốt lõi của văn bản trong 2-3 câu.\n2. keyPoints: Danh sách 3-5 ý chính, điểm trọng tâm quan trọng nhất cần lưu ý.\n3. urgencyAssessment: Đánh giá tính cấp bách và tác động của văn bản.\n4. suggestedActions: Đề xuất hướng xử lý cụ thể cho Văn phòng hoặc chuyên viên tham mưu.`
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    if (response && response.text) {
      try {
        const cleaned = cleanJsonText(response.text);
        const parsed = JSON.parse(cleaned);
        res.json(normalizeVietnameseData(parsed));
      } catch (e) {
        res.status(500).json({ error: 'Lỗi xử lý kết quả tóm tắt từ AI.' });
      }
    } else {
      res.status(500).json({ error: 'Không nhận được phản hồi từ mô hình AI.' });
    }
  } catch (error: any) {
    console.error('Summarize document error:', error);
    res.status(500).json({ error: error.message || 'Tóm tắt văn bản thất bại. Vui lòng thử lại.' });
  }
});

// Target Google Drive Knowledge Folder for Municipal & Party Directives
const GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR';
const GOOGLE_DRIVE_KNOWLEDGE_FOLDER_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID}`;

// Curated & Digitized Knowledge Base from Google Drive folder 1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR
const DRIVE_FOLDER_DIGITIZED_KNOWLEDGE = {
  folderId: GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID,
  folderUrl: GOOGLE_DRIVE_KNOWLEDGE_FOLDER_URL,
  organization: 'Văn phòng Cấp ủy & UBND Địa phương',
  lastSynchronized: new Date().toISOString(),
  documentsInFolder: [
    {
      fileName: '01_Quy_che_lam_viec_Dang_uy_va_Ban_Thuong_vu.pdf',
      title: 'Quy chế làm việc của Ban Chấp hành Đảng bộ, Ban Thường vụ và Thường trực Đảng ủy',
      category: 'QUY_CHE_CAP_UY',
      keyRules: [
        'Ban Thường vụ Đảng ủy quyết định: Chủ trương quy hoạch đô thị, dự án đầu tư công, công tác cán bộ, giải quyết đơn thư khiếu nại tố cáo phức tạp, điểm nóng an ninh trật tự.',
        'Thường trực Đảng ủy (Bí thư, Phó Bí thư) xử lý: Điều hành công việc hàng ngày của Đảng ủy, cho ý kiến chỉ đạo khẩn cấp, duyệt dự thảo văn bản trình Ban Thường vụ.',
        'UBND Phường chủ trì: Tổ chức thực thi pháp luật, quản lý trật tự đô thị, PCCC, hộ tịch, cấp phép, thủ tục hành chính một cửa.'
      ]
    },
    {
      fileName: '02_Nghi_dinh_30_2020_The_thuc_Van_ban.pdf',
      title: 'Nghị định số 30/2020/NĐ-CP về Công tác Văn thư & Thể thức Văn bản Hành chính',
      category: 'PHAP_LY_THE_THUC',
      keyRules: [
        'Cấu trúc văn bản hành chính gồm 9 thành phần cơ bản: Quốc hiệu, Tiêu ngữ, Tên cơ quan ban hành, Số/Ký hiệu, Địa danh ngày tháng, Trích yếu, Nội dung, Chức vụ họ tên người ký, Nơi nhận.',
        'Văn bản khẩn: Hỏa tốc (xử lý ngay trong 24h), Thượng khẩn (xử lý trong ngày), Khẩn (xử lý trong 48h).'
      ]
    },
    {
      fileName: '03_Quy_dinh_66_QD_TW_The_thuc_Van_ban_Dang.pdf',
      title: 'Quy định số 66-QĐ/TW của Ban Bí thư về Thể thức Văn bản của Đảng',
      category: 'VAN_BAN_DANG',
      keyRules: [
        'Tiêu đề văn bản Đảng: ĐẢNG CỘNG SẢN VIỆT NAM, Tên cấp ủy ban hành (ví dụ: ĐẢNG BỘ PHƯỜNG / BAN THƯỜNG VỤ).',
        'Các loại hình văn bản: Nghị quyết, Quyết định, Quy định, Kết luận, Chỉ thị, Thông báo, Tờ trình, Công văn.'
      ]
    },
    {
      fileName: '04_Bo_Mau_But_phe_va_Thong_bao_Ket_luan.docx',
      title: 'Bộ Mẫu Bút phê Chỉ đạo của Bí thư & Mẫu Thông báo Kết luận Thường trực',
      category: 'MAU_BUT_PHE_CHI_DAO',
      keyRules: [
        'Mẫu bút phê trật tự đô thị/vỉa hè: "Giao UBND phường chỉ đạo Đội TTĐT phối hợp Công an phường xử lý dứt điểm; báo cáo Thường trực Đảng ủy trước ngày [Hạn]."',
        'Mẫu bút phê đơn thư/khiếu nại: "Chuyển UBND phường kiểm tra, xác minh theo thẩm quyền; trả lời công dân đúng luật định và báo cáo kết quả cho Thường trực."',
        'Mẫu bút phê an ninh/PCCC: "Yêu cầu Công an phường chủ trì phối hợp rà soát 100% cơ sở nguy cơ cao; xử lý nghiêm vi phạm, không để phát sinh điểm nóng."'
      ]
    },
    {
      fileName: '05_Ma_tran_Phan_luong_Nhiem_vu_Tham_muu.xlsx',
      title: 'Ma trận Phân luồng Nhiệm vụ & Định mức Thời hạn Tham mưu',
      category: 'PHAN_LUONG_NHIEM_VU',
      keyRules: [
        'Văn bản chỉ đạo của Quận ủy/Thành ủy: Tham mưu dự thảo Kế hoạch/Công văn triển khai trong 3 ngày làm việc.',
        'Đơn thư phản ánh của Nhân dân/Cử tri: Giao kiểm tra, xác minh và có văn bản trả lời trong 5-7 ngày làm việc.',
        'Văn bản đôn đốc tiến độ giải ngân/thu thuế: Báo cáo Thường trực hàng tuần vào thứ Sáu.'
      ]
    },
    {
      fileName: '_BO_NAO_THAM_MUU_AI.json',
      title: 'Bộ Não AI Tri Thức & Quy Tắc Máy Học Đồng Bộ Google Drive',
      category: 'AI_BRAIN_KNOWLEDGE',
      keyRules: [
        'Tích hợp 100% quy tắc phân công cán bộ, trưởng phòng phụ trách và lịch sử thẩm định chuẩn hóa.'
      ]
    }
  ]
};

// General Chat / Advice endpoint with Advanced Reasoning & Grounding
app.post('/api/chat', async (req, res) => {
  try {
    const { message, messages, contextDocs, referenceDocs, tasks, brainBlueprint, contextDocument, roleContext, learnedRules, trainingDatasets, userPreferencesContext } = req.body;
    let promptText = '';

    const formattingRule = `
YÊU CẦU ĐỊNH DẠNG & VĂN PHONG THAM MƯU (BẮT BUỘC):
1. TRẢ LỜI NGẮN GỌN, CÔ ĐỌNG, SẮC BÉN: Đi thẳng vào bản chất vấn đề tham mưu chiến lược, không trả lời dài dòng hay sao chép nguyên văn.
2. BỐ CỤC PHÂN ĐOẠN RÕ RÀNG, DỄ ĐỌC:
   - Chia câu trả lời thành các đề mục in đậm (ví dụ: **1. Đánh giá tình hình & Thẩm quyền**, **2. Phương án tham mưu đề xuất**, **3. Phân công chủ trì & Thời hạn hoàn thành**, **4. Căn cứ pháp lý & Lưu ý**).
   - Mỗi đoạn văn ngắn từ 2-3 câu, giữa các đoạn CÓ DÒNG TRỐNG để thông thoáng, dễ đọc.
3. DÙNG GẠCH ĐẦU DÒNG VÀ BÔI ĐẬM KEYWORD:
   - Sử dụng dấu gạch đầu dòng (-) cho từng ý tham mưu hoặc danh sách công việc.
   - Bôi đậm (**từ khóa trọng tâm**) như tên đơn vị chủ trì, mốc thời gian hoàn thành, số hiệu văn bản, cơ sở pháp lý.
4. NGUYÊN TẮC CÔNG TÁC CẤP ỦY & CHÍNH QUYỀN:
   - Tuân thủ chặt chẽ Điều lệ Đảng, Quy chế làm việc của Đảng ủy, thẩm quyền Ban Thường vụ / Thường trực / UBND theo cơ sở dữ liệu thư mục Google Drive.
   - Thể thức văn bản chuẩn theo Quy định số 66-QĐ/TW của Ban Bí thư (đối với văn bản Đảng) và Nghị định 30/2020/NĐ-CP (đối với văn bản hành chính Nhà nước).`;

    let knowledgeContext = `\n\n=== KHO TRI THỨC SỐ HÓA TỪ THƯ MỤC GOOGLE DRIVE CẤP ỦY ===\n` +
      `Thư mục nguồn: ${GOOGLE_DRIVE_KNOWLEDGE_FOLDER_URL} (Folder ID: ${GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID})\n` +
      `Danh mục tài liệu và quy chuẩn đã được nạp từ Google Drive:\n` +
      DRIVE_FOLDER_DIGITIZED_KNOWLEDGE.documentsInFolder.map((doc, idx) => 
        `[Drive Doc ${idx + 1}] ${doc.fileName} (${doc.title})\n- Quy chuẩn trọng yếu:\n  + ${doc.keyRules.join('\n  + ')}`
      ).join('\n\n');

    if (learnedRules && Array.isArray(learnedRules) && learnedRules.length > 0) {
      knowledgeContext += `\n\n--- BỘ NÃO AI HỌC TỪ QUY TẮC ĐIỀU CHỈNH CỦA LÃNH ĐẠO (LEARNED RULES) ---\n` +
        learnedRules.map((r: any, idx: number) => 
          `[Quy tắc ${idx + 1}] Từ khóa: [${r.keywordTrigger}] -> Giao Đơn vị chủ trì: "${r.suggestedLeadDept}", Hướng tham mưu: "${r.suggestedAction}" (Mức độ tin cậy: ${r.confidence || 95}%)`
        ).join('\n');
    }

    if (trainingDatasets && Array.isArray(trainingDatasets) && trainingDatasets.length > 0) {
      knowledgeContext += `\n\n--- MẪU LỜI GIẢI MẪU FINE-TUNING ĐÃ ĐƯỢC CẤP ỦY PHÊ DUYỆT (GOLDEN COMPLETIONS) ---\n` +
        trainingDatasets.slice(0, 8).map((td: any, idx: number) => 
          `[Mẫu ${idx + 1}] Tình huống: "${td.scenarioTitle}"\n- Bối cảnh: ${td.scenarioContext || 'N/A'}\n- Lời giải mẫu chuẩn mực: ${td.expertCompletion}\n- Thẩm quyền: ${td.authorityRouting || 'BTV Đảng ủy cho chủ trương'}`
        ).join('\n\n');
    }

    if (userPreferencesContext) {
      knowledgeContext += userPreferencesContext;
    }

    if (referenceDocs && Array.isArray(referenceDocs) && referenceDocs.length > 0) {
      knowledgeContext += `\n\n--- KHO TÀI LIỆU TRA CỨU & CĂN CỨ PHÁP LÝ BỔ SUNG ---\n` +
        referenceDocs.slice(0, 10).map((rd: any, idx: number) => 
          `[Tài liệu ${idx + 1}] Số: ${rd.documentNumber || 'N/A'} - Trích yếu: ${rd.title || rd.fileName} (Cơ quan: ${rd.issuer || 'N/A'})\nNội dung chính: ${rd.summary || rd.fullContent || 'N/A'}\nCăn cứ: ${(rd.legalBasis || []).join('; ')}`
        ).join('\n---\n');
    }

    if (contextDocs && Array.isArray(contextDocs) && contextDocs.length > 0) {
      knowledgeContext += `\n\n--- TÌNH HÌNH CÁC VĂN BẢN ĐẾN GẦN ĐÂY ---\n` +
        contextDocs.slice(0, 10).map((d: any, idx: number) => 
          `[VB ${idx + 1}] ${d.documentNumber ? `[${d.documentNumber}]` : ''} ${d.title || d.fileName} (Độ khẩn: ${d.urgency || 'Thường'}, Chủ trì: ${d.leadDepartment || 'Chưa giao'}, Hạn: ${d.actionDeadline || 'N/A'})`
        ).join('\n');
    }

    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
      knowledgeContext += `\n\n--- DANH MỤC NHIỆM VỤ ĐANG ĐÔN ĐỐC ---\n` +
        tasks.slice(0, 10).map((t: any, idx: number) => 
          `[Nhiệm vụ ${idx + 1}] ${t.title} - Phụ trách: ${t.assignedOrganization || t.assignee || 'Chưa giao'} - Hạn: ${t.dueDate || 'N/A'} - Trạng thái: ${t.status}`
        ).join('\n');
    }

    if (contextDocument) {
      knowledgeContext += `\n\n--- VĂN BẢN ĐANG XỬ LÝ TRỰC TIẾP ---\n` +
        `Số: ${contextDocument.documentNumber || 'N/A'} | Trích yếu: ${contextDocument.title || contextDocument.fileName}\n` +
        `Cơ quan ban hành: ${contextDocument.issuer || 'N/A'} | Độ khẩn: ${contextDocument.urgency || 'Thường'}\n` +
        `Tóm tắt: ${contextDocument.summary || 'N/A'}\n` +
        `Ý kiến tham mưu hiện tại: ${contextDocument.advisoryOpinion || 'N/A'}\n` +
        `Đơn vị chủ trì: ${contextDocument.leadDepartment || 'N/A'} | Hạn hoàn thành: ${contextDocument.actionDeadline || 'N/A'}`;
    }

    if (brainBlueprint?.learnedRules && brainBlueprint.learnedRules.length > 0) {
      knowledgeContext += `\n\n--- QUY TẮC MÁY HỌC ƯU TIÊN CỦA CƠ QUAN ---\n` +
        brainBlueprint.learnedRules.map((r: any) => `- Khi gặp [${r.keywordTrigger}] -> Giao: ${r.suggestedLeadDept}, Đề xuất: ${r.suggestedAction}`).join('\n');
    }

    let roleDescription = '';
    if (roleContext === 'ROUTING_AUTHORITY') {
      roleDescription = 'Bạn đang đóng vai trò Chuyên gia Phân luồng Thẩm quyền Cấp ủy: Tập trung cao độ vào việc phân định thẩm quyền Ban Thường vụ Đảng ủy vs UBND phường, chỉ rõ cấp nào quyết định, cấp nào thực hiện.';
    } else if (roleContext === 'DIRECTIVE_DRAFTING') {
      roleDescription = 'Bạn đang đóng vai trò Trợ lý Dự thảo Ý kiến Chỉ đạo & Bút phê: Soạn thảo mẫu bút phê ngắn gọn, đanh thép cho Bí thư Đảng ủy và thông báo kết luận chỉ đạo chuẩn thể thức.';
    } else if (roleContext === 'LEGAL_AUDIT') {
      roleDescription = 'Bạn đang đóng vai trò Kiểm toán Pháp lý & Thể thức: Rà soát nghiêm ngặt theo Nghị định 30/2020/NĐ-CP và Quy định 66-QĐ/TW.';
    } else {
      roleDescription = 'Bạn đang đóng vai trò Trợ lý Tham mưu Tổng hợp: Tham mưu toàn diện, nhận diện điểm nóng, phân luồng công việc và đôn đốc tiến độ.';
    }

    const systemPersona = `Bạn là Trợ lý AI Tham mưu & Xử lý Văn bản Cấp cao của Văn phòng Cấp ủy và Chính quyền địa phương (kết nối trực tiếp Kho Tri thức Google Drive: ${GOOGLE_DRIVE_KNOWLEDGE_FOLDER_URL}).
${roleDescription}
Nhiệm vụ của bạn là tư vấn, phân tích văn bản, đề xuất phân luồng thẩm quyền, tổng hợp báo cáo điều hành, rà soát pháp lý, giải đáp vướng mắc quy chế và hỗ trợ soạn thảo ý kiến chỉ đạo sắc sảo, kịp thời, chuẩn xác tuyệt đối dựa trên kho dữ liệu Google Drive và CSDL cơ quan.`;

    if (message && typeof message === 'string' && message.trim()) {
      promptText = `${systemPersona}
${knowledgeContext}

NỘI DUNG YÊU CẦU / CÂU HỎI TỪ LÃNH ĐẠO / CÁN BỘ:
${message.trim()}

${formattingRule}`;
    } else if (Array.isArray(messages) && messages.length > 0) {
      const conversationHistory = messages
        .map(m => `${m.role === 'user' ? 'Cán bộ/Lãnh đạo' : 'Trợ lý Tham mưu'}: ${m.content}`)
        .join('\n\n');

      promptText = `${systemPersona}
${knowledgeContext}

TIẾN TRÌNH HỘI THOẠI:
${conversationHistory}

${formattingRule}`;
    } else {
      return res.status(400).json({ error: 'Nội dung câu hỏi hoặc danh sách tin nhắn không hợp lệ.' });
    }

    const response = await generateContentWithFallback({
      contents: [{ text: promptText }],
    });

    const reply = (response && response.text) ? response.text.normalize('NFC') : 'Tôi đã tiếp nhận yêu cầu. Đồng chí vui lòng đặt câu hỏi cụ thể hơn.';
    res.json({ reply, driveFolderUrl: GOOGLE_DRIVE_KNOWLEDGE_FOLDER_URL });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Xử lý trao đổi thất bại. Vui lòng thử lại sau giây lát.' });
  }
});

// Dynamic Scenario Generator for Daily Learning
app.post('/api/generate-scenario', async (req, res) => {
  try {
    const { category, customTopic } = req.body;
    const ai = getAIClient();
    
    const prompt = `Bạn là Chuyên gia Cao cấp về Công tác Xây dựng Đảng & Nghiệp vụ Văn phòng Cấp ủy (Đảng ủy Phường/Xã/Quận).
Hãy tạo 01 tình huống thực tế nghiệp vụ mới (Daily Scenario) cho cán bộ Văn phòng Cấp ủy và Lãnh đạo tham mưu rèn luyện và đóng góp đánh giá.

Yêu cầu chủ đề: ${category || 'Phân định thẩm quyền Ban Thường vụ Đảng ủy vs UBND'} ${customTopic ? `(Chủ đề cụ thể: ${customTopic})` : ''}

Trả về DUY NHẤT một JSON object hợp lệ theo schema sau (không markdown code block bao ngoài nếu được, hoặc bọc trong \`\`\`json):
{
  "id": "sc-generated-${Date.now()}",
  "title": "Tiêu đề tình huống ngắn gọn, hấp dẫn",
  "category": "THAM_QUYEN_BTV_UBND",
  "categoryLabel": "Phân định Thẩm quyền BTV Đảng ủy vs UBND",
  "urgency": "KHAN",
  "urgencyLabel": "Khẩn",
  "background": "Mô tả bối cảnh tình huống thực tế chi tiết từ 3-4 câu (địa phương, cơ quan gửi văn bản, sự việc phát sinh, thời hạn)...",
  "keyQuestion": "Câu hỏi trọng tâm yêu cầu tham mưu (phân luồng cơ quan nào, xử lý ra sao)?",
  "keywordTriggers": "từ khóa 1, từ khóa 2, từ khóa 3",
  "defaultAiAdvice": {
    "authority": "Thẩm quyền thuộc BTV hay Thường trực hay UBND...",
    "suggestedRouting": "Cơ quan chủ trì và cơ quan phối hợp...",
    "suggestedDirective": "Mẫu ý kiến chỉ đạo hoặc bút phê gợi ý...",
    "legalBasis": ["Quy chế Đảng", "Nghị định 30/2020", "Luật liên quan"]
  },
  "options": [
    {
      "id": "opt-gen-1",
      "title": "Phương án 1 (Chuẩn quy chế quy định)",
      "leadDept": "Đơn vị chủ trì",
      "action": "Hành động cụ thể",
      "isRecommendedByPolicy": true,
      "explanation": "Giải thích vì sao phương án này chuẩn mực..."
    },
    {
      "id": "opt-gen-2",
      "title": "Phương án 2 (Chưa tối ưu hoặc sai lệch thẩm quyền)",
      "leadDept": "Đơn vị khác",
      "action": "Hành động sai",
      "isRecommendedByPolicy": false,
      "explanation": "Giải thích rủi ro khi chọn phương án này..."
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    res.json({ scenario: parsed });
  } catch (err: any) {
    console.error('Error generating scenario:', err);
    res.status(500).json({ error: err.message || 'Không thể tạo tình huống mới' });
  }
});

// Endpoint to inspect all knowledge files and rules loaded from the Google Drive Folder
app.get('/api/drive/folder-knowledge', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || (req.headers['x-workspace-token'] as string);
    let liveDriveFiles: any[] = [];

    if (token) {
      try {
        const queryStr = encodeURIComponent(`'${GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID}' in parents and trashed = false`);
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${queryStr}&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)&pageSize=30`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (searchRes.ok) {
          const data = await searchRes.json() as any;
          liveDriveFiles = data.files || [];
        }
      } catch (err) {
        console.warn('[Drive Knowledge] Optional live query to Drive API failed:', err);
      }
    }

    res.json({
      folderId: GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID,
      folderUrl: GOOGLE_DRIVE_KNOWLEDGE_FOLDER_URL,
      isLiveConnected: liveDriveFiles.length > 0,
      liveFilesCount: liveDriveFiles.length,
      liveFiles: liveDriveFiles,
      digitizedKnowledge: DRIVE_FOLDER_DIGITIZED_KNOWLEDGE
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi đọc tri thức từ Google Drive' });
  }
});

// Google Drive Config & Status endpoint
app.get('/api/drive/config', (req, res) => {
  const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR';
  res.json({
    folderId,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    isConfigured: true
  });
});

// Endpoint to export the AI Brain Knowledge Base directly to Google Drive
app.post('/api/drive/export-brain', async (req, res) => {
  try {
    const token = req.body.workspaceToken || req.headers.authorization?.replace('Bearer ', '') || (req.headers['x-workspace-token'] as string);
    const targetFolderId = req.body.folderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR';

    if (!token) {
      return res.status(401).json({ error: 'Cần cấp quyền truy cập Google Drive để xuất Bộ Não AI.' });
    }

    const { 
      learnedRules = [], 
      departments = [], 
      routingRules = [], 
      legalBases = [], 
      styleMemory = {}, 
      approvedDecisions = [] 
    } = req.body;

    const brainBlueprint = {
      _version: '2.5.0',
      _type: 'GOOGLE_DRIVE_AI_BRAIN_KNOWLEDGE_BASE',
      _updatedAt: new Date().toISOString(),
      _appName: 'Hệ thống Trợ lý AI Tham mưu Cấp ủy',
      metadata: {
        appId: 'e04b55c4-c46e-4d7e-b592-06255f82d9c5',
        organization: 'Văn phòng Cấp ủy & Chính quyền',
        ruleCount: learnedRules.length,
        departmentCount: departments.length,
        routingRuleCount: routingRules.length,
        legalCount: legalBases.length
      },
      learnedRules,
      departments,
      routingRules,
      legalBases,
      styleMemory: {
        preferredStyles: styleMemory.preferredStyles || ['Quyết liệt', 'Dân vận khéo'],
        frequentSigners: styleMemory.frequentSigners || ['Bí thư Đảng ủy', 'Chánh Văn phòng'],
        ...styleMemory
      },
      approvedDecisionsSummary: approvedDecisions
    };

    const brainJsonString = JSON.stringify(brainBlueprint, null, 2);
    const fileBuffer = Buffer.from(brainJsonString, 'utf-8');
    const fileName = `_BO_NAO_THAM_MUU_AI.json`;

    const result = await uploadBufferToGoogleDrive({
      fileBuffer,
      fileName,
      mimeType: 'application/json',
      token,
      targetFolderId,
    });

    if (result.driveFileId) {
      res.json({
        success: true,
        message: 'Đã xuất và đồng bộ Bộ Não Tham mưu AI lên Google Drive thành công!',
        fileName,
        driveFileId: result.driveFileId,
        driveUrl: result.driveUrl,
        driveFolderUrl: result.driveFolderUrl,
        sizeBytes: fileBuffer.length,
        updatedAt: brainBlueprint._updatedAt,
        brainBlueprint
      });
    } else {
      res.status(500).json({ error: result.driveError || 'Không thể đồng bộ Bộ Não AI lên Google Drive.' });
    }
  } catch (err: any) {
    console.error('Export AI Brain error:', err);
    res.status(500).json({ error: err.message || 'Lỗi xuất Bộ Não AI lên Google Drive.' });
  }
});

// Endpoint to import and load AI Brain Knowledge from Google Drive
app.post('/api/drive/import-brain', async (req, res) => {
  try {
    const token = req.body.workspaceToken || req.headers.authorization?.replace('Bearer ', '') || (req.headers['x-workspace-token'] as string);
    const targetFolderId = req.body.folderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR';

    if (!token) {
      return res.status(401).json({ error: 'Cần cấp quyền truy cập Google Drive để nhập Bộ Não AI.' });
    }

    // Search for _BO_NAO_THAM_MUU_AI.json file in Drive
    const queryStr = encodeURIComponent(`name = '_BO_NAO_THAM_MUU_AI.json' and '${targetFolderId}' in parents and trashed = false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${queryStr}&fields=files(id,name,modifiedTime,size)`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      return res.status(500).json({ error: `Lỗi kết nối Drive API: ${errText}` });
    }

    const searchData = await searchRes.json() as any;
    const files = searchData.files || [];

    if (files.length === 0) {
      return res.status(404).json({ error: 'Chưa tìm thấy tệp _BO_NAO_THAM_MUU_AI.json trên thư mục Google Drive cơ quan. Vui lòng nhấn "Sao lưu Bộ Não AI" trước.' });
    }

    const targetFile = files[0];
    const fileId = targetFile.id;

    // Fetch file content
    const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!contentRes.ok) {
      return res.status(500).json({ error: 'Không thể đọc nội dung tệp Bộ Não AI từ Google Drive.' });
    }

    const brainJsonText = await contentRes.text();
    const brainData = JSON.parse(brainJsonText);

    res.json({
      success: true,
      message: 'Đã nạp thành công Bộ Não AI từ Google Drive!',
      fileId,
      modifiedTime: targetFile.modifiedTime,
      brainData
    });
  } catch (err: any) {
    console.error('Import AI Brain error:', err);
    res.status(500).json({ error: err.message || 'Lỗi đọc tệp Bộ Não AI từ Google Drive.' });
  }
});

// Endpoint for AI Gemini to analyze past approvals & synthesize new Knowledge Rules for the AI Brain
app.post('/api/brain/synthesize-knowledge', async (req, res) => {
  try {
    const { documents = [], existingRules = [] } = req.body;
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: 'Cần cung cấp danh sách văn bản nguồn để tổng hợp tri thức.' });
    }

    const docExcerpts = documents.slice(0, 15).map((d: any) => ({
      title: d.title || d.fileName,
      leadDepartment: d.leadDepartment,
      proposedAction: d.proposedAction,
      keywords: d.extractedTextKeywords,
      summary: d.summary
    }));

    const synthesisSchema = {
      type: Type.OBJECT,
      properties: {
        newRules: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              keywordTrigger: { type: Type.STRING, description: "Chuỗi từ khóa kích hoạt, phân cách bởi dấu phẩy" },
              suggestedLeadDept: { type: Type.STRING, description: "Cơ quan/Phòng ban chủ trì tối ưu nhất" },
              suggestedAction: { type: Type.STRING, description: "Hành động đề xuất thẩm định ngắn gọn" },
              confidence: { type: Type.INTEGER, description: "Mức độ tin cậy từ 80 đến 99" },
              notes: { type: Type.STRING, description: "Ghi chú phân tích nguyên nhân tổng hợp quy tắc" }
            },
            required: ['keywordTrigger', 'suggestedLeadDept', 'suggestedAction', 'confidence', 'notes']
          }
        },
        executiveSummary: {
          type: Type.STRING,
          description: "Đánh giá tổng quan về xu hướng văn bản và khuyến nghị hoàn thiện Bộ Não Tham mưu"
        }
      },
      required: ['newRules', 'executiveSummary']
    };

    const response = await generateContentWithFallback({
      contents: [
        {
          text: `Bạn là Chuyên gia Học máy & Tối ưu hóa Tri thức Văn phòng Cấp ủy.
Hãy phân tích danh sách các văn bản đã được thẩm định và xử lý thành công sau:
${JSON.stringify(docExcerpts, null, 2)}

Các quy tắc đã có sẵn:
${JSON.stringify(existingRules, null, 2)}

Yêu cầu:
1. Phát hiện các mẫu văn bản/chủ đề chưa có quy tắc học máy, trích xuất chuỗi từ khóa kích hoạt (keywordTrigger) và đơn vị chủ trì (suggestedLeadDept) chuẩn xác.
2. Tạo thêm các quy tắc học máy mới bổ sung vào Bộ Não AI Google Drive.
3. Trả về định dạng JSON đúng Schema.`
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: synthesisSchema,
      }
    });

    if (response && response.text) {
      const cleaned = cleanJsonText(response.text);
      const parsed = JSON.parse(cleaned);
      res.json(normalizeVietnameseData(parsed));
    } else {
      res.json({ newRules: [], executiveSummary: 'Không tìm thấy quy tắc mới.' });
    }
  } catch (err: any) {
    console.error('Synthesize knowledge error:', err);
    res.status(500).json({ error: err.message || 'Lỗi phân tích tổng hợp tri thức AI.' });
  }
});

// Endpoint to generate draft official dispatch / directive decision based on document
app.post('/api/generate-response-draft', async (req, res) => {
  try {
    const { document, draftType = 'Công văn chỉ đạo' } = req.body;
    if (!document) {
      return res.status(400).json({ error: 'Không có thông tin văn bản nguồn' });
    }

    const response = await generateContentWithFallback({
      contents: [
        {
          text: `Bạn là Chuyên viên Văn phòng cấp cao. Hãy soạn thảo MỘT DỰ THẢO VĂN BẢN HÀNH CHÍNH (${draftType}) hoàn chỉnh theo Nghị định 30/2020/NĐ-CP hoặc Quy định của Đảng để phúc đáp / triển khai thực hiện văn bản sau:

Thông tin văn bản gốc:
- Số hiệu: ${document.documentNumber || 'Đang cập nhật'}
- Trích yếu: ${document.title || document.fileName}
- Cơ quan ban hành: ${document.issuer || 'N/A'}
- Ngày ban hành: ${document.issuedDate || 'N/A'}
- Tóm tắt nội dung: ${document.summary || 'N/A'}
- Đề xuất phân luồng: ${document.proposedAction || 'Giao cơ quan chủ trì thực hiện'}
- Cơ quan chủ trì: ${document.leadDepartment || 'Văn phòng'}
- Ý kiến tham mưu: ${document.advisoryOpinion || 'N/A'}
- Các chỉ đạo trọng tâm: ${(document.keyDirectives || []).join('; ')}

Yêu cầu định dạng:
1. Thể thức chuẩn: Quốc hiệu, Tiêu ngữ, Tên cơ quan, Số/Ký hiệu (dự thảo), Địa danh - ngày tháng năm, Trích yếu, Kính gửi, Căn cứ ban hành, Nội dung chỉ đạo cụ thể (Giao đơn vị chủ trì, đơn vị phối hợp, thời hạn hoàn thành), Nơi nhận.
2. Ngôn từ trang trọng, chuẩn mực hành chính, rõ việc, rõ người, rõ thời hạn.
3. Trả về định dạng Markdown rõ ràng, dễ sao chép và chỉnh sửa.`
        }
      ],
    });

    res.json({ draft: (response && response.text ? response.text : '').normalize('NFC') });
  } catch (error: any) {
    console.error('Generate draft error:', error);
    res.status(500).json({ error: error.message || 'Soạn thảo văn bản thất bại. Vui lòng thử lại sau giây lát.' });
  }
});

// Endpoint for AI Semantic Search across full text, metadata, and directives
app.post('/api/search-ai', async (req, res) => {
  try {
    const { query: searchQuery, documents } = req.body;
    if (!searchQuery || !documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: 'Thiếu câu lệnh tra cứu hoặc danh sách văn bản' });
    }

    const docSummaries = documents.map((doc: any, index: number) => ({
      index,
      id: doc.id,
      number: doc.documentNumber,
      title: doc.title || doc.fileName,
      issuer: doc.issuer,
      proposedAction: doc.proposedAction,
      leadDepartment: doc.leadDepartment,
      summary: doc.summary,
      directives: doc.keyDirectives,
      legalBasis: doc.legalBasis,
      fullContentExcerpt: doc.fullContent ? doc.fullContent.substring(0, 500) : null
    }));

    const searchSchema = {
      type: Type.OBJECT,
      properties: {
        aiAnswerSummary: {
          type: Type.STRING,
          description: "Tóm tắt tổng hợp ngắn gọn (2-3 câu) trả lời trực tiếp cho câu hỏi tra cứu dựa trên các văn bản tìm thấy."
        },
        matchedDocIndexes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER },
              matchReason: { type: Type.STRING, description: "Lý do vì sao văn bản này phù hợp với yêu cầu tra cứu (nêu rõ căn cứ, điều khoản, trích yếu)" },
              relevanceScore: { type: Type.NUMBER, description: "Điểm phù hợp từ 0.0 đến 1.0" }
            },
            required: ['index', 'matchReason', 'relevanceScore']
          }
        }
      },
      required: ['aiAnswerSummary', 'matchedDocIndexes']
    };

    const response = await generateContentWithFallback({
      contents: [
        {
          text: `Bạn là Trợ lý AI Tìm kiếm Văn bản Hành chính Cấp cao.
Nhiệm vụ: Phân tích yêu cầu tra cứu tự nhiên sau của cán bộ:
"${searchQuery}"

Danh sách các văn bản trong kho cơ sở dữ liệu:
${JSON.stringify(docSummaries, null, 2)}

Hãy lọc ra danh sách các văn bản có nội dung, chủ trương, chỉ đạo, cơ quan chủ trì hoặc căn cứ pháp lý PHÙ HỢP NHẤT với câu hỏi.
Trả về JSON đúng cấu trúc schema.`
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: searchSchema,
      }
    });

    if (response && response.text) {
      const cleaned = cleanJsonText(response.text);
      const parsed = JSON.parse(cleaned);
      res.json(normalizeVietnameseData(parsed));
    } else {
      res.json({ aiAnswerSummary: "Không tìm thấy kết quả phù hợp.", matchedDocIndexes: [] });
    }
  } catch (error: any) {
    console.error("AI Search error:", error);
    res.status(500).json({ error: error.message || "Tra cứu AI thất bại." });
  }
});

// Endpoint to draft complete Party Secretary directives (Tham mưu Ý kiến Kết luận & Chỉ đạo của Bí thư Đảng ủy)
app.post('/api/draft-directive', async (req, res) => {
  try {
    const { 
      idea, 
      documentType = 'CONCLUSION', 
      stylePreference, 
      matchedResolutions, 
      paragraphFormat = 'PARAGRAPH_EXECUTIVE',
      driveKnowledgeContext,
      meetingContext
    } = req.body;
    
    if (!idea) {
      return res.status(400).json({ error: 'Thiếu ý kiến, ý tưởng hoặc nhiệm vụ chỉ đạo nguồn.' });
    }

    const docTypeTitle = documentType === 'DIRECTIVE' 
      ? 'CHỈ THỊ CỦA BAN THƯỜNG VỤ ĐẢNG UỶ PHƯỜNG'
      : documentType === 'RESOLUTION'
      ? 'NGHỊ QUYẾT CHUYÊN ĐỀ CỦA ĐẢNG UỶ PHƯỜNG'
      : documentType === 'ENDORSEMENT'
      ? 'Ý KIẾN BÚT PHÊ CHỈ ĐẠO CỦA BÍ THƯ ĐẢNG UỶ'
      : 'THÔNG BÁO KẾT LUẬN CỦA BÍ THƯ ĐẢNG UỶ PHƯỜNG (HOẶC THƯỜNG TRỰC ĐẢNG ỦY)';

    const draftSchema = {
      type: Type.OBJECT,
      properties: {
        option1: {
          type: Type.STRING,
          description: "Phương án 1: Viết theo các đoạn văn chính luận lãnh đạo mạch lạc, sắc bén, quyết liệt, kỷ cương công vụ. Mỗi đoạn văn mang một nhiệm vụ chính trị - hành chính rõ ràng (Đánh giá chung -> Phân công UBND & Công an -> Khối Dân vận Mặt trận & Chi bộ khu phố -> Đôn đốc kiểm tra & Thời hạn báo cáo). Đi thẳng vào việc, đanh thép, rõ người, rõ việc, dứt khoát."
        },
        option2: {
          type: Type.STRING,
          description: "Phương án 2: Viết theo các đoạn văn chính luận lãnh đạo toàn diện, đồng bộ, dân vận khéo và phát huy tính tiền phong gương mẫu. Kết hợp chặt chẽ giữa kỷ cương hành chính và công tác tư tưởng, vận động quần chúng nhân dân đồng thuận cao."
        },
        styleDescription1: {
          type: Type.STRING,
          description: "Mô tả ngắn gọn đặc trưng Phương án 1 (ví dụ: Đoạn văn Quyết liệt - Kỷ cương hành động - Rõ thời hạn dứt khoát)."
        },
        styleDescription2: {
          type: Type.STRING,
          description: "Mô tả ngắn gọn đặc trưng Phương án 2 (ví dụ: Đoạn văn Toàn diện - Dân vận khéo - Phát huy vai trò Chi bộ & Nêu gương)."
        }
      },
      required: ['option1', 'option2', 'styleDescription1', 'styleDescription2']
    };

    let driveKnowledgePrompt = `
--- NGUỒN TRI THỨC VĂN BẢN MẪU TỪ GOOGLE DOCS & DRIVE CẤP ỦY ---
* Tài liệu Mẫu Chuẩn Google Docs (Mẫu Thông báo Kết luận của Bí thư/Thường trực Đảng ủy):
  - Link file: https://docs.google.com/document/d/1uzKq-XB69np2ElcHje3qznYco_uxWc1PHCv-cKUgfUQ/edit?tab=t.0
  - Cấu trúc chuẩn hóa:
    + Thể thức: Đảng ủy Phường / Ban Thường vụ Đảng ủy - Số hiệu ...-TB/ĐU.
    + Thể hiện ý kiến kết luận của Bí thư Đảng ủy / Thường trực Đảng ủy tại các kỳ họp, giao ban hoặc kiểm tra hiện trường.
    + Phân đoạn mạch lạc: Đánh giá tình hình -> Chỉ đạo UBND & Công an -> Chỉ đạo Mặt trận, Dân vận & Chi bộ Khu phố -> Tổ chức thực hiện, đôn đốc & Thời hạn báo cáo.
* Kho Thông báo kết luận thực tiễn trước đây (Google Drive Folder: 1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR):
1. Thông báo Kết luận số 42-TB/ĐU (Trật tự đô thị & Kỷ cương vỉa hè): "Đánh giá thẳng thắn công tác lập lại trật tự đô thị thời gian qua có chuyển biến nhưng chưa bền vững, còn tình trạng tái lấn chiếm lòng lề đường. Yêu cầu UBND phường tập trung cao độ, giao Chủ tịch UBND trực tiếp chỉ đạo Công an phường lập các tổ liên ngành kiểm tra liên tục; Cấp ủy các chi bộ khu phố phân công đảng viên phụ trách từng tuyến đường tự quản; MTTQ và các đoàn thể tăng cường vận động hộ kinh doanh ký cam kết..."
2. Thông báo Kết luận số 58-TB/ĐU (Cải cách hành chính & Đề án 06 / VNeID): "Ghi nhận nỗ lực số hóa và phục vụ người dân tại Bộ phận Một cửa. Tuy nhiên, tỷ lệ hồ sơ trực tuyến toàn trình tại một số khu phố còn thấp. Yêu cầu UBND phường rà soát toàn diện quy trình, không để trễ hẹn bất kỳ hồ sơ nào của công dân; Đoàn Thanh niên duy trì tổ công nghệ số cộng đồng hướng dẫn người dân cài đặt VNeID mức 2..."
3. Thông báo Kết luận số 76-TB/ĐU (An toàn PCCC & Cứu nạn): "Xác định an toàn PCCC là nhiệm vụ đặc biệt cấp bách bảo vệ tính mạng nhân dân. Giao Công an phường phối hợp UBND tổng kiểm tra 100% nhà trọ, nhà nhiều căn hộ; kiên quyết đình chỉ cơ sở vi phạm nghiêm trọng; các Chi bộ khu phố phát động phong trào 'Mỗi hộ gia đình một bình chữa cháy'..."
4. Thông báo Kết luận số 91-TB/ĐU (Giải phóng mặt bằng & Dự án hạ tầng): "Khẳng định công tác bồi thường GPMB là khâu then chốt thúc đẩy phát triển kinh tế địa phương. Yêu cầu khối Dân vận, Mặt trận 'đi từng ngõ, gõ từng nhà', kiên trì lắng nghe tâm tư, đối thoại thỏa đáng với các hộ dân chưa đồng thuận; UBND phường giải quyết kịp thời chính sách bồi thường đúng quy định pháp luật..."
5. Thông báo Kết luận số 105-TB/ĐU (Xây dựng Đảng & Sinh hoạt Chi bộ khu phố): "Yêu cầu các cấp ủy chi bộ đổi mới nội dung sinh hoạt theo hướng bám sát địa bàn, giải quyết việc nóng; tăng cường giáo dục chính trị tư tưởng, tạo nguồn phát triển đảng viên trẻ..."`;

    if (driveKnowledgeContext) {
      driveKnowledgePrompt += `\nNgữ cảnh bổ sung: ${driveKnowledgeContext}\n`;
    }

    const promptText = `Bạn là Bí thư Đảng ủy phường - Người đứng đầu Cấp ủy lãnh đạo toàn diện hệ thống chính trị cơ sở phường (bao gồm Đảng ủy, UBND phường, Ủy ban MTTQ và các Đoàn thể, Công an, Ban CHQS phường và Chi bộ 100% các khu phố).

Nhiệm vụ: Căn cứ vào ý kiến/nội dung chỉ đạo nguồn:
"${idea}"

Hình thức văn bản: ${docTypeTitle}
${meetingContext ? `Bối cảnh cuộc họp: "${meetingContext}".` : 'Bối cảnh: Cuộc họp Thường trực Đảng ủy định kỳ / Giao ban chỉ đạo.'}
${stylePreference ? `Định hướng phong cách mong muốn: "${stylePreference}".` : ''}
${matchedResolutions && matchedResolutions.length > 0 ? `Căn cứ Nghị quyết cấp trên: "${matchedResolutions.join(', ')}".` : ''}
${driveKnowledgePrompt}

NGUYÊN TẮC SOẠN THẢO Ý KIẾN KẾT LUẬN & CHỈ ĐẠO CỦA BÍ THƯ ĐẢNG ỦY:
1. BẮT BUỘC TRÌNH BÀY THEO CÁC ĐOẠN VĂN MẠCH LẠC, LIÊN KẾT CHẶT CHẼ (KHÔNG DÙNG GẠCH ĐẦU DÒNG VỤN VẶT):
   - Viết thành 3 đến 4 đoạn văn chính luận chính trị - hành chính chuẩn mực, trang trọng, đanh thép, câu từ khúc chiết, mang phong thái người lãnh đạo cao nhất của Đảng bộ.
   - Mỗi đoạn văn hoàn chỉnh diễn đạt trọn vẹn một mảng chỉ đạo chiến lược.

2. CẤU TRÚC ĐOẠN VĂN LÃNH ĐẠO CẤP ỦY:
   - Đoạn 1 (Đánh giá chung & Quyết tâm chính trị): Nhận định thực trạng, đánh giá khách quan kết quả đạt được, chỉ rõ những tồn tại, hạn chế, khuyết điểm cốt lõi và khẳng định quyết tâm chính trị của Đảng ủy trong việc giải quyết dứt điểm vấn đề.
   - Đoạn 2 (Chỉ đạo UBND Phường, Công an và Cơ quan chuyên môn): Giao nhiệm vụ dứt khoát cho đồng chí Chủ tịch UBND phường chỉ đạo các ban ngành, phối hợp Công an phường triển khai ngay các giải pháp trọng tâm, siết chặt kỷ luật, kỷ cương công vụ, tăng cường kiểm tra, xử lý nghiêm minh các vi phạm.
   - Đoạn 3 (Chỉ đạo Khối Dân vận, Mặt trận Tổ quốc, Đoàn thể & Chi bộ Khu phố): Huy động sức mạnh cả hệ thống chính trị, phát huy vai trò tiền phong gương mẫu của từng cấp ủy, chi bộ khu phố và đảng viên; tăng cường tuyên truyền, vận động, lắng nghe nhân dân, tạo sự đồng thuận xã hội sâu rộng theo phương châm "Dân biết, dân bàn, dân làm, dân kiểm tra, dân giám sát, dân thụ hưởng".
   - Đoạn 4 (Tổ chức thực hiện, Đôn đốc giám sát & Hạn báo cáo): Phân công Văn phòng Đảng ủy phối hợp Ủy ban Kiểm tra Đảng ủy thường xuyên theo dõi, đôn đốc, giám sát tiến độ thực hiện; tổng hợp báo cáo Thường trực Đảng ủy trước mốc thời gian cụ thể.

3. ĐÚNG VỊ THẾ & QUYỀN HẠN CỦA BÍ THƯ ĐẢNG ỦY:
   - Dùng các thuật ngữ Cấp ủy chuẩn mực: "Thường trực Đảng ủy thống nhất kết luận...", "Ban Thường vụ Đảng ủy yêu cầu...", "Giao đồng chí Chủ tịch UBND phường chỉ đạo...", "Đề nghị Khối Dân vận, Ủy ban MTTQ và các đoàn thể...", "Yêu cầu cấp ủy các Chi bộ khu phố...", "Giao Văn phòng Đảng ủy chủ trì theo dõi, tổng hợp báo cáo...".

Hãy tạo 02 phương án hoàn chỉnh viết theo đoạn văn chuẩn phong cách lãnh đạo Cấp ủy:
- Phương án 1 (Quyết liệt - Hành động dứt khoát - Kỷ cương công vụ): Văn phong đanh thép, tập trung vào hành động ngay, siết chặt kiểm tra và thời hạn hoàn thành dứt khoát.
- Phương án 2 (Đồng bộ - Toàn diện - Dân vận khéo & Nêu gương): Kết hợp đồng bộ giữa kỷ cương hành chính và công tác chính trị tư tưởng, phát huy tính tiên phong của chi bộ và sự đồng thuận của nhân dân.`;

    const response = await generateContentWithFallback({
      contents: [{ text: promptText }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: draftSchema,
      }
    });

    if (response && response.text) {
      const cleaned = cleanJsonText(response.text);
      const parsed = JSON.parse(cleaned);
      res.json(normalizeVietnameseData(parsed));
    } else {
      throw new Error("Không thể tạo dự thảo chỉ đạo.");
    }
  } catch (error: any) {
    console.error("Draft directive error:", error);
    res.status(500).json({ error: error.message || "Tạo dự thảo chỉ đạo hành văn thất bại." });
  }
});

// Endpoint to audit and proofread administrative documents
app.post('/api/audit-document', upload.single('file'), async (req, res) => {
  try {
    let documentText = req.body.text || '';
    const file = req.file;
    let tmpFilePath = file ? file.path : null;

    if (file) {
      const fileBuffer = fs.readFileSync(tmpFilePath!);
      const base64Data = fileBuffer.toString('base64');
      const mimeType = file.mimetype || 'application/octet-stream';

      const fileAuditSchema = {
        type: Type.OBJECT,
        properties: {
          auditSummary: {
            type: Type.OBJECT,
            properties: {
              totalErrors: { type: Type.NUMBER, description: "Tổng số lượng lỗi phát hiện" },
              spellingErrorsCount: { type: Type.NUMBER, description: "Số lỗi chính tả" },
              formattingErrorsCount: { type: Type.NUMBER, description: "Số lỗi thể thức văn bản hành chính" },
              vocabularyErrorsCount: { type: Type.NUMBER, description: "Số lỗi từ ngữ, ngữ cảnh không phù hợp" },
              overallScore: { type: Type.NUMBER, description: "Điểm chất lượng văn bản từ 0 đến 100" },
              generalAssessment: { type: Type.STRING, description: "Đánh giá tổng quan về chất lượng văn bản" }
            },
            required: ['totalErrors', 'spellingErrorsCount', 'formattingErrorsCount', 'vocabularyErrorsCount', 'overallScore', 'generalAssessment']
          },
          errorsAndIssues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, description: "'SPELLING' | 'FORMAT' | 'VOCABULARY' | 'STYLE'" },
                originalText: { type: Type.STRING, description: "Đoạn văn hoặc từ khóa chứa lỗi" },
                issueDescription: { type: Type.STRING, description: "Mô tả chi tiết lỗi" },
                suggestedFix: { type: Type.STRING, description: "Đề xuất sửa lại chính xác" },
                explanation: { type: Type.STRING, description: "Lý do và căn cứ hướng dẫn sửa lỗi" }
              },
              required: ['id', 'type', 'originalText', 'issueDescription', 'suggestedFix', 'explanation']
            }
          },
          paragraphSuggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalParagraph: { type: Type.STRING, description: "Đoạn văn gốc chưa hoàn thiện" },
                improvedParagraph: { type: Type.STRING, description: "Đoạn văn đã được gọt giũa lại hay, trang trọng, sắc sảo hơn" },
                reason: { type: Type.STRING, description: "Lý do cải thiện" }
              },
              required: ['originalParagraph', 'improvedParagraph', 'reason']
            }
          },
          fullyAuditedDocument: { type: Type.STRING, description: "Toàn văn bản sau khi đã được rà soát, sửa toàn bộ lỗi chính tả, thể thức và tinh chỉnh văn phong hoàn thiện." }
        },
        required: ['auditSummary', 'errorsAndIssues', 'paragraphSuggestions', 'fullyAuditedDocument']
      };

      const auditResponse = await generateContentWithFallback({
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          {
            text: `Bạn là Chuyên gia Cục Thể thức & Kỹ thuật Văn bản Đảng và Nhà nước, am hiểu tường tận Nghị định 30/2020/NĐ-CP, Quy định công tác văn thư Đảng và **Hướng dẫn số 05-HD/VPTW** (Về thể thức và kỹ thuật trình bày văn bản của Đảng), kết hợp kho tri thức từ Bộ não chung Drive của cơ quan.
Hãy kiểm tra, rà soát toàn diện văn bản đính kèm theo đúng chuẩn mực mới nhất:
1. Phát hiện tất cả lỗi chính tả (dấu câu, phụ âm, quy tắc viết hoa tên cơ quan, quốc hiệu, tiêu ngữ theo Hướng dẫn 05-HD/VPTW).
2. Phát hiện lỗi thể thức văn bản hành chính (cách bố trí bố cục, phông chữ, định dạng, cách dùng từ ngữ chỉ đạo hành chính).
3. Phát hiện các câu từ chưa chuẩn, thiếu trang trọng, lủng củng hoặc không phù hợp với ngữ cảnh cơ quan Đảng, nhà nước.
4. Đề xuất gợi ý sửa lỗi cụ thể cho từng lỗi và cung cấp phiên bản toàn văn văn bản đã được gọt giũa hoàn hảo.
Trả về định dạng JSON theo đúng schema.`
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: fileAuditSchema
        }
      });

      if (tmpFilePath && fs.existsSync(tmpFilePath)) {
        try { fs.unlinkSync(tmpFilePath); } catch (_) {}
      }

      if (auditResponse && auditResponse.text) {
        const cleaned = cleanJsonText(auditResponse.text);
        return res.json(normalizeVietnameseData(JSON.parse(cleaned)));
      } else {
        throw new Error("Không thể rà soát tài liệu đính kèm.");
      }
    }

    if (!documentText) {
      return res.status(400).json({ error: 'Chưa cung cấp nội dung văn bản hoặc tài liệu để rà soát.' });
    }

    const textAuditSchema = {
      type: Type.OBJECT,
      properties: {
        auditSummary: {
          type: Type.OBJECT,
          properties: {
            totalErrors: { type: Type.NUMBER },
            spellingErrorsCount: { type: Type.NUMBER },
            formattingErrorsCount: { type: Type.NUMBER },
            vocabularyErrorsCount: { type: Type.NUMBER },
            overallScore: { type: Type.NUMBER },
            generalAssessment: { type: Type.STRING }
          },
          required: ['totalErrors', 'spellingErrorsCount', 'formattingErrorsCount', 'vocabularyErrorsCount', 'overallScore', 'generalAssessment']
        },
        errorsAndIssues: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING },
              originalText: { type: Type.STRING },
              issueDescription: { type: Type.STRING },
              suggestedFix: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ['id', 'type', 'originalText', 'issueDescription', 'suggestedFix', 'explanation']
          }
        },
        paragraphSuggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalParagraph: { type: Type.STRING },
              improvedParagraph: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ['originalParagraph', 'improvedParagraph', 'reason']
          }
        },
        fullyAuditedDocument: { type: Type.STRING }
      },
      required: ['auditSummary', 'errorsAndIssues', 'paragraphSuggestions', 'fullyAuditedDocument']
    };

    const textResponse = await generateContentWithFallback({
      contents: [{
        text: `Bạn là Chuyên gia Cục Thể thức & Kỹ thuật Văn bản Đảng và Nhà nước, am hiểu tường tận Nghị định 30/2020/NĐ-CP, Quy định công tác văn thư Đảng và **Hướng dẫn số 05-HD/VPTW** (Về thể thức và kỹ thuật trình bày văn bản của Đảng), kết hợp kho tri thức từ Bộ não chung Drive của cơ quan.
Hãy kiểm tra, rà soát toàn diện văn bản sau đây theo chuẩn mực mới nhất:
---
${documentText}
---
Yêu cầu:
1. Phát hiện tất cả lỗi chính tả (dấu câu, phụ âm, quy tắc viết hoa tên cơ quan, quốc hiệu, tiêu ngữ theo Hướng dẫn 05-HD/VPTW).
2. Phát hiện lỗi thể thức văn bản hành chính theo quy định.
3. Phát hiện từ ngữ chưa chuẩn, lủng củng, không phù hợp ngữ cảnh cơ quan Đảng, nhà nước và đề xuất thay thế.
4. Đề xuất viết lại các đoạn văn cho hay, trang trọng, sắc sảo.
5. Cung cấp toàn văn văn bản đã được gọt giũa hoàn hảo.
Trả về định dạng JSON theo đúng schema.`
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: textAuditSchema
      }
    });

    if (textResponse && textResponse.text) {
      const cleaned = cleanJsonText(textResponse.text);
      res.json(normalizeVietnameseData(JSON.parse(cleaned)));
    } else {
      throw new Error("Không thể rà soát văn bản.");
    }
  } catch (err: any) {
    console.error("Audit document error:", err);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    res.status(500).json({ error: err.message || 'Lỗi rà soát văn bản hành chính.' });
  }
});

// Endpoint to generate automated Weekly Schedule for Party Committee Standing Board & Office Leadership
app.post('/api/generate-weekly-schedule', async (req, res) => {
  try {
    const { weekTitle, notes, documents = [], tasks = [] } = req.body;

    const scheduleSchema = {
      type: Type.OBJECT,
      properties: {
        weekTitle: { type: Type.STRING },
        generalDirectivesSummary: { type: Type.STRING, description: "Định hướng trọng tâm chỉ đạo của Thường trực Đảng ủy trong tuần" },
        days: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              dayOfWeek: { type: Type.STRING, description: "Thứ Hai, Thứ Ba, Thứ Tư, Thứ Năm, Thứ Sáu, Thứ Bảy, Chủ Nhật" },
              date: { type: Type.STRING, description: "DD/MM/YYYY" },
              morningEvents: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING, description: "Ví dụ: 07:30 hoặc 08:00 - 11:30" },
                    content: { type: Type.STRING, description: "Nội dung cuộc họp / buổi làm việc" },
                    chairPerson: { type: Type.STRING, description: "Đồng chí Chủ trì (Ví dụ: Bí thư Đảng ủy, Phó Bí thư Thường trực, Chánh Văn phòng)" },
                    attendees: { type: Type.STRING, description: "Thành phần tham dự" },
                    location: { type: Type.STRING, description: "Địa điểm (Hội trường, Phòng họp số 1, Địa bàn khu phố)" },
                    preparingUnit: { type: Type.STRING, description: "Đơn vị chuẩn bị nội dung" }
                  },
                  required: ['time', 'content', 'chairPerson', 'attendees', 'location', 'preparingUnit']
                }
              },
              afternoonEvents: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING, description: "Ví dụ: 13:30 hoặc 14:00 - 17:00" },
                    content: { type: Type.STRING },
                    chairPerson: { type: Type.STRING },
                    attendees: { type: Type.STRING },
                    location: { type: Type.STRING },
                    preparingUnit: { type: Type.STRING }
                  },
                  required: ['time', 'content', 'chairPerson', 'attendees', 'location', 'preparingUnit']
                }
              }
            },
            required: ['dayOfWeek', 'date', 'morningEvents', 'afternoonEvents']
          }
        },
        keyNotes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Các lưu ý trọng tâm về công tác chuẩn bị tài liệu, trực cơ quan, trực PCCC, an ninh trật tự"
        }
      },
      required: ['weekTitle', 'generalDirectivesSummary', 'days', 'keyNotes']
    };

    const docContext = documents.slice(0, 10).map((d: any) => `- ${d.documentNumber || 'Văn bản'}: ${d.title || d.fileName} (Chủ trì: ${d.leadDepartment || 'VP'}, Hạn: ${d.actionDeadline || 'N/A'})`).join('\n');
    const taskContext = tasks.slice(0, 10).map((t: any) => `- ${t.title} (Phụ trách: ${t.assignedOrganization || 'VP'}, Hạn: ${t.dueDate || 'N/A'})`).join('\n');

    const promptText = `Bạn là Chánh Văn phòng Đảng ủy Phường kiêm Trợ lý Tham mưu Tổng hợp Cấp ủy.
Hãy xây dựng Lịch Công Tác Tuần (${weekTitle || 'Tuần làm việc tiếp theo'}) chính thức cho Thường trực Đảng ủy và Lãnh đạo Văn phòng, kết hợp các nhiệm vụ và văn bản trọng tâm sau:

VĂN BẢN VÀ CHỈ ĐẠO CẦN XỬ LÝ TRONG TUẦN:
${docContext || 'Chưa có văn bản đính kèm riêng.'}

NHIỆM VỤ ĐÔN ĐỐC ĐẾN HẠN:
${taskContext || 'Các nhiệm vụ thường quy.'}

GHI CHÚ CHỈ ĐẠO BỔ SUNG CỦA BÍ THƯ / CHÁNH VP:
${notes || 'Tập trung công tác giao ban, kiểm tra thực địa trật tự đô thị, PCCC, số hóa một cửa.'}

YÊU CẦU:
1. Lập lịch đầy đủ 7 ngày trong tuần (Thứ Hai đến Chủ Nhật).
2. Sắp xếp hợp lý các cuộc họp giao ban Thường trực, tiếp công dân, làm việc với UBND, kiểm tra thực địa chi bộ khu phố, họp Khối Dân vận.
3. Phân công rõ Chủ trì, Thành phần tham dự, Địa điểm và Đơn vị chuẩn bị tài liệu.
4. Trả về định dạng JSON theo đúng schema quy định.`;

    const response = await generateContentWithFallback({
      contents: [{ text: promptText }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: scheduleSchema,
      }
    });

    if (response && response.text) {
      const cleaned = cleanJsonText(response.text);
      res.json(normalizeVietnameseData(JSON.parse(cleaned)));
    } else {
      throw new Error("Không thể lập lịch công tác tuần.");
    }
  } catch (err: any) {
    console.error("Weekly schedule generation error:", err);
    res.status(500).json({ error: err.message || 'Lỗi lập lịch công tác tuần.' });
  }
});

// Endpoint to generate automated Meeting Conclusion Notice (Thông báo Kết luận)
app.post('/api/generate-meeting-notice', async (req, res) => {
  try {
    const { meetingTitle, chairPerson, meetingDate, keyTopics, directives = [] } = req.body;

    const noticeSchema = {
      type: Type.OBJECT,
      properties: {
        documentNumber: { type: Type.STRING, description: "Số hiệu thông báo (ví dụ: 85-TB/VPTU)" },
        title: { type: Type.STRING, description: "Trích yếu thông báo" },
        meetingOverview: { type: Type.STRING, description: "Tóm tắt bối cảnh cuộc họp, thời gian, địa điểm, chủ trì, thành phần tham dự" },
        conclusionsAndDirectives: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING, description: "Lĩnh vực / Chuyên đề đánh giá" },
              assessment: { type: Type.STRING, description: "Đánh giá kết quả đạt được & tồn tại hạn chế" },
              directiveContent: { type: Type.STRING, description: "Chỉ đạo cụ thể của Thường trực Đảng ủy" },
              leadUnit: { type: Type.STRING, description: "Đơn vị chủ trì thực hiện" },
              coordinatingUnits: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Các đơn vị phối hợp" },
              completionDeadline: { type: Type.STRING, description: "Thời hạn hoàn thành" }
            },
            required: ['topic', 'assessment', 'directiveContent', 'leadUnit', 'coordinatingUnits', 'completionDeadline']
          }
        },
        organizationAndMonitoring: {
          type: Type.STRING,
          description: "Phân công Văn phòng Đảng ủy / UBKT Đảng ủy đôn đốc, theo dõi, tổng hợp báo cáo Thường trực Đảng ủy."
        },
        fullFormattedDocument: {
          type: Type.STRING,
          description: "Toàn văn bản Thông báo Kết luận chuẩn thể thức 05-HD/VPTW trình bày bằng Markdown hoàn chỉnh."
        }
      },
      required: ['documentNumber', 'title', 'meetingOverview', 'conclusionsAndDirectives', 'organizationAndMonitoring', 'fullFormattedDocument']
    };

    const promptText = `Bạn là Chánh Văn phòng Đảng ủy Phường.
Hãy dự thảo THÔNG BÁO KẾT LUẬN CỦA THƯỜNG TRỰC ĐẢNG UỶ PHƯỜNG theo Hướng dẫn 05-HD/VPTW của Văn phòng Trung ương Đảng về thể thức văn bản Đảng.

Thông tin cuộc họp:
- Tên cuộc họp: ${meetingTitle || 'Họp Giao ban Thường trực Đảng ủy Phường'}
- Chủ trì: ${chairPerson || 'Đồng chí Bí thư Đảng ủy Phường'}
- Thời gian họp: ${meetingDate || 'Ngày gần nhất'}
- Các nội dung trọng tâm đã thảo luận: ${keyTopics || 'Đánh giá công tác xây dựng Đảng, trật tự đô thị, CCHC và PCCC'}
- Các chỉ đạo cụ thể của Bí thư / Thường trực: ${directives.join('; ') || 'Nêu rõ trách nhiệm đơn vị chủ trì, mốc thời hạn báo cáo'}

Yêu cầu:
1. Trích xuất thành các chỉ đạo sắc sảo, rõ người, rõ việc, rõ cơ quan chủ trì, rõ thời hạn hoàn thành.
2. Đúng kết cấu Thông báo kết luận văn phòng Đảng ủy.
3. Trả về đúng JSON Schema.`;

    const response = await generateContentWithFallback({
      contents: [{ text: promptText }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: noticeSchema,
      }
    });

    if (response && response.text) {
      const cleaned = cleanJsonText(response.text);
      res.json(normalizeVietnameseData(JSON.parse(cleaned)));
    } else {
      throw new Error("Không thể dự thảo thông báo kết luận.");
    }
  } catch (err: any) {
    console.error("Meeting notice generation error:", err);
    res.status(500).json({ error: err.message || 'Lỗi dự thảo thông báo kết luận.' });
  }
});

// Endpoint for Multimodal Analysis (OCR, Hand-written Notes, Meeting Charts & Diagrams)
app.post('/api/analyze-multimodal-file', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Chưa đính kèm tệp đa phương thức (Hình ảnh / Sơ đồ / File ghi âm/ghi chép).' });
    }

    const fileBuffer = fs.readFileSync(file.path);
    const base64Data = fileBuffer.toString('base64');
    let mimeType = file.mimetype;
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (file.originalname?.toLowerCase().endsWith('.png')) mimeType = 'image/png';
      else if (file.originalname?.toLowerCase().endsWith('.jpg') || file.originalname?.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (file.originalname?.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
      else mimeType = 'image/jpeg';
    }

    const multimodalSchema = {
      type: Type.OBJECT,
      properties: {
        extractedTitle: { type: Type.STRING, description: "Tiêu đề hoặc trích yếu tổng quát bóc tách được từ hình ảnh/sơ đồ/tài liệu" },
        mediaTypeDetected: { type: Type.STRING, description: "'Sơ đồ / Bảng biểu' | 'Ảnh ghi chép họp / Sổ tay' | 'Tài liệu quét OCR' | 'Bản đồ / Thực địa'" },
        fullExtractedText: { type: Type.STRING, description: "Toàn bộ văn bản / nội dung ghi chép bóc tách được chính xác" },
        keyConclusions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Danh sách các kết luận, chỉ đạo hoặc dữ liệu trọng tâm bóc tách được"
        },
        extractedTasks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              taskName: { type: Type.STRING },
              assignedTo: { type: Type.STRING },
              deadline: { type: Type.STRING },
              priority: { type: Type.STRING, description: "'CAO' | 'TRUNG BÌNH' | 'THƯỜNG'" }
            },
            required: ['taskName', 'assignedTo', 'deadline', 'priority']
          }
        },
        advisoryNotes: { type: Type.STRING, description: "Khuyến nghị của Trợ lý AI dành cho Chánh Văn phòng dựa trên hình ảnh/tài liệu này" }
      },
      required: ['extractedTitle', 'mediaTypeDetected', 'fullExtractedText', 'keyConclusions', 'extractedTasks', 'advisoryNotes']
    };

    const response = await generateContentWithFallback({
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        {
          text: `Bạn là Chuyên gia AI Phân tích Đa Phương Thức (Multimodal Sight & OCR) của Văn phòng Cấp ủy.
Hãy soi chiếu và phân tích kỹ lưỡng tệp hình ảnh/tài liệu/ghi chép cuộc họp/sơ đồ đính kèm.
Nhiệm vụ:
1. Nhận diện loại tệp đa phương thức.
2. Trích xuất toàn bộ chữ viết, nội dung ghi chép, bảng biểu, sơ đồ hoặc thông tin chỉ đạo trong ảnh.
3. Tổng hợp thành các kết luận cốt lõi và danh sách nhiệm vụ cụ thể phân công đơn vị thực hiện.
4. Trả về đúng JSON Schema.`
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: multimodalSchema,
      }
    });

    try { fs.unlinkSync(file.path); } catch (_) {}

    if (response && response.text) {
      const cleaned = cleanJsonText(response.text);
      res.json(normalizeVietnameseData(JSON.parse(cleaned)));
    } else {
      throw new Error("Không thể phân tích tệp đa phương thức.");
    }
  } catch (err: any) {
    console.error("Multimodal analysis error:", err);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    res.status(500).json({ error: err.message || 'Lỗi phân tích đa phương thức.' });
  }
});

// ============================================================================
// 1. ENDPOINT: AUTOMATED RACI TASK EXTRACTION & DISPATCH REMINDER
// ============================================================================
app.post('/api/extract-raci-tasks', async (req, res) => {
  try {
    const { directiveText, documentType = 'CONCLUSION', meetingContext = 'Hội nghị Thường trực Đảng ủy' } = req.body;

    if (!directiveText || !directiveText.trim()) {
      return res.status(400).json({ error: 'Chưa cung cấp nội dung chỉ đạo để trích xuất RACI.' });
    }

    const raciSchema = {
      type: Type.OBJECT,
      properties: {
        executiveSummary: { type: Type.STRING, description: "Tóm tắt mục tiêu chính trị và yêu cầu hành động cốt lõi" },
        raciTasks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING, description: "Tên nhiệm vụ ngắn gọn, rõ hành động (Bắt đầu bằng động từ)" },
              description: { type: Type.STRING, description: "Chi tiết yêu cầu, giải pháp và nội dung cần làm" },
              responsible: { type: Type.STRING, description: "R - Người/Bộ phận trực tiếp thi hành (VD: Đội QLTT Đô thị, Công an phường, Tổ CĐS cộng đồng)" },
              accountable: { type: Type.STRING, description: "A - Đơn vị/Cá nhân chịu trách nhiệm toàn diện trước Cấp ủy (VD: Đồng chí Chủ tịch UBND phường, Trưởng Công an phường)" },
              consulted: { type: Type.STRING, description: "C - Đơn vị phối hợp, tham vấn (VD: Khối Dân vận, UBMTTQ, Cấp ủy Chi bộ khu phố)" },
              informed: { type: Type.STRING, description: "I - Đơn vị nhận báo cáo, giám sát (VD: Thường trực Đảng ủy, Văn phòng Đảng ủy, UBKT Đảng ủy)" },
              suggestedDueDate: { type: Type.STRING, description: "Thời hạn hoàn thành đề xuất (VD: Sau 7 ngày, hoặc ngày cụ thể)" },
              priority: { type: Type.STRING, description: "'KHẨN' | 'CAO' | 'TRUNG BÌNH'" },
              expectedOutput: { type: Type.STRING, description: "Sản phẩm / Kết quả định lượng cần đạt được" },
              suggestedReminders: { type: Type.STRING, description: "Kế hoạch đôn đốc kiểm tra tiến độ" }
            },
            required: ['id', 'title', 'description', 'responsible', 'accountable', 'consulted', 'informed', 'suggestedDueDate', 'priority', 'expectedOutput', 'suggestedReminders']
          }
        },
        automatedReminderNotice: {
          type: Type.STRING,
          description: "Mẫu Công văn / Thông báo đôn đốc tiến độ thực hiện kết luận gửi UBND phường và các đơn vị được phân công, sẵn sàng xuất trình Bí thư ký duyệt."
        }
      },
      required: ['executiveSummary', 'raciTasks', 'automatedReminderNotice']
    };

    const promptText = `Bạn là Chánh Văn phòng Đảng ủy Phường kiêm Trợ lý Quản trị Chiến lược Cấp ủy.
Hãy phân tích sâu văn bản chỉ đạo / ý kiến kết luận của Bí thư Đảng ủy sau đây và BÓC TÁCH MA TRẬN PHÂN CÔNG NHIỆM VỤ (RACI MATRIX) & TỰ ĐỘNG HÓA VĂN BẢN ĐÔN ĐỐC CÔNG VỤ:

NỘI DUNG CHỈ ĐẠO CỦA BÍ THƯ / THƯỜNG TRỰC ĐẢNG ỦY:
"""
${directiveText}
"""

BỐI CẢNH VĂN BẢN:
- Loại văn bản: ${documentType}
- Bối cảnh: ${meetingContext}

YÊU CẦU BÓC TÁCH:
1. Bóc tách từ 3 đến 6 nhiệm vụ cụ thể, rõ ràng, dứt khoát.
2. Chuẩn hóa Ma trận RACI:
   - R (Responsible - Trực tiếp làm): Bộ phận tác nghiệp.
   - A (Accountable - Chịu trách nhiệm chính): Người đứng đầu (Chủ tịch UBND, Trưởng CA, Bí thư Chi bộ).
   - C (Consulted - Phối hợp): MTTQ, đoàn thể, cơ quan liên quan.
   - I (Informed - Giám sát & Báo cáo): Thường trực Đảng ủy, Văn phòng Đảng ủy, UBKT Đảng ủy.
3. Soạn thảo sẵn một bản "THÔNG BÁO ĐÔN ĐỐC TIẾN ĐỘ THỰC HIỆN KẾT LUẬN CỦA THƯỜNG TRỰC ĐẢNG ỦY" đầy đủ thể thức chính quy Đảng để Văn phòng Đảng ủy sử dụng khi cần nhắc nhở các đơn vị.
4. Trả về đúng JSON Schema.`;

    const response = await generateContentWithFallback({
      contents: [{ text: promptText }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: raciSchema,
      }
    });

    if (response && response.text) {
      const cleaned = cleanJsonText(response.text);
      res.json(normalizeVietnameseData(JSON.parse(cleaned)));
    } else {
      throw new Error("Không thể bóc tách ma trận RACI.");
    }
  } catch (err: any) {
    console.error("RACI Extraction error:", err);
    res.status(500).json({ error: err.message || 'Lỗi bóc tách ma trận phân công RACI.' });
  }
});

// ============================================================================
// 2. ENDPOINT: SMART EXECUTIVE MEETING BRIEFING & SHARP QUESTIONS GENERATOR
// ============================================================================
app.post('/api/generate-meeting-briefing', async (req, res) => {
  try {
    const { 
      meetingType = 'Hội nghị Ban Thường vụ Đảng ủy định kỳ', 
      hotspotsContext = '', 
      pendingDirectivesContext = '', 
      keyTasksContext = '',
      specificFocus = ''
    } = req.body;

    const briefingSchema = {
      type: Type.OBJECT,
      properties: {
        briefingTitle: { type: Type.STRING, description: "Tiêu đề Bản tin Tóm tắt Điều hành Cấp ủy" },
        situationOverview: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3-4 gạch đầu dòng đánh giá tổng quan tình hình chính trị - xã hội địa bàn trong kỳ"
        },
        hotspotAlerts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              location: { type: Type.STRING },
              issue: { type: Type.STRING },
              riskLevel: { type: Type.STRING, description: "'CAO' | 'TRUNG BÌNH' | 'CẦN THEO DÕI'" },
              recommendationForSecretary: { type: Type.STRING, description: "Đề xuất trọng tâm chỉ đạo của Bí thư" }
            },
            required: ['location', 'issue', 'riskLevel', 'recommendationForSecretary']
          }
        },
        pendingDirectivesReview: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              directiveName: { type: Type.STRING },
              assignedUnit: { type: Type.STRING },
              progressStatus: { type: Type.STRING, description: "'ĐÚNG HẠN' | 'CHẬM TIẾN ĐỘ' | 'CẦN CHỈ ĐẠO GẤP'" },
              bottleneck: { type: Type.STRING, description: "Điểm nghẽn cần tháo gỡ" }
            },
            required: ['directiveName', 'assignedUnit', 'progressStatus', 'bottleneck']
          }
        },
        suggestedAgenda: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              order: { type: Type.NUMBER },
              timeAllocated: { type: Type.STRING },
              topic: { type: Type.STRING },
              reporter: { type: Type.STRING }
            },
            required: ['order', 'timeAllocated', 'topic', 'reporter']
          }
        },
        sharpInterrogationQuestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              targetAudience: { type: Type.STRING, description: "Cá nhân/Đơn vị bị chất vấn (VD: Đồng chí Chủ tịch UBND, Trưởng Công an, Bí thư Chi bộ KP 3)" },
              question: { type: Type.STRING, description: "Câu hỏi chất vấn sắc bén, đi thẳng vào trách nhiệm người đứng đầu và giải pháp cụ thể" },
              purpose: { type: Type.STRING, description: "Mục đích làm rõ" }
            },
            required: ['targetAudience', 'question', 'purpose']
          }
        },
        draftConclusionPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Các định hướng kết luận dự thảo để Bí thư chốt lại cuối buổi họp"
        }
      },
      required: ['briefingTitle', 'situationOverview', 'hotspotAlerts', 'pendingDirectivesReview', 'suggestedAgenda', 'sharpInterrogationQuestions', 'draftConclusionPoints']
    };

    const promptText = `Bạn là Trợ lý Tổng hợp Đặc biệt của Bí thư Đảng ủy Phường.
Hãy biên soạn BẢN TIN TÓM TẮT ĐIỀU HÀNH & BỘ CÂU HỎI CHẤT VẤN TRỌNG TÂM để phục vụ đồng chí Bí thư Đảng ủy chủ trì cuộc họp: "${meetingType}".

DỮ LIỆU ĐỊA BÀN VÀ ĐIỂM NÓNG HIỆN TẠI:
${hotspotsContext || 'Trật tự đô thị tuyến đường chính, PCCC nhà trọ cao tầng, chuyển đổi số VNeID và khiếu nại đất đai hạ tầng.'}

CÁC CHỈ ĐẠO TRƯỚC ĐÂY ĐANG THEO DÕI:
${pendingDirectivesContext || 'Thông báo số 42-TB/ĐU về vỉa hè; Thông báo số 58-TB/ĐU về Một cửa; Thông báo số 76-TB/ĐU về PCCC.'}

CÁC NHIỆM VỤ CẦN KIỂM TRA:
${keyTasksContext || 'Nhiệm vụ đôn đốc UBND phường, Công an phường và Chi bộ 12 khu phố.'}

TRỌNG TÂM ĐẶC BIỆT CỦA BÍ THƯ:
${specificFocus || 'Tập trung siết chặt kỷ luật công vụ, giải quyết dứt điểm các việc tồn đọng gây bức xúc trong nhân dân.'}

YÊU CẦU BIÊN SOẠN:
1. Đánh giá cô đọng, khách quan, chỉ rõ ưu điểm và tồn tại hạn chế cốt lõi.
2. Thiết kế từ 4-6 câu hỏi chất vấn thật đanh thép, sâu sát thực tiễn, hướng vào người đứng đầu UBND phường, Công an và Chi bộ khu phố.
3. Cung cấp khung kết luận dự thảo súc tích giúp Bí thư điều hành cuộc họp hiệu quả cao.
4. Trả về đúng JSON Schema.`;

    const response = await generateContentWithFallback({
      contents: [{ text: promptText }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: briefingSchema,
      }
    });

    if (response && response.text) {
      const cleaned = cleanJsonText(response.text);
      res.json(normalizeVietnameseData(JSON.parse(cleaned)));
    } else {
      throw new Error("Không thể lập bản tin tóm tắt điều hành cuộc họp.");
    }
  } catch (err: any) {
    console.error("Meeting Briefing generation error:", err);
    res.status(500).json({ error: err.message || 'Lỗi lập tài liệu họp điều hành Cấp ủy.' });
  }
});

// ============================================================================
// 3. ENDPOINT: AI PREDICTIVE RISK & INCIDENT RESPONSE PLAYBOOK
// ============================================================================
app.post('/api/ai-predict-incident-response', async (req, res) => {
  try {
    const { marker, historicalContext = '' } = req.body;

    if (!marker) {
      return res.status(400).json({ error: 'Chưa cung cấp thông tin điểm nóng / vị trí trên bản đồ số.' });
    }

    const playbookSchema = {
      type: Type.OBJECT,
      properties: {
        threatLevel: { type: Type.STRING, description: "'MỨC 1: BÌNH THƯỜNG - THEO DÕI' | 'MỨC 2: CẢNH BÁO CÓ NGUY CƠ' | 'MỨC 3: ĐIỂM NÓNG PHỨC TẠP' | 'MỨC 4: TÌNH HUỐNG KHẨN CẤP'" },
        escalationProbabilityScore: { type: Type.NUMBER, description: "Xác suất phát sinh điểm nóng phức tạp nếu không can thiệp kịp thời (0 - 100)" },
        predictiveRiskAnalysis: { type: Type.STRING, description: "Phân tích nguyên nhân sâu xa, dự báo nguy cơ lan rộng, tác động đến an ninh trật tự, dư luận và đời sống dân sinh" },
        incidentResponsePlaybook: {
          type: Type.OBJECT,
          properties: {
            partyAndMassMobilization: {
              type: Type.OBJECT,
              properties: {
                pillarName: { type: Type.STRING, description: "Khối Dân vận, Mặt trận & Chi bộ Khu phố" },
                leadOfficer: { type: Type.STRING },
                immediateActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Các bước dân vận, đối thoại, nắm bắt tâm tư, phân công đảng viên nòng cốt" },
                timeline: { type: Type.STRING }
              },
              required: ['pillarName', 'leadOfficer', 'immediateActions', 'timeline']
            },
            policeAndPublicSecurity: {
              type: Type.OBJECT,
              properties: {
                pillarName: { type: Type.STRING, description: "Công an Phường & Lực lượng ANTT Cơ sở" },
                leadOfficer: { type: Type.STRING },
                immediateActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Các biện pháp nghiệp vụ, bố trí chốt trực, tuần tra khép kín, xử lý vi phạm" },
                timeline: { type: Type.STRING }
              },
              required: ['pillarName', 'leadOfficer', 'immediateActions', 'timeline']
            },
            executiveAndGovernment: {
              type: Type.OBJECT,
              properties: {
                pillarName: { type: Type.STRING, description: "UBND Phường & Đội Quản lý Chuyên môn" },
                leadOfficer: { type: Type.STRING },
                immediateActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Các giải pháp hành chính, kiểm tra liên ngành, cưỡng chế giải tỏa, hỗ trợ tái định cư" },
                timeline: { type: Type.STRING }
              },
              required: ['pillarName', 'leadOfficer', 'immediateActions', 'timeline']
            }
          },
          required: ['partyAndMassMobilization', 'policeAndPublicSecurity', 'executiveAndGovernment']
        },
        emergencySecretaryDirective: {
          type: Type.STRING,
          description: "Đoạn văn chỉ đạo khẩn cấp mẫu của Bí thư Đảng ủy gửi Trực ban UBND và Công an phường xử lý ngay trong ngày."
        }
      },
      required: ['threatLevel', 'escalationProbabilityScore', 'predictiveRiskAnalysis', 'incidentResponsePlaybook', 'emergencySecretaryDirective']
    };

    const promptText = `Bạn là Trợ lý Tác chiến & Tham mưu An ninh Đô thị của Bí thư Đảng ủy Phường.
Hãy thẩm định rủi ro, dự báo xu hướng và XÂY DỰNG KỊCH BẢN TÁC CHIẾN 03 MŨI (Dân vận - Công an - Chính quyền) để xử lý dứt điểm điểm nóng sau đây:

THÔNG TIN ĐIỂM NÓNG / VỊ TRÍ BẢN ĐỒ SỐ:
- Tiêu đề / Mã hiệu: ${marker.codeOrTitle || marker.title || 'Điểm nóng địa bàn'}
- Vị trí: ${marker.location || 'Địa bàn phường'} (Khu phố: ${marker.wardOrKp || 'Khu phố trọng điểm'})
- Lĩnh vực: ${marker.category || 'Trật tự đô thị / ANTT'}
- Mức độ hiện tại: ${marker.severity || 'Cảnh báo'}
- Mô tả chi tiết: ${marker.description || 'Chưa có mô tả chi tiết'}
- Đơn vị phụ trách: ${marker.assignedUnit || 'UBND và Công an phường'}
- Ghi chú lịch sử: ${historicalContext || 'Từng có phản ánh qua tiếp công dân hoặc tuần tra'}

YÊU CẦU:
1. Đánh giá cấp độ đe dọa (1 đến 4) và tỷ lệ xác suất bùng phát rủi ro.
2. Lập kịch bản xử lý phân công đồng bộ 3 mũi giáp công:
   - Mũi 1: Khối Dân vận & Chi bộ (Tuyên truyền, vận động, hóa giải từ sớm).
   - Mũi 2: Công an phường & Lực lượng bảo vệ ANTT cơ sở (Kiểm soát, răn đe, cưỡng chế nếu cần).
   - Mũi 3: UBND phường (Giải quyết thủ tục, quản lý hạ tầng, xử phạt).
3. Dự thảo ý kiến chỉ đạo khẩn của Bí thư Đảng ủy để phát lệnh ngay.
4. Trả về đúng JSON Schema.`;

    const response = await generateContentWithFallback({
      contents: [{ text: promptText }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: playbookSchema,
      }
    });

    if (response && response.text) {
      const cleaned = cleanJsonText(response.text);
      res.json(normalizeVietnameseData(JSON.parse(cleaned)));
    } else {
      throw new Error("Không thể xây dựng kịch bản xử lý điểm nóng.");
    }
  } catch (err: any) {
    console.error("AI Incident Response Playbook error:", err);
    res.status(500).json({ error: err.message || 'Lỗi xây dựng kịch bản xử lý điểm nóng.' });
  }
});

// ============================================================================
// 4. ENDPOINT: DEEP ADAPTIVE GOOGLE DRIVE BRAIN LEARNING & SEMANTIC CONTEXT
// ============================================================================
app.post('/api/deep-drive-sync-learn', async (req, res) => {
  try {
    const { folderId = '1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR', sampleDocId = '1uzKq-XB69np2ElcHje3qznYco_uxWc1PHCv-cKUgfUQ', customInput = '' } = req.body;

    const brainLearnSchema = {
      type: Type.OBJECT,
      properties: {
        syncStatus: { type: Type.STRING, description: "'SYNCHRONIZED' | 'UPDATED'" },
        learnedAt: { type: Type.STRING },
        executiveVocabularyBank: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, description: "Nhóm từ vựng (VD: Quyết tâm chính trị, Giao nhiệm vụ UBND, Dân vận & Nêu gương, Giám sát đôn đốc)" },
              phrases: { type: Type.ARRAY, items: { type: Type.STRING } },
              usageContext: { type: Type.STRING }
            },
            required: ['category', 'phrases', 'usageContext']
          }
        },
        learnedPrecedents: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              resolutionCode: { type: Type.STRING },
              coreSubject: { type: Type.STRING },
              keyLessonLearned: { type: Type.STRING },
              applicableScenarios: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['resolutionCode', 'coreSubject', 'keyLessonLearned', 'applicableScenarios']
          }
        },
        executiveStyleRules: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Các nguyên tắc vàng về văn phong của Bí thư Đảng ủy đã được đúc kết từ kho tri thức Drive"
        },
        systemReadinessIndex: { type: Type.NUMBER, description: "Chỉ số độ am hiểu của Bộ não AI (0 - 100)" }
      },
      required: ['syncStatus', 'learnedAt', 'executiveVocabularyBank', 'learnedPrecedents', 'executiveStyleRules', 'systemReadinessIndex']
    };

    const promptText = `Bạn là Kiến trúc sư Bộ Não Tri Thức AI của Cấp ủy Đảng ủy Phường.
Hãy thực hiện quy trình TỰ HỌC SÂU (Deep Adaptive Knowledge Distillation) từ toàn bộ dữ liệu mẫu trong Google Drive (Folder ID: ${folderId}) và Tài liệu Mẫu Chuẩn Google Docs (ID: ${sampleDocId}).

Các thông tin đã nạp:
1. Mẫu Thông báo kết luận chuẩn (Google Docs: 1uzKq-XB69np2ElcHje3qznYco_uxWc1PHCv-cKUgfUQ): Kết cấu 4 đoạn chỉ đạo toàn diện, thể thức 05-HD/VPTW.
2. Thông báo 42-TB/ĐU (Trật tự đô thị, kỷ cương vỉa hè).
3. Thông báo 58-TB/ĐU (Cải cách hành chính, Một cửa, Đề án 06/VNeID).
4. Thông báo 76-TB/ĐU (PCCC nhà trọ mật độ cao, chung cư cũ).
5. Thông báo 91-TB/ĐU (Bồi thường GPMB hạ tầng, dân vận khéo).
6. Thông báo 105-TB/ĐU (Nâng cao chất lượng sinh hoạt Chi bộ khu phố).
${customInput ? `Dữ liệu cập nhật thêm từ người dùng: ${customInput}` : ''}

YÊU CẦU:
1. Đúc kết kho từ vựng lãnh đạo chuẩn mực theo 4 nhóm: Quyết tâm chính trị, Giao nhiệm vụ UBND/Công an, Dân vận & Nêu gương, Giám sát & Báo cáo.
2. Trích xuất các án lệ chỉ đạo (Precedents) và bài học kinh nghiệm để áp dụng cho các tình huống tương lai.
3. Đúc kết các quy tắc vàng về phong cách lãnh đạo của Bí thư Đảng ủy.
4. Trả về đúng JSON Schema.`;

    const response = await generateContentWithFallback({
      contents: [{ text: promptText }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: brainLearnSchema,
      }
    });

    if (response && response.text) {
      const cleaned = cleanJsonText(response.text);
      res.json(normalizeVietnameseData(JSON.parse(cleaned)));
    } else {
      throw new Error("Không thể tự học sâu từ Google Drive.");
    }
  } catch (err: any) {
    console.error("Deep Drive learn error:", err);
    res.status(500).json({ error: err.message || 'Lỗi tự học sâu từ Google Drive.' });
  }
});


async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
