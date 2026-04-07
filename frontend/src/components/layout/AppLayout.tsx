import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';
import { useAuth } from '@/lib/auth';
import { LogOut, User } from 'lucide-react';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-12 items-center justify-end border-b border-gray-200 bg-white px-4 gap-3">
          {user && (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span className="font-medium">{user.worker_name}</span>
                <span className="text-xs text-gray-400">
                  ({user.department || '-'} / {user.position || '-'})
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-red-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                로그아웃
              </button>
            </>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
