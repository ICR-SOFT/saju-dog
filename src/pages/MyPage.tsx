import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useAuthStore } from '@/stores/auth.ts';
import { useCreditStore } from '@/stores/credit.ts';
import { useSajuStore } from '@/stores/saju.ts';

export function MyPage() {
  const { user, signOut } = useAuthStore();
  const { credits } = useCreditStore();
  const { profiles } = useSajuStore();

  return (
    <Layout>
      {/* 헤더 */}
      <div className="text-center mb-5 -mx-4 -mt-4 px-4 pt-6 pb-6 gradient-hero rounded-b-3xl">
        <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-brown/10 flex items-center justify-center border-2 border-brown/15 shadow-md">
          <span className="text-4xl">🐕</span>
        </div>
        <h2 className="text-xl font-bold text-dark font-serif">{user?.nickname ?? '보호자'}님</h2>
        <p className="text-sm text-warm-gray mt-1">등록된 프로필 {profiles.length}개</p>
      </div>

      {/* 크레딧 */}
      <Card className="mb-4">
        <h3 className="font-bold text-dark mb-3 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">💰</span>
          내 재화
        </h3>
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
      <div className="space-y-2 mb-6">
        {[
          { label: '프로필 관리', emoji: '👤', desc: '등록된 프로필을 관리해요' },
          { label: '이용 내역', emoji: '📋', desc: '서비스 이용 기록을 확인해요' },
          { label: '설정', emoji: '⚙️', desc: '앱 설정을 변경해요' },
        ].map(item => (
          <Card key={item.label} padding="sm" className="cursor-pointer hover:shadow-md active:scale-[0.99] transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brown/5 flex items-center justify-center border border-brown/10">
                <span className="text-lg">{item.emoji}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-dark">{item.label}</p>
                <p className="text-xs text-warm-gray">{item.desc}</p>
              </div>
              <span className="text-warm-gray-light text-sm">&rsaquo;</span>
            </div>
          </Card>
        ))}
      </div>

      <Button variant="ghost" size="lg" onClick={signOut} className="text-warm-gray">
        로그아웃
      </Button>

      {/* 복돌이 */}
      <div className="text-center mt-6 mb-2">
        <span className="text-4xl animate-float inline-block">🐕</span>
        <p className="text-xs text-warm-gray-light mt-1">복돌이가 항상 응원해요!</p>
      </div>
    </Layout>
  );
}
