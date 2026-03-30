import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);

// ===== 간단한 세션 헬퍼 =====

/**
 * 유효한 세션을 반환합니다.
 * Supabase의 기본 getSession()만 사용 — 패치 없이 깔끔하게.
 */
export async function getValidSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ===== 탭 복귀 시 처리 =====
// 장시간 방치(1시간 이상) 후 복귀 → 페이지 리로드로 깔끔하게 처리
// 짧은 백그라운드 → Supabase 자체 autoRefresh에 맡김

let hiddenAt: number | null = null;
const STALE_THRESHOLD = 60 * 60 * 1000; // 1시간

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    supabase.auth.stopAutoRefresh();
  } else {
    supabase.auth.startAutoRefresh();

    if (hiddenAt && Date.now() - hiddenAt > STALE_THRESHOLD) {
      console.log('[Auth] 장시간 백그라운드 → 새로고침');
      window.location.reload();
      return;
    }
    hiddenAt = null;
  }
});
