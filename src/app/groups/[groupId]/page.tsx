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
import { requestReading, pollReadingStatus, createChatSession, sendChatMessage } from '@/lib/api';
import { formatBirthDate } from '@/lib/format';
import { SERVICE_NAMES } from '@/lib/services';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CostBadge from '@/components/ui/CostBadge';
import { CREDIT_COSTS } from '@/types/api';
import type { ServiceType } from '@/types/saju';

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

interface GroupReading {
  id: string;
  service_type: string;
  processing_status: string;
  result: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const { profiles, fetchProfiles } = useSajuStore();

  const [group, setGroup] = useState<ProfileGroup | null>(null);
  const [groupReadings, setGroupReadings] = useState<GroupReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loadingStart, setLoadingStart] = useState(0);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [currentReadingId, setCurrentReadingId] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<Record<string, unknown> | null>(null);
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

  const loadGroupReadings = useCallback(async () => {
    const { data } = await supabase
      .from('readings')
      .select('id, service_type, processing_status, result, metadata, created_at')
      .eq('processing_status', 'completed')
      .order('created_at', { ascending: false });

    if (data) {
      // Filter client-side: metadata.groupId must match this group
      const filtered = data.filter((r) => {
        const meta = r.metadata as Record<string, unknown> | null;
        return meta?.groupId === groupId;
      });
      setGroupReadings(filtered as GroupReading[]);
    }
  }, [groupId]);

  useEffect(() => {
    fetchProfiles();
    loadGroup();
    loadGroupReadings();
  }, [fetchProfiles, loadGroup, loadGroupReadings]);

  // 로딩 타이머
  useEffect(() => {
    if (!isRequesting) return;
    const interval = setInterval(() => {
      setLoadingElapsed(Date.now() - loadingStart);
    }, 500);
    return () => clearInterval(interval);
  }, [isRequesting, loadingStart]);

  const handleGroupReading = async (question?: string) => {
    if (!group || group.profile_group_members.length < 2) {
      showToast('그룹 풀이에는 2명 이상의 멤버가 필요해요');
      return;
    }

    setShowConfirm(false);
    setIsRequesting(true);
    setLoadingStart(Date.now());
    setLoadingElapsed(0);
    setCompletedResult(null);

    try {
      const memberIds = group.profile_group_members.map((m) => m.profile_id).filter(Boolean);
      const primaryId = memberIds[0];
      const secondaryId = memberIds.length > 1 ? memberIds[1] : undefined;

      const metadata: Record<string, string> = {
        allProfileIds: JSON.stringify(memberIds),
        relationType: group.description || group.name,
        groupId: group.id,
        groupName: group.name,
      };
      if (question) metadata.userQuestion = question;

      const reqResult = await requestReading(primaryId, 'compatibility', secondaryId, false, metadata);
      const readingId = reqResult.readingId;
      setCurrentReadingId(readingId);

      if (reqResult.cached && reqResult.result) {
        setIsRequesting(false);
        router.push(`/archive/${readingId}`);
        return;
      }

      // 폴링
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const status = await pollReadingStatus(readingId);
        if (status.status === 'completed' && status.result) {
          setCompletedResult(status.result as Record<string, unknown>);
          setIsRequesting(false);
          loadGroupReadings();
          router.push(`/archive/${readingId}`);
          return;
        }
        if (status.status === 'failed') {
          showToast(status.failure_reason || '풀이에 실패했어요');
          setIsRequesting(false);
          return;
        }
      }
      showToast('시간이 초과되었어요. 기록에서 확인해주세요.');
      setIsRequesting(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '풀이 요청에 실패했어요');
      setIsRequesting(false);
    }
  };

  const handleChatAboutGroup = async () => {
    if (!group || !currentReadingId) return;
    try {
      const primaryId = group.profile_group_members[0]?.profile_id;
      if (!primaryId) return;
      const session = await createChatSession(primaryId);
      const names = group.profile_group_members.map(m => m.saju_profiles?.name).filter(Boolean).join(', ');
      await sendChatMessage(session.id, `[그룹 풀이: ${group.name}]\n멤버: ${names}\n\n이 그룹의 풀이 결과에 대해 궁금한 점을 물어보세요.`);
      router.push(`/chat?sessionId=${session.id}`);
    } catch {
      showToast('채팅 세션 생성에 실패했어요');
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
                              {p.name} ({formatBirthDate(p.birth_date)})
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
                        {member.saju_profiles?.birth_date ? formatBirthDate(member.saju_profiles.birth_date) : ''}
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

              {/* Group Readings History */}
              <div className="flex flex-col gap-3">
                <h3 className="font-pixel text-xs text-[var(--text-secondary)]">
                  풀이 기록
                </h3>
                {groupReadings.length === 0 ? (
                  <div className="pixel-card p-4 text-center">
                    <p className="font-pixel text-[10px] text-[var(--text-muted)]">
                      아직 그룹 풀이 기록이 없어요
                    </p>
                  </div>
                ) : (
                  groupReadings.map((reading) => {
                    const serviceType = reading.service_type as ServiceType;
                    const name = SERVICE_NAMES[serviceType] || reading.service_type;
                    const date = new Date(reading.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });
                    const overallScore = reading.result?.overallScore as number | undefined;

                    return (
                      <button
                        key={reading.id}
                        type="button"
                        className="pixel-card p-3 w-full text-left flex items-center gap-3"
                        onClick={() => router.push(`/archive/${reading.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-pixel text-xs text-[var(--text-primary)] truncate">
                            {name}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {date}
                          </p>
                        </div>
                        {overallScore != null && (
                          <span className="font-pixel text-xs text-[var(--accent)] shrink-0">
                            {overallScore}점
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Group Reading Button */}
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => setShowConfirm(true)}
                loading={isRequesting}
                disabled={isRequesting || group.profile_group_members.length < 2}
              >
                그룹 풀이 시작 <CostBadge cost={CREDIT_COSTS.compatibility.bones} className="ml-2" />
              </Button>

              {/* 로딩 게이지 */}
              {isRequesting && (() => {
                const est = 90000 * 1.2;
                const progress = Math.min((loadingElapsed / est) * 100, 95);
                const remainSec = Math.max(0, Math.round((est - loadingElapsed) / 1000));
                return (
                  <div className="pixel-border-accent p-3 bg-[var(--accent-light)] flex flex-col gap-2">
                    <p className="font-pixel text-[10px] text-[var(--accent)] text-center">그룹 풀이 분석 중...</p>
                    <div className="w-full h-3 border-2 border-[var(--accent)] bg-white">
                      <div className="h-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-[var(--text-muted)]">
                      <span>{Math.round(loadingElapsed / 1000)}초 경과</span>
                      <span>약 {remainSec}초 남음</span>
                    </div>
                  </div>
                );
              })()}

              {/* 완료 후 채팅 이어가기 */}
              {currentReadingId && !isRequesting && (
                <Button variant="secondary" className="w-full" onClick={handleChatAboutGroup}>
                  이 풀이에 대해 질문하기
                </Button>
              )}

              {group.profile_group_members.length < 2 && (
                <p className="text-[10px] text-[var(--text-muted)] text-center">
                  그룹 풀이에는 2명 이상의 멤버가 필요해요
                </p>
              )}

              {/* ConfirmModal */}
              <ConfirmModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleGroupReading}
                title="그룹 풀이"
                message={`${group.profile_group_members.map(m => m.saju_profiles?.name).filter(Boolean).join(' & ')}의 그룹 궁합을 분석할까요?`}
                confirmText={`🦴 ${CREDIT_COSTS.compatibility.bones} 시작`}
                showQuestion
              />

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
