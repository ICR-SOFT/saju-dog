import { create } from 'zustand';
import { supabase } from '@/lib/supabase.ts';
import { useSajuStore } from './saju.ts';
import { useCreditStore } from './credit.ts';
import type { User } from '@/types/user.ts';

interface AuthState {
  user: User | null;
  sessionUserId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nickname?: string) => Promise<void>;
  signInWithOAuth: (provider: 'kakao' | 'google') => Promise<void>;
  signOut: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  sessionUserId: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        set({
          user: profile,
          sessionUserId: session.user.id,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }

    // 세션 변경 리스너 (TOKEN_REFRESHED 포함)
    supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        let { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        // OAuth 첫 로그인 시 users 레코드 자동 생성
        if (!profile && event === 'SIGNED_IN') {
          const nickname = session.user.user_metadata?.full_name
            || session.user.user_metadata?.name
            || '멍멍이';
          await supabase.from('users').insert({ id: session.user.id, nickname });
          const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
          profile = data;
        }

        set({
          user: profile,
          sessionUserId: session.user.id,
          isAuthenticated: true,
        });
      } else if (event === 'SIGNED_OUT') {
        set({
          user: null,
          sessionUserId: null,
          isAuthenticated: false,
        });
      }
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },

  signUp: async (email, password, nickname) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);

    if (data.user) {
      await supabase.from('users').insert({
        id: data.user.id,
        nickname: nickname || '멍멍이',
      });
    }
  },

  signInWithOAuth: async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw new Error(error.message);
  },

  signOut: async () => {
    await supabase.auth.signOut();
    // 다른 스토어 초기화
    useSajuStore.setState({ profiles: [], readings: [], currentReading: null, selectedProfileIdx: 0 });
    useCreditStore.setState({ credits: null });
  },

  updateNickname: async (nickname) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인 필요');
    const { error } = await supabase
      .from('users')
      .update({ nickname, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw new Error(error.message);
    set(state => ({ user: state.user ? { ...state.user, nickname } : null }));
  },
}));
