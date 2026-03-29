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

// ===== 디버그 로깅 =====
const DEBUG = import.meta.env.DEV; // 개발 환경에서만 상세 로그

function authLog(msg: string, data?: unknown) {
  const ts = new Date().toLocaleTimeString('ko-KR');
  if (data !== undefined) {
    console.log(`[Auth ${ts}] ${msg}`, data);
  } else {
    console.log(`[Auth ${ts}] ${msg}`);
  }
}

// ===== 타임아웃 헬퍼 =====
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[Auth] ${label} 타임아웃 (${ms}ms)`)), ms),
    ),
  ]);
}

// ===== 세션 상태 변경 리스너 =====
supabase.auth.onAuthStateChange((event, session) => {
  authLog(`onAuthStateChange: ${event}`, {
    hasSession: !!session,
    expiresAt: session?.expires_at
      ? new Date(session.expires_at * 1000).toLocaleTimeString('ko-KR')
      : null,
  });
});

// ===== getValidSession (타임아웃 보호 + 상세 로깅) =====

/**
 * 유효한 세션 반환 — 만료 시 자동 갱신, 갱신 실패 시 로그아웃
 *
 * getSession()은 메모리 캐시만 읽어 만료 토큰을 그대로 반환할 수 있음.
 * 이 함수는 expires_at을 확인해 필요 시 갱신합니다.
 *
 * 5초 타임아웃: Supabase GoTrue lock 교착 방지
 */
export async function getValidSession(): Promise<Session | null> {
  try {
    const { data: { session } } = await withTimeout(
      supabase.auth.getSession(),
      5000,
      'getSession',
    );

    if (!session) {
      if (DEBUG) authLog('getValidSession: 세션 없음');
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at ?? 0;
    const remainSec = expiresAt - now;

    if (DEBUG) authLog(`getValidSession: 토큰 만료까지 ${remainSec}초`);

    // 만료 60초 전부터 선제 갱신
    if (now >= expiresAt - 60) {
      authLog(`토큰 갱신 시도 (잔여 ${remainSec}초)`);

      const { data, error } = await withTimeout(
        supabase.auth.refreshSession(),
        10000,
        'refreshSession',
      );

      if (error || !data.session) {
        authLog('토큰 갱신 실패 → 로그아웃', error?.message);
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        return null;
      }

      authLog('토큰 갱신 성공', {
        newExpiresAt: new Date((data.session.expires_at ?? 0) * 1000).toLocaleTimeString('ko-KR'),
      });
      return data.session;
    }

    return session;
  } catch (err) {
    // 타임아웃 또는 기타 에러
    authLog('getValidSession 실패 → 로그아웃', err instanceof Error ? err.message : err);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    return null;
  }
}

// ===== 탭 복귀 시 세션 복구 =====
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    authLog('탭 복귀 — 세션 검증 시작');
    supabase.auth.startAutoRefresh();

    // getValidSession이 타임아웃 보호 + 갱신 + 로그아웃까지 처리
    const session = await getValidSession();
    authLog('탭 복귀 — 세션 검증 완료', { hasSession: !!session });
  } else {
    if (DEBUG) authLog('탭 백그라운드 — autoRefresh 중지');
    supabase.auth.stopAutoRefresh();
  }
});

// ===== 주기적 세션 헬스체크 (5분마다) =====
// 탭이 활성 상태에서 오래 방치해도 세션 만료를 감지
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

function startHealthCheck() {
  if (healthCheckInterval) return;
  healthCheckInterval = setInterval(async () => {
    // 탭이 백그라운드면 스킵
    if (document.visibilityState !== 'visible') return;

    try {
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        5000,
        'healthCheck.getSession',
      );

      if (!session) {
        if (DEBUG) authLog('헬스체크: 세션 없음 (비로그인 상태)');
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const remainSec = (session.expires_at ?? 0) - now;

      if (remainSec <= 300) {
        // 5분 이내 만료 예정 → 선제 갱신
        authLog(`헬스체크: 토큰 곧 만료 (${remainSec}초) → 갱신 시도`);
        const { error } = await withTimeout(
          supabase.auth.refreshSession(),
          10000,
          'healthCheck.refreshSession',
        );
        if (error) {
          authLog('헬스체크: 갱신 실패 → 로그아웃', error.message);
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        } else {
          authLog('헬스체크: 토큰 갱신 성공');
        }
      } else if (DEBUG) {
        authLog(`헬스체크: 정상 (만료까지 ${Math.floor(remainSec / 60)}분)`);
      }
    } catch (err) {
      authLog('헬스체크: 실패', err instanceof Error ? err.message : err);
    }
  }, 5 * 60 * 1000); // 5분
}

startHealthCheck();
