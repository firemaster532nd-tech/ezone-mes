const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? '/api';
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...authHeader() };
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
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
