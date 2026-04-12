'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useSajuStore } from '@/stores/saju';
import { calculateSaju } from '@/core/calculator';
import { supabase } from '@/lib/supabase';
import type { Gender, CalendarType } from '@/types/saju';

// HOUR_OPTIONS removed - using number input instead

const RELATIONS = ['본인', '배우자', '자녀', '부모', '친구', '기타'] as const;

export default function EditProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const { profiles, fetchProfiles, deleteProfile } = useSajuStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const profile = profiles.find((p) => p.id === profileId);

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

  // Pre-fill form when profile loads
  useEffect(() => {
    if (profile) {
      const bd = new Date(profile.birth_date);
      setForm({
        name: profile.name,
        relation: profile.relation,
        birthYear: String(bd.getFullYear()),
        birthMonth: String(bd.getMonth() + 1),
        birthDay: String(bd.getDate()),
        birthHour: bd.getHours() === 12 && bd.getMinutes() === 0 ? '' : String(bd.getHours()),
        birthMinute: String(bd.getMinutes()),
        gender: profile.gender,
        calendarType: profile.calendar_type,
        maritalStatus: (profile.marital_status || 'single') as 'single' | 'married',
      });
    }
  }, [profile]);

  // Fetch profiles if not loaded
  useEffect(() => {
    if (profiles.length === 0) {
      fetchProfiles();
    }
  }, [profiles.length, fetchProfiles]);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) return;
    setError('');
    setIsLoading(true);

    try {
      const birthDate = new Date(
        Number(form.birthYear),
        Number(form.birthMonth) - 1,
        Number(form.birthDay),
        form.birthHour ? Number(form.birthHour) : 12,
        form.birthMinute ? Number(form.birthMinute) : 0,
      );

      const sajuResult = calculateSaju({
        name: form.name,
        birthDate,
        gender: form.gender,
        calendarType: form.calendarType,
        useTrueSolar: true,
        longitude: 126.978,
      });

      const { error: updateError } = await supabase
        .from('saju_profiles')
        .update({
          name: form.name,
          relation: form.relation,
          birth_date: birthDate.toISOString(),
          calendar_type: form.calendarType,
          gender: form.gender,
          marital_status: form.maritalStatus,
          calculated_saju: JSON.parse(JSON.stringify(sajuResult)),
        })
        .eq('id', profileId);

      if (updateError) throw new Error(updateError.message);

      await fetchProfiles();
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정에 실패했어요');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProfile(profileId);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했어요');
    }
  };

  if (!profile && profiles.length > 0) {
    return (
      <AuthRequired>
        <AppShell title="프로필 수정" showBack>
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              프로필을 찾을 수 없습니다
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push('/')}
              size="sm"
            >
              홈으로
            </Button>
          </div>
        </AppShell>
      </AuthRequired>
    );
  }

  return (
    <AuthRequired>
      <AppShell title="프로필 수정" showBack>
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

            {/* Gender */}
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

            {/* Birth time */}
            <div className="flex flex-col gap-1">
              <span className="font-pixel text-xs text-[var(--text-secondary)]">
                태어난 시간
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.birthHour}
                  onChange={(e) => updateField('birthHour', e.target.value)}
                  placeholder="시 (0~23)"
                  min={0}
                  max={23}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.birthMinute}
                  onChange={(e) => updateField('birthMinute', e.target.value)}
                  placeholder="분 (0~59)"
                  min={0}
                  max={59}
                />
              </div>
              <p className="text-[9px] text-[var(--text-muted)]">모르면 비워두세요</p>
            </div>

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

            {/* Update button */}
            <Button
              type="submit"
              loading={isLoading}
              className="w-full"
              size="lg"
            >
              프로필 수정
            </Button>
          </form>

          {/* Delete button */}
          <div className="mt-6 pt-4 border-t-2 border-[var(--pixel-shadow)]">
            <Button
              variant="danger"
              size="md"
              className="w-full"
              onClick={() => setShowDeleteConfirm(true)}
            >
              프로필 삭제
            </Button>
          </div>
        </div>

        {/* Delete confirmation modal */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="프로필 삭제"
          message={`"${profile?.name}" 프로필을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          confirmText="삭제"
          cancelText="취소"
        />
      </AppShell>
    </AuthRequired>
  );
}
