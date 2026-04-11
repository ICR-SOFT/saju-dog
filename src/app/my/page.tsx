'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useAuthStore } from '@/stores/auth';
import { useCreditStore } from '@/stores/credit';
import { supabase } from '@/lib/supabase';
import type { CreditTransaction } from '@/types/user';

export default function MyPage() {
  const router = useRouter();
  const { user, signOut, updateNickname } = useAuthStore();
  const { credits, fetchCredits } = useCreditStore();

  const [editingNickname, setEditingNickname] = useState(false);
  const [nickname, setNickname] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authProvider, setAuthProvider] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  const loadTransactions = useCallback(async () => {
    const { data } = await supabase
      .from('credit_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setTransactions(data);
  }, []);

  useEffect(() => {
    fetchCredits();
    loadTransactions();

    // Get auth info
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthEmail(session.user.email || '');
        setAuthProvider(session.user.app_metadata?.provider || 'email');
      }
    });
  }, [fetchCredits, loadTransactions]);

  useEffect(() => {
    if (user?.nickname) {
      setNickname(user.nickname);
    }
  }, [user?.nickname]);

  const handleSaveNickname = async () => {
    if (!nickname.trim()) return;
    try {
      await updateNickname(nickname.trim());
      setEditingNickname(false);
    } catch {
      // silently fail
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const providerLabel: Record<string, string> = {
    email: '이메일',
    kakao: '카카오',
    google: '구글',
  };

  return (
    <AuthRequired>
      <AppShell title="마이페이지" showNav>
        <div className="px-4 py-4 flex flex-col gap-4">
          {/* User info card */}
          <Card>
            <div className="flex flex-col gap-3">
              {/* Nickname - editable */}
              <div className="flex items-center justify-between">
                {editingNickname ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="flex-1 font-pixel text-sm text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-1 border-2 border-[var(--pixel-border)] outline-none focus:border-[var(--accent)]"
                      maxLength={10}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveNickname}
                      className="font-pixel text-[10px] text-[var(--accent)] hover:underline"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNickname(false);
                        setNickname(user?.nickname || '');
                      }}
                      className="font-pixel text-[10px] text-[var(--text-muted)] hover:underline"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-pixel text-sm text-[var(--text-primary)]">
                      {user?.nickname ?? '보호자'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingNickname(true)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                    >
                      ✏️
                    </button>
                  </div>
                )}
              </div>

              {/* Email */}
              <p className="text-xs text-[var(--text-muted)]">
                {authEmail || '이메일 없음'}
              </p>

              {/* Provider badge */}
              <span className="inline-block self-start font-pixel text-[10px] px-2 py-0.5 border-2 border-[var(--pixel-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                {providerLabel[authProvider] || authProvider} 로그인
              </span>
            </div>
          </Card>

          {/* Credit card - gold border */}
          <div
            className="p-4 bg-[var(--bg-card)]"
            style={{
              border: '2px solid var(--gold)',
              boxShadow: '4px 4px 0 var(--gold-light)',
            }}
          >
            <h3 className="font-pixel text-xs text-[var(--gold)] mb-3">
              내 뼈다귀
            </h3>

            <div className="flex items-center justify-center gap-2 mb-4 py-3">
              🦴
              <span className="font-pixel text-2xl text-[var(--text-primary)]">
                {credits?.bones ?? 0}
              </span>
              <span className="font-pixel text-xs text-[var(--text-muted)]">개</span>
            </div>

            <button
              type="button"
              onClick={() => router.push('/shop')}
              className="pixel-btn pixel-btn-accent text-white font-pixel text-xs w-full py-2"
            >
              충전하기
            </button>
          </div>

          {/* Transaction History Toggle */}
          <Card>
            <button
              type="button"
              className="w-full flex items-center justify-between"
              onClick={() => setShowHistory(!showHistory)}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <div>
                  <p className="font-pixel text-xs text-[var(--text-primary)]">이용 내역</p>
                  <p className="text-[10px] text-[var(--text-muted)]">뼈다귀 사용/충전 기록</p>
                </div>
              </div>
              <span className="font-pixel text-xs text-[var(--text-muted)]">
                {showHistory ? '▲' : '▼'}
              </span>
            </button>
          </Card>

          {showHistory && (
            <Card>
              {transactions.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-3">
                  이용 내역이 없어요
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--pixel-border)] last:border-0"
                    >
                      <div>
                        <p className="text-[var(--text-primary)] font-pixel text-[10px]">
                          {tx.description?.startsWith('toss:')
                            ? '뼈다귀 충전'
                            : tx.description || tx.type}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {new Date(tx.created_at).toLocaleString('ko-KR', {
                            timeZone: 'Asia/Seoul',
                          })}
                        </p>
                      </div>
                      <span
                        className={`font-pixel text-xs ${
                          tx.bones_delta > 0
                            ? 'text-[var(--success)]'
                            : 'text-[var(--error)]'
                        }`}
                      >
                        {tx.bones_delta > 0 ? '+' : ''}
                        {tx.bones_delta} 🦴
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Logout */}
          <div className="mt-4">
            <Button
              variant="danger"
              size="md"
              className="w-full"
              onClick={handleLogout}
            >
              로그아웃
            </Button>
          </div>

          {/* Signup date */}
          <div className="text-center mt-2">
            <p className="text-[10px] text-[var(--text-muted)]">
              가입일: {user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}
            </p>
          </div>
        </div>
      </AppShell>
    </AuthRequired>
  );
}
