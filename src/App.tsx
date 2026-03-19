import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.ts';
import { Loading } from '@/components/ui/Loading.tsx';
import { Login } from '@/pages/Login.tsx';
import { Home } from '@/pages/Home.tsx';
import { AddProfile } from '@/pages/AddProfile.tsx';
import { Reading } from '@/pages/Reading.tsx';
import { Archive } from '@/pages/Archive.tsx';
import { DailyFortune } from '@/pages/DailyFortune.tsx';
import { Compatibility } from '@/pages/Compatibility.tsx';
import { SajuChat } from '@/pages/SajuChat.tsx';
import { MyPage } from '@/pages/MyPage.tsx';
import './App.css';

/** 로그인 필요한 기능 접근 시 리다이렉트 */
function AuthRequired({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-cream flex items-center justify-center">
        <Loading message="로딩 중..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: window.location.pathname }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* 비로그인도 접근 가능 */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* 로그인 필요 */}
        <Route path="/add-profile" element={<AuthRequired><AddProfile /></AuthRequired>} />
        <Route path="/reading/:profileId" element={<AuthRequired><Reading /></AuthRequired>} />
        <Route path="/archive" element={<AuthRequired><Archive /></AuthRequired>} />
        <Route path="/daily" element={<AuthRequired><DailyFortune /></AuthRequired>} />
        <Route path="/compatibility" element={<AuthRequired><Compatibility /></AuthRequired>} />
        <Route path="/chat" element={<AuthRequired><SajuChat /></AuthRequired>} />
        <Route path="/my" element={<AuthRequired><MyPage /></AuthRequired>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
