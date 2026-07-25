import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { router } from './router';
import './index.css';

// Vercel cold start 워밍업: 앱 로드 즉시 API 핑 (무음 처리)
// 사용자가 로그인 화면 보는 동안 서버리스 함수가 warm up 됨
fetch('/api/health').catch(() => {/* silent */});


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
