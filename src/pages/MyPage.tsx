import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useAuthStore } from '@/stores/auth.ts';
import { useCreditStore } from '@/stores/credit.ts';
import { useSajuStore } from '@/stores/saju.ts';
import { Logo } from '@/components/ui/Logo.tsx';
import { supabase } from '@/lib/supabase.ts';
import type { CreditTransaction } from '@/types/user.ts';

export function MyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, updateNickname, sessionUserId } = useAuthStore();
  const { credits, fetchCredits } = useCreditStore();
  const { profiles } = useSajuStore();

  const [editingNickname, setEditingNickname] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authProvider, setAuthProvider] = useState('');

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

    // 인증 정보
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthEmail(session.user.email || '');
        setAuthProvider(session.user.app_metadata?.provider || 'email');
      }
    });
  }, [fetchCredits, loadTransactions, location.key]);

  const handleSaveNickname = async () => {
    if (!nickname.trim()) return;
    try {
      await updateNickname(nickname.trim());
      setEditingNickname(false);
    } catch {}
  };

  const providerLabel: Record<string, string> = {
    email: '이메일',
    kakao: '카카오',
    google: 'Google',
  };

  return (
    <Layout>
      {/* 헤더 */}
      <div className="text-center mb-5 -mx-4 -mt-4 px-4 pt-6 pb-6 gradient-hero rounded-b-3xl">
        <Logo size="xl" className="mx-auto mb-3 border-2 border-brown/15 shadow-md" />

        {editingNickname ? (
          <div className="flex items-center justify-center gap-2 mt-1">
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="text-center text-lg font-bold text-dark font-serif bg-white/80 rounded-lg px-3 py-1 border border-brown/20 outline-none w-32"
              maxLength={10}
              autoFocus
            />
            <button onClick={handleSaveNickname} className="text-brown text-sm font-medium">저장</button>
            <button onClick={() => { setEditingNickname(false); setNickname(user?.nickname || ''); }} className="text-warm-gray text-sm">취소</button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1">
            <h2 className="text-xl font-bold text-dark font-serif">{user?.nickname ?? '보호자'}님</h2>
            <button onClick={() => setEditingNickname(true)} className="text-warm-gray-light text-xs ml-1">수정</button>
          </div>
        )}

        <p className="text-xs text-warm-gray mt-1">
          {providerLabel[authProvider] || authProvider} 로그인
          {authEmail && ` · ${authEmail}`}
        </p>
        <p className="text-xs text-warm-gray">등록된 프로필 {profiles.length}개</p>
      </div>

      {/* 크레딧 + 충전 */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-dark flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">💰</span>
            내 재화
          </h3>
          <Button size="sm" onClick={() => navigate('/shop')}>충전하기</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 text-center border border-amber-100/50">
            <span className="text-3xl">🦴</span>
            <p className="font-bold text-dark text-2xl mt-1 font-serif">{credits?.bones ?? 0}</p>
            <p className="text-xs text-warm-gray font-medium">뼈다귀</p>
          </div>
          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-4 text-center border border-rose-100/50">
            <span className="text-3xl">🍖</span>
            <p className="font-bold text-dark text-2xl mt-1 font-serif">{credits?.treats ?? 0}</p>
            <p className="text-xs text-warm-gray font-medium">간식</p>
          </div>
        </div>
      </Card>

      {/* 메뉴 */}
      <div className="space-y-2 mb-4">
        <Card
          padding="sm"
          className="cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
          onClick={() => navigate('/')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brown/5 flex items-center justify-center border border-brown/10">
              <span className="text-lg">👤</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-dark">프로필 관리</p>
              <p className="text-xs text-warm-gray">홈에서 프로필을 추가/수정할 수 있어요</p>
            </div>
            <span className="text-warm-gray-light text-sm">&rsaquo;</span>
          </div>
        </Card>

        <Card
          padding="sm"
          className="cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
          onClick={() => setShowHistory(!showHistory)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brown/5 flex items-center justify-center border border-brown/10">
              <span className="text-lg">📋</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-dark">이용 내역</p>
              <p className="text-xs text-warm-gray">뼈다귀 사용/충전 기록</p>
            </div>
            <span className="text-warm-gray-light text-sm">{showHistory ? '∧' : '∨'}</span>
          </div>
        </Card>

        {showHistory && (
          <Card padding="sm">
            {transactions.length === 0 ? (
              <p className="text-xs text-warm-gray text-center py-3">이용 내역이 없어요</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between text-xs py-1 border-b border-cream-dark/50 last:border-0">
                    <div>
                      <p className="text-dark font-medium">
                        {tx.description?.startsWith('toss:') ? '뼈다귀 충전' : tx.description || tx.type}
                      </p>
                      <p className="text-warm-gray text-[10px]">
                        {new Date(tx.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                      </p>
                    </div>
                    <span className={`font-bold ${tx.bones_delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.bones_delta > 0 ? '+' : ''}{tx.bones_delta} 🦴
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <Card
          padding="sm"
          className="cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
          onClick={() => navigate('/shop')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brown/5 flex items-center justify-center border border-brown/10">
              <span className="text-lg">🛒</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-dark">뼈다귀 충전</p>
              <p className="text-xs text-warm-gray">토스페이먼츠로 안전하게 결제</p>
            </div>
            <span className="text-warm-gray-light text-sm">&rsaquo;</span>
          </div>
        </Card>
      </div>

      <Button variant="ghost" size="lg" onClick={signOut} className="text-warm-gray">
        로그아웃
      </Button>

      <div className="text-center mt-4 mb-2">
        <p className="text-[10px] text-warm-gray-light">
          가입일: {user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}
          {sessionUserId && ` · ID: ${sessionUserId.slice(0, 8)}...`}
        </p>
      </div>
    </Layout>
  );
}
