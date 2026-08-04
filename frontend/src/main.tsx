import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { router } from './router';
import './index.css';

// Vercel cold start 워밍업: 앱 로드 즉시 API 핑 (무음 처리)
fetch('/api/health').catch(() => {/* silent */});

// 구버전 PWA 서비스 워커 캐시 자동 해제 (최신 빌드 즉시 반영 보장)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
