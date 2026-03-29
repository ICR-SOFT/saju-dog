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

// 세션 상태 변경 시 로그
supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('[Auth] Token refreshed');
  } else if (event === 'SIGNED_OUT') {
    console.log('[Auth] Signed out');
  }
});

/**
 * 유효한 세션 반환 — 만료 시 자동 갱신, 갱신 실패 시 로그아웃 처리
 *
 * getSession()은 메모리/localStorage 캐시만 읽으므로 만료된 토큰을
 * 그대로 반환할 수 있음. 이 함수는 expires_at을 확인해 필요 시 갱신합니다.
 */
export async function getValidSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;

  // 만료 60초 전부터 선제 갱신
  if (now >= expiresAt - 60) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      // 갱신 불가 — 세션 정리 (SIGNED_OUT 이벤트 발생 → auth store 동기화)
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      return null;
    }
    return data.session;
  }

  return session;
}

// 모바일 백그라운드 복귀 시 세션 복구
// startAutoRefresh()만으론 갱신 완료까지 갭이 있어, 만료 토큰 즉시 갱신
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    supabase.auth.startAutoRefresh();

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // 세션 소실 — SIGNED_OUT 이벤트가 누락됐을 수 있으므로 수동 트리거
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        return;
      }

      // 액세스 토큰 만료 시 즉시 갱신
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && now >= session.expires_at - 60) {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn('[Auth] 세션 갱신 실패, 로그아웃 처리');
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[Auth] 탭 복귀 세션 확인 실패:', err);
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
