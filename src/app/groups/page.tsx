'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import { supabase, getValidSession } from '@/lib/supabase';

interface GroupMember {
  id: string;
  profile_id: string;
  role: string | null;
  saju_profiles: {
    id: string;
    name: string;
    birth_date: string;
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

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<ProfileGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    const session = await getValidSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('profile_groups')
      .select('*, profile_group_members(*, saju_profiles(id, name, birth_date))')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setGroups(data as ProfileGroup[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return (
    <AuthRequired>
      <AppShell title="그룹" showNav>
        <div className="p-4 flex flex-col gap-4 animate-fade-in">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => router.push('/groups/create')}
          >
            + 그룹 만들기
          </Button>

          {isLoading ? (
            <Loading message="그룹을 불러오는 중..." />
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <span className="text-4xl">👥</span>
              <p className="font-pixel text-xs text-[var(--text-muted)] text-center">
                아직 그룹이 없어요
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                프로필을 모아 그룹을 만들어보세요!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((group) => {
                const memberNames = group.profile_group_members
                  .map((m) => m.saju_profiles?.name)
                  .filter(Boolean)
                  .join(', ');
                const memberCount = group.profile_group_members.length;

                return (
                  <button
                    key={group.id}
                    type="button"
                    className="pixel-card p-4 w-full text-left flex flex-col gap-2"
                    onClick={() => router.push(`/groups/${group.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-pixel text-xs text-[var(--text-primary)]">
                        {group.name}
                      </p>
                      <span className="font-pixel text-[10px] text-[var(--text-muted)]">
                        {memberCount}명
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-[10px] text-[var(--text-muted)] truncate">
                        {group.description}
                      </p>
                    )}
                    {memberNames && (
                      <p className="text-[10px] text-[var(--text-secondary)] truncate">
                        {memberNames}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
    </AuthRequired>
  );
}
