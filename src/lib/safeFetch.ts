export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(input, init);
    const text = await res.text();

    // 1. Try parsing JSON first regardless of Content-Type header
    let parsedData: any = null;
    let isJson = false;

    if (text && text.trim()) {
      const trimmed = text.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          parsedData = JSON.parse(trimmed);
          isJson = true;
        } catch (_) {
          isJson = false;
        }
      }
    }

    if (isJson && parsedData !== null) {
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data: parsedData,
          error: parsedData?.error || parsedData?.message || `Yêu cầu xử lý thất bại (HTTP ${res.status})`
        };
      }
      return {
        ok: true,
        status: res.status,
        data: parsedData
      };
    }

    // 2. Handle HTML or non-JSON responses (e.g. SPA fallback index.html for unhandled API routes)
    const lowerText = text.toLowerCase();
    const isHtml = lowerText.includes('<!doctype') || lowerText.includes('<html');

    if (isHtml) {
      console.warn(`[safeFetchJson] HTML response received from ${input} (Status: ${res.status}). Likely SPA fallback for missing endpoint.`);
      return {
        ok: false,
        status: res.status === 200 ? 404 : res.status,
        error: `Đường dẫn API không khả dụng hoặc bị điều hướng về trang giao diện HTML (HTTP ${res.status}).`
      };
    }

    if (!res.ok) {
      let msg = `Máy chủ báo lỗi (HTTP ${res.status}).`;
      if (res.status === 404) {
        msg = `Đường dẫn API không tồn tại (HTTP 404).`;
      } else if (res.status >= 500) {
        msg = `Máy chủ backend báo lỗi nội bộ (HTTP ${res.status}).`;
      }
      return {
        ok: false,
        status: res.status,
        error: msg
      };
    }

    // HTTP 200 but text is non-JSON
    console.warn(`[safeFetchJson] Non-JSON response received from ${input} (Status: 200):`, text.slice(0, 150));
    return {
      ok: false,
      status: 200,
      error: `Phản hồi từ máy chủ không thuộc định dạng JSON chuẩn (HTTP 200).`
    };

  } catch (err: any) {
    console.error(`[safeFetchJson Exception] ${input}:`, err);
    return {
      ok: false,
      status: 0,
      error: err?.message || 'Không thể kết nối tới hệ thống máy chủ.'
    };
  }
}

