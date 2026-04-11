import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: typeof window !== 'undefined',
    persistSession: typeof window !== 'undefined',
    detectSessionInUrl: typeof window !== 'undefined',
  },
});

// ===== 간단한 세션 헬퍼 =====
export async function getValidSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ===== 탭 복귀 시 처리 (클라이언트 전용) =====
if (typeof window !== 'undefined') {
  let hiddenAt: number | null = null;
  const STALE_THRESHOLD = 60 * 60 * 1000;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      supabase.auth.stopAutoRefresh();
    } else {
      supabase.auth.startAutoRefresh();
      if (hiddenAt && Date.now() - hiddenAt > STALE_THRESHOLD) {
        window.location.reload();
        return;
      }
      hiddenAt = null;
    }
  });
}
