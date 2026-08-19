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
    const defaultFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1XqI-PetoZDvUiGEDiqnT25-4t1qonbIY';
    const targetFolderId = req.body.folderId || defaultFolderId;

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
          description: "Thời hạn xử lý / Hạn báo cáo đề xuất (nếu có trong văn bản hoặc theo quy chế)"
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
        }
      },
      required: ['topics', 'organizations', 'persons', 'deadlines', 'requirements', 'coordinatingDepartments', 'keyDirectives', 'legalBasis', 'extractedTextKeywords']
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

Quy tắc tham mưu phân luồng hành chính:
1. Nếu văn bản thuộc thẩm quyền Cấp ủy / Ban Thường vụ / Thường trực Tỉnh ủy, Thành ủy (các vấn đề chủ trương lớn, quy hoạch, nhân sự, an ninh chính trị, phòng chống tham nhũng, nghị quyết TW): Đề xuất phân luồng là "Báo cáo Ban Thường vụ Tỉnh ủy/Thành ủy" hoặc "Trình Thường trực xem xét, cho ý kiến chỉ đạo".
2. Nếu văn bản thuộc điều hành phát triển KTXH, dự án, ngân sách của cơ quan hành chính: Đề xuất "Chuyển Thường trực UBND / Ban Cán sự đảng UBND" và "Giao Sở/Ngành chuyên môn chủ trì (Sở KH&ĐT, Sở Tài chính, Sở TN&MT, Văn phòng...) phối hợp các đơn vị liên quan tham mưu dự thảo".
3. Ý kiến tham mưu (advisoryOpinion) phải viết chuẩn ngôn ngữ hành chính: Nêu rõ tóm tắt tính chất văn bản -> Đề xuất lãnh đạo phân công ai/đơn vị nào chủ trì -> Nhiệm vụ cụ thể -> Thời hạn báo cáo lãnh đạo.
4. Trích xuất chính xác số hiệu, ngày ban hành, cơ quan ký, các mốc thời hạn. Trả về đúng JSON Schema.`
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
      res.status(500).json({ error: result.driveError || 'Tải lên Google Drive thất bại' });
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

// General Chat / Advice endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Danh sách tin nhắn không hợp lệ' });
    }

    const conversationHistory = messages
      .map(m => `${m.role === 'user' ? 'Cán bộ' : 'Trợ lý Tham mưu'}: ${m.content}`)
      .join('\n\n');

    const promptText = `Bạn là Trợ lý AI Tham mưu & Xử lý Văn bản Cấp ủy và Chính quyền địa phương.
Hãy hỗ trợ chuyên viên, chánh văn phòng và lãnh đạo một cách chuyên nghiệp, chính xác theo quy định Đảng và thể thức Nhà nước (Nghị định 30/2020/NĐ-CP).

Nội dung hội thoại:
${conversationHistory}

Hãy đưa ra câu trả lời trực tiếp, cô đọng, hữu ích, chia đề mục rõ ràng nếu cần thiết:`;

    const response = await generateContentWithFallback({
      contents: promptText,
    });

    const reply = (response && response.text) ? response.text.normalize('NFC') : 'Tôi đã tiếp nhận yêu cầu. Đồng chí vui lòng đặt câu hỏi cụ thể hơn.';
    res.json({ reply });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Xử lý trao đổi thất bại. Vui lòng thử lại sau giây lát.' });
  }
});

// Google Drive Config & Status endpoint
app.get('/api/drive/config', (req, res) => {
  const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1XqI-PetoZDvUiGEDiqnT25-4t1qonbIY';
  res.json({
    folderId,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    isConfigured: true
  });
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

// Endpoint to draft complete Party Secretary directives (Tham mưu Chỉ đạo)
app.post('/api/draft-directive', async (req, res) => {
  try {
    const { idea, stylePreference, matchedResolutions } = req.body;
    if (!idea) {
      return res.status(400).json({ error: 'Thiếu ý kiến, ý tưởng hoặc nhiệm vụ chỉ đạo nguồn.' });
    }

    const draftSchema = {
      type: Type.OBJECT,
      properties: {
        option1: {
          type: Type.STRING,
          description: "Phương án chỉ đạo 1: Tập trung vào tính Cương quyết, Quyết liệt hành động, phân rõ người, rõ trách nhiệm, rõ thời gian hoàn thành (Đúng thể thức và lối văn hành văn chỉ đạo của Bí thư Đảng ủy phường)."
        },
        option2: {
          type: Type.STRING,
          description: "Phương án chỉ đạo 2: Tập trung vào tính Động viên, Vận động quần chúng, Dân vận khéo, khích lệ và kêu gọi sự đồng thuận, hướng dẫn sâu sát để quần chúng cùng cán bộ tự giác phấn đấu hoàn thành."
        },
        styleDescription1: {
          type: Type.STRING,
          description: "Mô tả ngắn gọn về văn phong của Phương án 1."
        },
        styleDescription2: {
          type: Type.STRING,
          description: "Mô tả ngắn gọn về văn phong của Phương án 2."
        }
      },
      required: ['option1', 'option2', 'styleDescription1', 'styleDescription2']
    };

    const promptText = `Bạn là Bí thư Đảng ủy phường nhiều năm kinh nghiệm, am hiểu sâu sắc thể thức văn bản lãnh đạo của Đảng (Kết luận hội nghị, Nghị quyết chuyên đề, Thông báo ý kiến chỉ đạo).
Nhiệm vụ: Căn cứ vào ý tưởng/nhiệm vụ chỉ đạo thô sau:
"${idea}"

${stylePreference ? `Lưu ý đặc biệt: Người dùng đã chọn phong cách ưa thích trước đó là: "${stylePreference}". Hãy định hình văn phong bám sát hơn với thiên hướng này.` : ''}
${matchedResolutions && matchedResolutions.length > 0 ? `Lưu ý pháp lý: Bản chỉ đạo cần bám sát tinh thần và chủ trương của các Nghị quyết cấp trên sau: "${matchedResolutions.join(', ')}".` : ''}

YÊU CẦU QUAN TRỌNG:
1. Viết cực kỳ ngắn gọn, súc tích, đi thẳng vào trọng tâm chỉ đạo (Mỗi phương án chỉ khoảng 3-4 câu ngắn, sắc bén, lược bỏ hoàn toàn các câu từ rườm rà, sáo rỗng).
2. Thể hiện rõ vai trò, vị thế lãnh đạo trực tiếp của Bí thư Đảng ủy phường ("Đảng ủy phường yêu cầu...", "Bí thư Đảng ủy giao...", "Thường trực Đảng ủy chỉ đạo...").
3. Thể thức ngôn từ chuẩn xác, hành động, rõ nhiệm vụ cho UBND phường và ban ngành đoàn thể phối hợp.

Hãy chuyển hóa ý tưởng/nhiệm vụ thô thành 2 phương án gọn gàng:
- Phương án 1 (Quyết liệt hành động, kiểm tra nghiêm minh): Giao trực tiếp, rõ người, rõ việc, xác định rõ thời hạn hoàn thành, nhấn mạnh vai trò người đứng đầu, kỷ cương đảng bộ.
- Phương án 2 (Dân vận khéo, chính trị tư tưởng): Tập trung vận động quần chúng nhân dân đồng thuận, công tác tư tưởng chính trị đi trước, phát huy gương mẫu đảng viên và sự phối hợp đồng bộ giữa chính quyền - đoàn thể.`;

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
