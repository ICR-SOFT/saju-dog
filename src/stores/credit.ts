import { create } from 'zustand';
import { supabase, getValidSession } from '@/lib/supabase.ts';
import type { Credits } from '@/types/user.ts';

interface CreditState {
  credits: Credits | null;
  isLoading: boolean;
  fetchCredits: () => Promise<void>;
}

export const useCreditStore = create<CreditState>((set) => ({
  credits: null,
  isLoading: false,

  fetchCredits: async () => {
    const session = await getValidSession();
    if (!session) {
      console.warn('[credit] fetchCredits: 유효한 세션 없음 — 스킵');
      set({ isLoading: false });
      return;
    }

    set({ isLoading: true });
    const { data, error } = await supabase
      .from('credits')
      .select('*')
      .single();

    if (error) {
      console.warn('[credit] fetchCredits 실패:', error.message);
      set({ isLoading: false });
      return;
    }

    set({ credits: data, isLoading: false });
  },
}));
