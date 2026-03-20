import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.ts';
import { useSajuStore } from '@/stores/saju.ts';
import { useCreditStore } from '@/stores/credit.ts';
import { Loading } from '@/components/ui/Loading.tsx';
import { Login } from '@/pages/Login.tsx';
import { Home } from '@/pages/Home.tsx';
import { AddProfile } from '@/pages/AddProfile.tsx';
import { Reading } from '@/pages/Reading.tsx';
import { Archive } from '@/pages/Archive.tsx';
import { ReadingDetail } from '@/pages/ReadingDetail.tsx';
import { DailyFortune } from '@/pages/DailyFortune.tsx';
import { Compatibility } from '@/pages/Compatibility.tsx';
import { SajuChat } from '@/pages/SajuChat.tsx';
import { MyPage } from '@/pages/MyPage.tsx';
import { SharedReading } from '@/pages/SharedReading.tsx';
import { EditProfile } from '@/pages/EditProfile.tsx';
import './App.css';

/** 인증 시 프로필/크레딧/보관함 자동 로드 */
function AppDataLoader() {
  const { isAuthenticated } = useAuthStore();
  const { fetchProfiles, fetchReadings } = useSajuStore();
  const { fetchCredits } = useCreditStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfiles();
      fetchCredits();
      fetchReadings();
    }
  }, [isAuthenticated, fetchProfiles, fetchCredits, fetchReadings]);

  return null;
}

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
      <AppDataLoader />
      <Routes>
        {/* 비로그인도 접근 가능 */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/share/:shareId" element={<SharedReading />} />

        {/* 로그인 필요 */}
        <Route path="/add-profile" element={<AuthRequired><AddProfile /></AuthRequired>} />
        <Route path="/edit-profile/:profileId" element={<AuthRequired><EditProfile /></AuthRequired>} />
        <Route path="/reading/:profileId" element={<AuthRequired><Reading /></AuthRequired>} />
        <Route path="/archive" element={<AuthRequired><Archive /></AuthRequired>} />
        <Route path="/archive/:readingId" element={<AuthRequired><ReadingDetail /></AuthRequired>} />
        <Route path="/daily" element={<AuthRequired><DailyFortune /></AuthRequired>} />
        <Route path="/compatibility" element={<AuthRequired><Compatibility /></AuthRequired>} />
        <Route path="/chat" element={<AuthRequired><SajuChat /></AuthRequired>} />
        <Route path="/my" element={<AuthRequired><MyPage /></AuthRequired>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
