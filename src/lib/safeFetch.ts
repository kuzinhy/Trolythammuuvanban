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
    const contentType = res.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.warn(`[safeFetchJson] Non-JSON response received from ${input} (Status: ${res.status}):`, text.slice(0, 150));
      
      let msg = `Máy chủ phản hồi không đúng chuẩn JSON (HTTP ${res.status}).`;
      if (res.status === 404) {
        msg = `API không tồn tại hoặc Vercel chưa định tuyến Backend Serverless (/api). HTTP 404.`;
      } else if (res.status >= 500) {
        msg = `Máy chủ backend báo lỗi nội bộ (HTTP ${res.status}).`;
      }

      return {
        ok: false,
        status: res.status,
        error: msg
      };
    }

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: data?.error || `Yêu cầu xử lý thất bại (HTTP ${res.status})`
      };
    }

    return {
      ok: true,
      status: res.status,
      data
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
