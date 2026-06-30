import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { indexByMenuCode, type Permission, type Action } from './permissions';

export interface User {
  worker_id: number;
  employee_no: string;
  worker_name: string;
  role: 'admin' | 'manager' | 'worker';
  dept_id: number | null;
  dept_code?: string | null;
  dept_name?: string | null;
  position?: string | null;
  email?: string | null;
  must_change_pw?: boolean;
  allowed_modes?: 'shop' | 'both'; // 'shop'=실무만, 'both'=실무+관리 모두
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  permissions: Permission[];
  permMap: Map<string, Permission>;
  loading: boolean;
  login: (employee_no: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  can: (menu_code: string, action: Action) => boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const TOKEN_KEY = 'ezone_mes_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(!!token);

  const permMap = useMemo(() => indexByMenuCode(permissions), [permissions]);

  const refreshMe = useCallback(async () => {
    if (!token) { setUser(null); setPermissions([]); setLoading(false); return; }
    try {
      const res = await api.get<{ user: User; permissions: Permission[] }>('/auth/me');
      setUser(res.user);
      setPermissions(res.permissions ?? []);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null); setUser(null); setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  const login = useCallback(async (employee_no: string, password: string) => {
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/login', { employee_no, password });
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
      // refresh fetches permissions
      return { ok: true };
    } catch (e: any) {
      // ApiError carries the server response body; extract the error code from it
      const serverError = e?.body?.error ?? e?.message ?? 'login_failed';
      console.error('[Auth] Login failed:', serverError, e);
      return { ok: false, error: String(serverError) };
    }
  }, []);


  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null); setUser(null); setPermissions([]);
  }, []);

  const canFn = useCallback(
    (menu_code: string, action: Action) => {
      if (user?.role === 'admin') return true;
      const p = permMap.get(menu_code);
      return !!(p && p[`can_${action}` as const]);
    },
    [permMap, user?.role],
  );

  const value: AuthContextType = {
    user, token, permissions, permMap, loading,
    login, logout, refreshMe,
    can: canFn,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'admin' || user?.role === 'manager',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** 컴포넌트 가드: 특정 권한이 없으면 children을 렌더링하지 않음 */
export function PermGuard({
  menu_code, action = 'read', fallback = null, children,
}: {
  menu_code: string;
  action?: Action;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(menu_code, action) ? children : fallback}</>;
}
