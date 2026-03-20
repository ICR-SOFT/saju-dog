import { create } from 'zustand';
import { supabase } from '@/lib/supabase.ts';
import type { User } from '@/types/user.ts';

interface AuthState {
  user: User | null;
  sessionUserId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nickname?: string) => Promise<void>;
  signOut: () => Promise<void>;
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
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

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

  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
