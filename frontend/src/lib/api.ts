const API_BASE = '/api';

const TOKEN_KEY = 'ezone_mes_token';

class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API Error ${status}`);
  }
}

function authHeader(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/**
 * Vercel cold start 대응: 500/503/504 에러 자동 재시도
 * Cold start 시간이 최대 25초이므로 최대 2회 재시도 (5초, 10초 간격)
 */
async function requestWithRetry<T>(path: string, options?: RequestInit, retryCount = 0): Promise<T> {
  const headers: Record<string, string> = { ...authHeader() };
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  // Cold start 관련 에러: 500/503/504 → 재시도 (최대 2회, 5초 간격)
  if ((res.status === 500 || res.status === 503 || res.status === 504) && retryCount < 2) {
    const delay = (retryCount + 1) * 5000; // 5s, 10s
    console.warn(`[API] ${res.status} 응답 — ${delay / 1000}초 후 재시도 (${retryCount + 1}/2)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return requestWithRetry<T>(path, options, retryCount + 1);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 401) {
      // token expired or invalid — clear so user is redirected to login
      localStorage.removeItem(TOKEN_KEY);
    }
    throw new ApiError(res.status, body);
  }
  return res.json();
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  return requestWithRetry<T>(path, options, 0);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
  /** multipart/form-data 파일 업로드 (Content-Type 자동 설정) */
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { ...authHeader() },
      body: formData,
    });
    if (!res.ok) {
      throw new ApiError(res.status, await res.json().catch(() => null));
    }
    return res.json();
  },
};
