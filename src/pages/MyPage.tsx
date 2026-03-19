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
      <h2 className="text-xl font-bold text-dark mb-4 font-serif">마이페이지</h2>

      {/* 프로필 정보 */}
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-brown/10 flex items-center justify-center text-3xl">
            🐕
          </div>
          <div>
            <h3 className="font-bold text-dark text-lg">{user?.nickname ?? '보호자'}</h3>
            <p className="text-sm text-warm-gray">등록된 프로필 {profiles.length}개</p>
          </div>
        </div>
      </Card>

      {/* 크레딧 */}
      <Card className="mb-4">
        <h3 className="font-medium text-dark mb-3">내 재화</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-cream-dark rounded-xl p-4 text-center">
            <span className="text-2xl">🦴</span>
            <p className="font-bold text-dark text-xl mt-1">{credits?.bones ?? 0}</p>
            <p className="text-xs text-warm-gray">뼈다귀</p>
          </div>
          <div className="bg-cream-dark rounded-xl p-4 text-center">
            <span className="text-2xl">🍖</span>
            <p className="font-bold text-dark text-xl mt-1">{credits?.treats ?? 0}</p>
            <p className="text-xs text-warm-gray">간식</p>
          </div>
        </div>
      </Card>

      {/* 메뉴 */}
      <div className="space-y-2 mb-6">
        <Card padding="sm" className="cursor-pointer hover:shadow-md">
          <p className="text-sm text-dark">프로필 관리</p>
        </Card>
        <Card padding="sm" className="cursor-pointer hover:shadow-md">
          <p className="text-sm text-dark">이용 내역</p>
        </Card>
        <Card padding="sm" className="cursor-pointer hover:shadow-md">
          <p className="text-sm text-dark">설정</p>
        </Card>
      </div>

      <Button variant="ghost" size="lg" onClick={signOut} className="text-warm-gray">
        로그아웃
      </Button>
    </Layout>
  );
}
