'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useSajuStore } from '@/stores/saju';
import { calculateSaju } from '@/core/calculator';
import { supabase } from '@/lib/supabase';
import type { Gender, CalendarType } from '@/types/saju';

const HOUR_OPTIONS = [
  { value: '', label: '모름' },
  { value: '0', label: '자시 (23:30~01:30)' },
  { value: '1', label: '축시 (01:30~03:30)' },
  { value: '3', label: '인시 (03:30~05:30)' },
  { value: '5', label: '묘시 (05:30~07:30)' },
  { value: '7', label: '진시 (07:30~09:30)' },
  { value: '9', label: '사시 (09:30~11:30)' },
  { value: '11', label: '오시 (11:30~13:30)' },
  { value: '13', label: '미시 (13:30~15:30)' },
  { value: '15', label: '신시 (15:30~17:30)' },
  { value: '17', label: '유시 (17:30~19:30)' },
  { value: '19', label: '술시 (19:30~21:30)' },
  { value: '21', label: '해시 (21:30~23:30)' },
] as const;

const RELATIONS = ['본인', '배우자', '자녀', '부모', '친구', '기타'] as const;

export default function AddProfilePage() {
  const router = useRouter();
  const { fetchProfiles, selectProfile } = useSajuStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    relation: '본인',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    birthHour: '',
    birthMinute: '',
    gender: 'male' as Gender,
    calendarType: 'solar' as CalendarType,
    maritalStatus: 'single' as 'single' | 'married',
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    if (!form.birthYear || !form.birthMonth || !form.birthDay) {
      setError('생년월일을 입력해주세요');
      return;
    }

    const y = Number(form.birthYear);
    const m = Number(form.birthMonth);
    const d = Number(form.birthDay);

    if (y < 1920 || y > 2025) {
      setError('올바른 연도를 입력해주세요 (1920~2025)');
      return;
    }
    if (m < 1 || m > 12) {
      setError('올바른 월을 입력해주세요');
      return;
    }
    if (d < 1 || d > 31) {
      setError('올바른 일을 입력해주세요');
      return;
    }

    setIsLoading(true);

    try {
      const birthDate = new Date(
        y,
        m - 1,
        d,
        form.birthHour ? Number(form.birthHour) : 12,
        form.birthMinute ? Number(form.birthMinute) : 0,
      );

      // Calculate saju pillars
      const sajuResult = calculateSaju({
        name: form.name,
        birthDate,
        gender: form.gender,
        calendarType: form.calendarType,
        useTrueSolar: true,
        longitude: 126.978,
      });

      // Direct supabase insert (includes calculated_saju which store omits)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다');

      const { error: insertError } = await supabase
        .from('saju_profiles')
        .insert({
          user_id: session.user.id,
          name: form.name,
          relation: form.relation,
          birth_date: birthDate.toISOString(),
          calendar_type: form.calendarType,
          gender: form.gender,
          use_true_solar: true,
          birth_city: '서울',
          longitude: 126.978,
          marital_status: form.maritalStatus,
          calculated_saju: JSON.parse(JSON.stringify(sajuResult)),
        });

      if (insertError) throw new Error(insertError.message);

      // Refresh store and select the new profile
      await fetchProfiles();
      const newProfiles = useSajuStore.getState().profiles;
      selectProfile(newProfiles.length - 1);

      router.push('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '프로필 등록에 실패했어요';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthRequired>
      <AppShell title="프로필 추가" showBack>
        <div className="px-4 py-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Name */}
            <Input
              label="이름"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="이름을 입력하세요"
              required
            />

            {/* Gender - pixel radio */}
            <div className="flex flex-col gap-1">
              <span className="font-pixel text-xs text-[var(--text-secondary)]">
                성별
              </span>
              <div className="flex gap-2">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => updateField('gender', g)}
                    className={`flex-1 py-2.5 text-sm font-pixel transition-all ${
                      form.gender === g
                        ? 'pixel-btn-accent text-white border-[var(--accent-hover)] shadow-[4px_4px_0_var(--accent-hover)]'
                        : 'pixel-btn bg-[var(--bg-primary)] text-[var(--text-primary)]'
                    }`}
                  >
                    {g === 'male' ? '👦 남' : '👧 여'}
                  </button>
                ))}
              </div>
            </div>

            {/* Marital status */}
            <div className="flex flex-col gap-1">
              <span className="font-pixel text-xs text-[var(--text-secondary)]">
                결혼 여부
              </span>
              <div className="flex gap-2">
                {([
                  { value: 'single', label: '💍 미혼' },
                  { value: 'married', label: '💒 기혼' },
                ] as const).map((ms) => (
                  <button
                    key={ms.value}
                    type="button"
                    onClick={() => updateField('maritalStatus', ms.value)}
                    className={`flex-1 py-2.5 text-sm font-pixel transition-all ${
                      form.maritalStatus === ms.value
                        ? 'pixel-btn-accent text-white border-[var(--accent-hover)] shadow-[4px_4px_0_var(--accent-hover)]'
                        : 'pixel-btn bg-[var(--bg-primary)] text-[var(--text-primary)]'
                    }`}
                  >
                    {ms.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar type */}
            <div className="flex flex-col gap-1">
              <span className="font-pixel text-xs text-[var(--text-secondary)]">
                달력
              </span>
              <div className="flex gap-2">
                {([
                  { value: 'solar', label: '양력' },
                  { value: 'lunar', label: '음력' },
                  { value: 'lunar_leap', label: '윤달' },
                ] as const).map((cal) => (
                  <button
                    key={cal.value}
                    type="button"
                    onClick={() => updateField('calendarType', cal.value)}
                    className={`flex-1 py-2 text-xs font-pixel transition-all ${
                      form.calendarType === cal.value
                        ? 'pixel-btn-accent text-white border-[var(--accent-hover)] shadow-[4px_4px_0_var(--accent-hover)]'
                        : 'pixel-btn bg-[var(--bg-primary)] text-[var(--text-primary)]'
                    }`}
                  >
                    {cal.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Birth date */}
            <div className="flex flex-col gap-1">
              <span className="font-pixel text-xs text-[var(--text-secondary)]">
                생년월일
              </span>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.birthYear}
                  onChange={(e) => updateField('birthYear', e.target.value)}
                  placeholder="년"
                  min={1920}
                  max={2025}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.birthMonth}
                  onChange={(e) => updateField('birthMonth', e.target.value)}
                  placeholder="월"
                  min={1}
                  max={12}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.birthDay}
                  onChange={(e) => updateField('birthDay', e.target.value)}
                  placeholder="일"
                  min={1}
                  max={31}
                />
              </div>
            </div>

            {/* Birth hour - select */}
            <div className="flex flex-col gap-1">
              <span className="font-pixel text-xs text-[var(--text-secondary)]">
                태어난 시
              </span>
              <select
                value={form.birthHour}
                onChange={(e) => updateField('birthHour', e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--pixel-border)] shadow-[2px_2px_0_var(--pixel-shadow)] outline-none focus:border-[var(--accent)]"
              >
                {HOUR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Birth minute */}
            <Input
              label="태어난 분 (선택)"
              type="number"
              inputMode="numeric"
              value={form.birthMinute}
              onChange={(e) => updateField('birthMinute', e.target.value)}
              placeholder="0~59"
              min={0}
              max={59}
            />

            {/* Relation */}
            <div className="flex flex-col gap-1">
              <span className="font-pixel text-xs text-[var(--text-secondary)]">
                관계
              </span>
              <select
                value={form.relation}
                onChange={(e) => updateField('relation', e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--pixel-border)] shadow-[2px_2px_0_var(--pixel-shadow)] outline-none focus:border-[var(--accent)]"
              >
                {RELATIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <div className="border-2 border-[var(--error)] bg-red-50 p-2 text-center">
                <p className="text-xs text-[var(--error)]">{error}</p>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              loading={isLoading}
              className="w-full"
              size="lg"
            >
              프로필 저장
            </Button>
          </form>

          {/* Tips */}
          <div className="pixel-card mt-5 p-3 bg-[var(--gold-light)]">
            <div className="flex items-start gap-2">
              <span className="text-base">💡</span>
              <div>
                <p className="font-pixel text-[10px] text-[var(--text-primary)] mb-1">
                  정확한 사주를 위한 팁
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  태어난 시간을 정확히 입력하면 시주까지 반영된 더 정확한
                  사주풀이를 받을 수 있어요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthRequired>
  );
}
