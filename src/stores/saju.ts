import { create } from 'zustand';
import { supabase } from '@/lib/supabase.ts';
import type { SajuProfile, Reading } from '@/types/user.ts';
import type { SajuApiResponse } from '@/types/saju.ts';
import { getReading } from '@/lib/api.ts';
import { useCreditStore } from './credit.ts';

interface SajuState {
  profiles: SajuProfile[];
  currentReading: SajuApiResponse | null;
  readings: Reading[];
  isLoading: boolean;
  error: string | null;
  pendingReadingProfileId: string | null;
  readingCache: Record<string, SajuApiResponse>;

  fetchProfiles: () => Promise<void>;
  addProfile: (profile: Omit<SajuProfile, 'id' | 'user_id' | 'calculated_saju' | 'created_at' | 'updated_at'>) => Promise<SajuProfile>;
  deleteProfile: (id: string) => Promise<void>;
  requestReading: (profileId: string, serviceType: string) => Promise<SajuApiResponse>;
  fetchReadings: () => Promise<void>;
  clearCurrentReading: () => void;
}

export const useSajuStore = create<SajuState>((set, get) => ({
  profiles: [],
  currentReading: null,
  readings: [],
  isLoading: false,
  error: null,
  pendingReadingProfileId: null,
  readingCache: {},

  fetchProfiles: async () => {
    const { data, error } = await supabase
      .from('saju_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    set({ profiles: data || [] });
  },

  addProfile: async (profile) => {
    const { data, error } = await supabase
      .from('saju_profiles')
      .insert(profile)
      .select()
      .single();

    if (error) throw new Error(error.message);
    set({ profiles: [data, ...get().profiles] });
    return data;
  },

  deleteProfile: async (id) => {
    const { error } = await supabase
      .from('saju_profiles')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    set({ profiles: get().profiles.filter(p => p.id !== id) });
  },

  requestReading: async (profileId, serviceType) => {
    set({ isLoading: true, error: null, pendingReadingProfileId: profileId });
    try {
      const result = await getReading({ profileId, serviceType: serviceType as SajuApiResponse['serviceType'] });
      set((state) => ({
        currentReading: result,
        isLoading: false,
        pendingReadingProfileId: null,
        readingCache: { ...state.readingCache, [profileId]: result },
      }));
      // 크레딧 & 보관함 즉시 갱신
      useCreditStore.getState().fetchCredits();
      get().fetchReadings();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '풀이 요청에 실패했습니다';
      set({ error: message, isLoading: false, pendingReadingProfileId: null });
      throw err;
    }
  },

  fetchReadings: async () => {
    const { data, error } = await supabase
      .from('readings')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    set({ readings: data || [] });
  },

  clearCurrentReading: () => set({ currentReading: null }),
}));
