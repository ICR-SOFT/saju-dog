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
const DEBUG = import.meta.env.DEV;

function authLog(msg: string, data?: unknown) {
  const ts = new Date().toLocaleTimeString('ko-KR');
  if (data !== undefined) {
    console.log(`[Auth ${ts}] ${msg}`, data);
  } else {
    console.log(`[Auth ${ts}] ${msg}`);
  }
}

// ===== 이벤트 기반 세션 캐시 =====
// getSession()은 GoTrue 내부 lock에 걸려 무한 대기할 수 있음.
// onAuthStateChange 이벤트로 세션을 캐시해서 lock 우회.
let cachedSession: Session | null = null;

supabase.auth.onAuthStateChange((event, session) => {
  authLog(`onAuthStateChange: ${event}`, {
    hasSession: !!session,
    expiresAt: session?.expires_at
      ? new Date(session.expires_at * 1000).toLocaleTimeString('ko-KR')
      : null,
  });

  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    cachedSession = session;
  } else if (event === 'SIGNED_OUT') {
    cachedSession = null;
  }
});

// ===== GoTrue lock 교착 근본 우회 =====
// supabase.from().select() 등 PostgREST 쿼리는 내부적으로
// _getAccessToken() → getSession() 호출 → GoTrue lock 무한 대기 가능.
// cachedSession의 access_token을 직접 반환하여 lock을 완전 우회.
const originalGetAccessToken = (supabase as any)._getAccessToken?.bind(supabase);
(supabase as any)._getAccessToken = async () => {
  if (cachedSession?.access_token) {
    return cachedSession.access_token;
  }
  // 캐시 없음 (최초 로드) → 원래 메서드 사용 (타임아웃 보호)
  if (originalGetAccessToken) {
    try {
      return await withTimeout(originalGetAccessToken(), 3000, '_getAccessToken');
    } catch {
      authLog('_getAccessToken: 원본 메서드 타임아웃, null 반환');
      return null;
    }
  }
  return null;
};

// ===== 타임아웃 헬퍼 =====
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[Auth] ${label} 타임아웃 (${ms}ms)`)), ms),
    ),
  ]);
}

// ===== getValidSession =====
/**
 * 유효한 세션 반환.
 *
 * 1순위: 이벤트 캐시 (즉시, lock 무관)
 * 2순위: getSession() + 타임아웃 (캐시 없을 때만)
 *
 * 만료 임박 시 refreshSession()으로 갱신.
 */
export async function getValidSession(): Promise<Session | null> {
  // 1단계: 캐시된 세션 확인 (GoTrue lock 우회, 즉시 반환)
  let session = cachedSession;

  if (session) {
    const now = Math.floor(Date.now() / 1000);
    const remainSec = (session.expires_at ?? 0) - now;

    if (DEBUG) authLog(`getValidSession: 캐시 히트 (만료까지 ${remainSec}초)`);

    // 아직 유효 → 그대로 반환
    if (remainSec > 60) {
      return session;
    }

    // 만료 임박 → 갱신 시도
    authLog(`토큰 갱신 시도 (잔여 ${remainSec}초)`);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.refreshSession(),
        10000,
        'refreshSession',
      );
      if (!error && data.session) {
        authLog('토큰 갱신 성공');
        cachedSession = data.session;
        return data.session;
      }
      authLog('토큰 갱신 실패 → 로그아웃', error?.message);
    } catch (err) {
      authLog('토큰 갱신 타임아웃 → 로그아웃', err instanceof Error ? err.message : err);
    }

    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    cachedSession = null;
    return null;
  }

  // 2단계: 캐시 없음 → getSession() 시도 (최초 로드, 또는 캐시 유실 시)
  if (DEBUG) authLog('getValidSession: 캐시 미스, getSession() 시도');

  try {
    const { data: { session: fetched } } = await withTimeout(
      supabase.auth.getSession(),
      5000,
      'getSession',
    );

    if (!fetched) {
      if (DEBUG) authLog('getValidSession: 세션 없음');
      return null;
    }

    cachedSession = fetched;

    const now = Math.floor(Date.now() / 1000);
    const remainSec = (fetched.expires_at ?? 0) - now;

    if (remainSec <= 60) {
      // 만료 임박 → 갱신
      const { data, error } = await withTimeout(
        supabase.auth.refreshSession(),
        10000,
        'refreshSession',
      );
      if (!error && data.session) {
        cachedSession = data.session;
        return data.session;
      }
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      cachedSession = null;
      return null;
    }

    return fetched;
  } catch (err) {
    authLog('getValidSession: getSession 실패', err instanceof Error ? err.message : err);
    // 타임아웃이어도 캐시가 없으니 → null (로그아웃은 하지 않음, 비로그인일 수 있으므로)
    return null;
  }
}

// ===== 탭 복귀 시 세션 복구 =====
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    authLog('탭 복귀 — autoRefresh 재시작');
    supabase.auth.startAutoRefresh();

    // auto-refresh가 lock 잡고 갱신 → TOKEN_REFRESHED 이벤트 → cachedSession 자동 업데이트
    // 3초 후 캐시 기반으로 세션 검증 (getSession() 호출 없이 lock 안전)
    await new Promise(r => setTimeout(r, 3000));

    if (cachedSession) {
      const now = Math.floor(Date.now() / 1000);
      const remainSec = (cachedSession.expires_at ?? 0) - now;
      authLog(`탭 복귀 — 세션 유효 (만료까지 ${remainSec}초)`);

      // auto-refresh 후에도 여전히 만료 상태면 수동 갱신
      if (remainSec <= 60) {
        authLog('탭 복귀 — 만료 임박, 수동 갱신');
        try {
          const { data, error } = await withTimeout(
            supabase.auth.refreshSession(),
            10000,
            'visibilityRefresh',
          );
          if (error || !data.session) {
            authLog('탭 복귀 — 갱신 실패 → 로그아웃');
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          }
        } catch {
          authLog('탭 복귀 — 갱신 타임아웃');
        }
      }
    } else {
      authLog('탭 복귀 — 세션 없음 (비로그인 또는 만료)');
    }
  } else {
    if (DEBUG) authLog('탭 백그라운드 — autoRefresh 중지');
    supabase.auth.stopAutoRefresh();
  }
});

// ===== 주기적 세션 헬스체크 (5분마다) =====
// getSession()을 호출하지 않고 cachedSession만 확인 → lock 교착 면역
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

function startHealthCheck() {
  if (healthCheckInterval) return;
  healthCheckInterval = setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    if (!cachedSession) {
      if (DEBUG) authLog('헬스체크: 세션 없음 (비로그인)');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const remainSec = (cachedSession.expires_at ?? 0) - now;

    if (remainSec <= 300) {
      authLog(`헬스체크: 토큰 곧 만료 (${remainSec}초) → 갱신 시도`);
      try {
        const { error } = await withTimeout(
          supabase.auth.refreshSession(),
          10000,
          'healthCheck.refreshSession',
        );
        if (error) {
          authLog('헬스체크: 갱신 실패 → 로그아웃', error.message);
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        } else {
          authLog('헬스체크: 갱신 성공');
        }
      } catch (err) {
        authLog('헬스체크: 갱신 타임아웃', err instanceof Error ? err.message : err);
      }
    } else if (DEBUG) {
      authLog(`헬스체크: 정상 (만료까지 ${Math.floor(remainSec / 60)}분)`);
    }
  }, 5 * 60 * 1000);
}

startHealthCheck();
