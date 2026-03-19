import { create } from 'zustand';
import { supabase } from '@/lib/supabase.ts';
import type { SajuProfile, Reading } from '@/types/user.ts';
import type { SajuApiResponse } from '@/types/saju.ts';
import { requestReading as apiRequestReading, pollReadingStatus } from '@/lib/api.ts';
import { useCreditStore } from './credit.ts';

interface SajuState {
  profiles: SajuProfile[];
  currentReading: SajuApiResponse | null;
  readings: Reading[];
  isLoading: boolean;
  error: string | null;

  // 큐 시스템
  pendingReadingId: string | null;
  pendingProfileId: string | null;
  processingStatus: 'idle' | 'requesting' | 'processing' | 'completed' | 'failed';
  processingInfo: {
    duration_ms?: number;
    api_cost?: Record<string, unknown>;
    failure_reason?: string;
    refunded?: boolean;
  } | null;
  readingCache: Record<string, SajuApiResponse>;

  fetchProfiles: () => Promise<void>;
  addProfile: (profile: Omit<SajuProfile, 'id' | 'user_id' | 'calculated_saju' | 'created_at' | 'updated_at'>) => Promise<SajuProfile>;
  deleteProfile: (id: string) => Promise<void>;
  startReading: (profileId: string, serviceType: string) => Promise<void>;
  fetchReadings: () => Promise<void>;
  clearCurrentReading: () => void;
}

const POLL_INTERVAL = 3000; // 3초마다 폴링

export const useSajuStore = create<SajuState>((set, get) => ({
  profiles: [],
  currentReading: null,
  readings: [],
  isLoading: false,
  error: null,
  pendingReadingId: null,
  pendingProfileId: null,
  processingStatus: 'idle',
  processingInfo: null,
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

  /**
   * 큐 기반 풀이 시작
   * 1. saju-request → 즉시 reading ID 반환
   * 2. saju-worker → 처리 시작
   * 3. 폴링으로 완료 확인
   */
  startReading: async (profileId, serviceType) => {
    set({
      isLoading: true,
      error: null,
      processingStatus: 'requesting',
      pendingProfileId: profileId,
      processingInfo: null,
    });

    try {
      // Step 1: 요청 접수
      const requestResult = await apiRequestReading(profileId, serviceType);

      // 캐시 히트
      if (requestResult.cached && requestResult.result) {
        set((state) => ({
          currentReading: requestResult.result!,
          isLoading: false,
          processingStatus: 'completed',
          readingCache: { ...state.readingCache, [`${profileId}:${serviceType}`]: requestResult.result! },
        }));
        return;
      }

      const readingId = requestResult.readingId;
      set({ pendingReadingId: readingId, processingStatus: 'processing' });

      // 크레딧 즉시 갱신
      useCreditStore.getState().fetchCredits();

      // Step 2: EC2 워커가 자동으로 처리 — 프론트는 폴링만
      const poll = async () => {
        const maxAttempts = 60; // 최대 3분
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

          try {
            const status = await pollReadingStatus(readingId);

            if (status.status === 'completed' && status.result) {
              set((state) => ({
                currentReading: status.result!,
                isLoading: false,
                processingStatus: 'completed',
                pendingReadingId: null,
                processingInfo: {
                  duration_ms: status.duration_ms,
                  api_cost: status.api_cost,
                },
                readingCache: { ...state.readingCache, [`${profileId}:${serviceType}`]: status.result! },
              }));
              get().fetchReadings();
              return;
            }

            if (status.status === 'failed') {
              set({
                isLoading: false,
                processingStatus: 'failed',
                pendingReadingId: null,
                error: status.failure_reason || '풀이에 실패했습니다',
                processingInfo: {
                  failure_reason: status.failure_reason,
                  refunded: true,
                },
              });
              useCreditStore.getState().fetchCredits(); // 환불 반영
              return;
            }

            // 아직 processing 중 — 계속 폴링
          } catch {
            // 폴링 실패 시 재시도
          }
        }

        // 타임아웃
        set({
          isLoading: false,
          processingStatus: 'failed',
          error: '처리 시간이 초과되었습니다. 잠시 후 보관함을 확인해주세요.',
        });
      };

      poll();

    } catch (err) {
      const message = err instanceof Error ? err.message : '풀이 요청에 실패했습니다';
      set({
        error: message,
        isLoading: false,
        processingStatus: 'failed',
        pendingReadingId: null,
      });
    }
  },

  fetchReadings: async () => {
    const { data, error } = await supabase
      .from('readings')
      .select('*')
      .in('processing_status', ['completed', 'pending', 'processing', 'failed'])
      .order('created_at', { ascending: false });

    if (error) return;
    set({ readings: data || [] });
  },

  clearCurrentReading: () => set({
    currentReading: null,
    processingStatus: 'idle',
    error: null,
    processingInfo: null,
  }),
}));
