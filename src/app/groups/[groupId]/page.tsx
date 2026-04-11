'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import { showToast } from '@/components/ui/Toast';
import { useSajuStore } from '@/stores/saju';
import { supabase } from '@/lib/supabase';
import { requestReading } from '@/lib/api';

interface GroupMember {
  id: string;
  profile_id: string;
  role: string | null;
  saju_profiles: {
    id: string;
    name: string;
    birth_date: string;
    gender: string;
  } | null;
}

interface ProfileGroup {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  profile_group_members: GroupMember[];
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const { profiles, fetchProfiles } = useSajuStore();

  const [group, setGroup] = useState<ProfileGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState('');
  const [selectedNewProfileId, setSelectedNewProfileId] = useState('');

  const loadGroup = useCallback(async () => {
    const { data, error } = await supabase
      .from('profile_groups')
      .select('*, profile_group_members(*, saju_profiles(id, name, birth_date, gender))')
      .eq('id', groupId)
      .single();

    if (!error && data) {
      setGroup(data as ProfileGroup);
    }
    setIsLoading(false);
  }, [groupId]);

  useEffect(() => {
    fetchProfiles();
    loadGroup();
  }, [fetchProfiles, loadGroup]);

  const handleGroupReading = async () => {
    if (!group || group.profile_group_members.length < 2) {
      showToast('그룹 풀이에는 2명 이상의 멤버가 필요해요');
      return;
    }

    setIsRequesting(true);

    try {
      const memberIds = group.profile_group_members
        .map((m) => m.profile_id)
        .filter(Boolean);
      const primaryId = memberIds[0];
      const secondaryId = memberIds.length > 1 ? memberIds[1] : undefined;

      const metadata: Record<string, string> = {
        allProfileIds: JSON.stringify(memberIds),
        relationType: group.description || group.name,
        groupId: group.id,
        groupName: group.name,
      };

      await requestReading(primaryId, 'compatibility', secondaryId, false, metadata);
      showToast('그룹 풀이를 요청했어요!');
      router.push('/archive');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '풀이 요청에 실패했어요');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group) return;

    try {
      const { error } = await supabase
        .from('profile_groups')
        .delete()
        .eq('id', group.id);

      if (error) throw new Error(error.message);

      showToast('그룹이 삭제되었어요');
      router.push('/groups');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제에 실패했어요');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('profile_group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw new Error(error.message);

      showToast('멤버가 제거되었어요');
      loadGroup();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '제거에 실패했어요');
    }
  };

  const handleAddMember = async () => {
    if (!selectedNewProfileId || !group) return;

    try {
      const { error } = await supabase
        .from('profile_group_members')
        .insert({
          group_id: group.id,
          profile_id: selectedNewProfileId,
          role: newMemberRole.trim() || null,
        });

      if (error) throw new Error(error.message);

      showToast('멤버가 추가되었어요');
      setShowAddMember(false);
      setSelectedNewProfileId('');
      setNewMemberRole('');
      loadGroup();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '추가에 실패했어요');
    }
  };

  // Profiles not already in the group
  const availableProfiles = profiles.filter(
    (p) => !group?.profile_group_members.some((m) => m.profile_id === p.id),
  );

  return (
    <AuthRequired>
      <AppShell title={group?.name || '그룹'} showBack>
        <div className="p-4 flex flex-col gap-6 animate-fade-in">
          {isLoading ? (
            <Loading message="그룹 정보를 불러오는 중..." />
          ) : !group ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <p className="font-pixel text-xs text-[var(--error)]">
                그룹을 찾을 수 없어요
              </p>
              <Button variant="secondary" onClick={() => router.push('/groups')}>
                목록으로
              </Button>
            </div>
          ) : (
            <>
              {/* Group Info */}
              {group.description && (
                <div className="pixel-card p-3">
                  <p className="text-xs text-[var(--text-secondary)]">
                    {group.description}
                  </p>
                </div>
              )}

              {/* Members */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-pixel text-xs text-[var(--text-secondary)]">
                    멤버 ({group.profile_group_members.length}명)
                  </h3>
                  <button
                    type="button"
                    className="font-pixel text-[10px] text-[var(--accent)]"
                    onClick={() => setShowAddMember(!showAddMember)}
                  >
                    {showAddMember ? '취소' : '+ 추가'}
                  </button>
                </div>

                {/* Add Member Form */}
                {showAddMember && (
                  <div className="pixel-card p-3 flex flex-col gap-2 border-[var(--accent)]">
                    {availableProfiles.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] text-center py-2">
                        추가할 수 있는 프로필이 없어요
                      </p>
                    ) : (
                      <>
                        <select
                          value={selectedNewProfileId}
                          onChange={(e) => setSelectedNewProfileId(e.target.value)}
                          className="px-3 py-2 text-xs border-2 border-[var(--pixel-border)] outline-none focus:border-[var(--accent)] bg-[var(--bg-primary)]"
                        >
                          <option value="">프로필 선택</option>
                          {availableProfiles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.birth_date})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={newMemberRole}
                          onChange={(e) => setNewMemberRole(e.target.value)}
                          placeholder="역할 (선택)"
                          className="px-3 py-1.5 text-xs border-2 border-[var(--pixel-border)] outline-none focus:border-[var(--accent)]"
                          maxLength={30}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleAddMember}
                          disabled={!selectedNewProfileId}
                        >
                          추가
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Member List */}
                {group.profile_group_members.map((member) => (
                  <div
                    key={member.id}
                    className="pixel-card p-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-pixel text-xs text-[var(--text-primary)]">
                        {member.saju_profiles?.name || '알 수 없음'}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {member.saju_profiles?.birth_date}
                        {member.role && ` · ${member.role}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors p-1 font-pixel text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Group Reading Button */}
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleGroupReading}
                loading={isRequesting}
                disabled={isRequesting || group.profile_group_members.length < 2}
              >
                그룹 풀이 시작
              </Button>

              {group.profile_group_members.length < 2 && (
                <p className="text-[10px] text-[var(--text-muted)] text-center">
                  그룹 풀이에는 2명 이상의 멤버가 필요해요
                </p>
              )}

              {/* Delete Group */}
              {showDeleteConfirm ? (
                <div className="pixel-card p-4 border-[var(--error)] flex flex-col gap-3">
                  <p className="font-pixel text-xs text-[var(--text-primary)] text-center">
                    정말 이 그룹을 삭제할까요?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      취소
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={handleDeleteGroup}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="font-pixel text-[10px] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors text-center mt-1"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  그룹 삭제
                </button>
              )}
            </>
          )}
        </div>
      </AppShell>
    </AuthRequired>
  );
}
