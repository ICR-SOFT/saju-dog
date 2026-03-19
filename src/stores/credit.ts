import { create } from 'zustand';
import { supabase } from '@/lib/supabase.ts';
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
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('credits')
      .select('*')
      .single();

    if (error) {
      set({ isLoading: false });
      return;
    }

    set({ credits: data, isLoading: false });
  },
}));
