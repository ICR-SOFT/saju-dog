import { createClient } from '@supabase/supabase-js';

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
    global: {
      fetch: async (url, options) => {
        // 요청 전 세션 확인 + 자동 갱신
        const response = await fetch(url, options);

        // 401 응답 시 세션 갱신 후 재시도
        if (response.status === 401) {
          const { error } = await supabase.auth.refreshSession();
          if (!error) {
            // 새 토큰으로 재시도
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const newOptions = { ...options };
              const headers = new Headers(newOptions.headers);
              headers.set('Authorization', `Bearer ${session.access_token}`);
              (newOptions as any).headers = headers;
              return fetch(url, newOptions);
            }
          }
        }

        return response;
      },
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

// 모바일 백그라운드 복귀 시 세션 복구 (Supabase 공식 권장 패턴)
// 탭 동결 시 auto-refresh 타이머가 멈추므로 수동으로 재시작 필요
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
