'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { useSajuStore } from '@/stores/saju';
import { supabase, getValidSession } from '@/lib/supabase';
import { formatBirthDate } from '@/lib/format';

interface SelectedMember {
  profileId: string;
  role: string;
}

export default function GroupCreatePage() {
  const router = useRouter();
  const { profiles, fetchProfiles } = useSajuStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const toggleProfile = (profileId: string) => {
    setSelectedMembers((prev) => {
      const exists = prev.find((m) => m.profileId === profileId);
      if (exists) {
        return prev.filter((m) => m.profileId !== profileId);
      }
      return [...prev, { profileId, role: '' }];
    });
  };

  const updateRole = (profileId: string, role: string) => {
    setSelectedMembers((prev) =>
      prev.map((m) => (m.profileId === profileId ? { ...m, role } : m)),
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast('그룹 이름을 입력해주세요');
      return;
    }
    if (selectedMembers.length === 0) {
      showToast('멤버를 한 명 이상 선택해주세요');
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await getValidSession();
      if (!session) throw new Error('로그인이 필요합니다');

      // Create group
      const { data: group, error: groupError } = await supabase
        .from('profile_groups')
        .insert({
          user_id: session.user.id,
          name: name.trim(),
          description: description.trim() || null,
        })
        .select()
        .single();

      if (groupError || !group) {
        throw new Error(groupError?.message || '그룹 생성 실패');
      }

      // Add members
      const members = selectedMembers.map((m) => ({
        group_id: group.id,
        profile_id: m.profileId,
        role: m.role.trim() || null,
      }));

      const { error: membersError } = await supabase
        .from('profile_group_members')
        .insert(members);

      if (membersError) {
        // Rollback group on member insert failure
        await supabase.from('profile_groups').delete().eq('id', group.id);
        throw new Error(membersError.message);
      }

      showToast('그룹이 생성되었어요!');
      router.push('/groups');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '그룹 생성에 실패했어요');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthRequired>
      <AppShell title="그룹 만들기" showBack>
        <div className="p-4 flex flex-col gap-6 animate-fade-in">
          {/* Group Name */}
          <div className="flex flex-col gap-2">
            <label className="font-pixel text-xs text-[var(--text-secondary)]">
              그룹 이름 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 우리 가족, 회사 팀"
              className="px-3 py-2.5 text-sm border-2 border-[var(--pixel-border)] shadow-[2px_2px_0_var(--pixel-shadow)] outline-none focus:border-[var(--accent)] transition-colors"
              maxLength={50}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="font-pixel text-xs text-[var(--text-secondary)]">
              설명 (선택)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="그룹에 대한 간단한 설명"
              className="px-3 py-2.5 text-sm border-2 border-[var(--pixel-border)] shadow-[2px_2px_0_var(--pixel-shadow)] outline-none focus:border-[var(--accent)] transition-colors"
              maxLength={200}
            />
          </div>

          {/* Profile Selector */}
          <div className="flex flex-col gap-2">
            <label className="font-pixel text-xs text-[var(--text-secondary)]">
              멤버 선택 *
            </label>
            {profiles.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">
                등록된 프로필이 없어요. 먼저 프로필을 추가해주세요.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {profiles.map((profile) => {
                  const isSelected = selectedMembers.some(
                    (m) => m.profileId === profile.id,
                  );
                  const member = selectedMembers.find(
                    (m) => m.profileId === profile.id,
                  );

                  return (
                    <div key={profile.id} className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        className={`pixel-card p-3 w-full text-left flex items-center gap-3 ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                            : ''
                        }`}
                        onClick={() => toggleProfile(profile.id)}
                      >
                        <span
                          className={`w-5 h-5 border-2 border-[var(--pixel-border)] flex items-center justify-center text-xs ${
                            isSelected
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--bg-primary)]'
                          }`}
                        >
                          {isSelected ? '✓' : ''}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-pixel text-xs text-[var(--text-primary)]">
                            {profile.name}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            {formatBirthDate(profile.birth_date)} · {profile.relation}
                          </p>
                        </div>
                      </button>

                      {/* Role input (shown when selected) */}
                      {isSelected && (
                        <input
                          type="text"
                          value={member?.role || ''}
                          onChange={(e) => updateRole(profile.id, e.target.value)}
                          placeholder="역할 (예: 아빠, 팀장)"
                          className="ml-8 px-3 py-1.5 text-xs border-2 border-[var(--pixel-border)] shadow-[2px_2px_0_var(--pixel-shadow)] outline-none focus:border-[var(--accent)] transition-colors"
                          maxLength={30}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit */}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || !name.trim() || selectedMembers.length === 0}
          >
            그룹 만들기
          </Button>
        </div>
      </AppShell>
    </AuthRequired>
  );
}
