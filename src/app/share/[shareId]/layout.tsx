import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const SERVICE_NAMES: Record<string, string> = {
  comprehensive: '종합 사주', compatibility: '궁합', daeun: '대운 분석', yearly: '올해 운세',
  daily: '오늘의 운세', love: '연애운', wealth: '재물운', health: '건강운', career: '직업운',
  business: '동업 궁합', luckyday: '길일 택일', pastlife: '전생', moving: '이사운',
  mbti: '사주 MBTI', pet: '반려동물', travel: '여행 운세', food: '식복', color: '퍼스널컬러',
  study: '합격 기운', ancestor: '조상 음덕', child: '자녀운', secret: '숨겨진 재능', timing: '황금 타이밍',
  chat: '멍도령 상담',
};

interface Props {
  params: Promise<{ shareId: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from('readings')
      .select('service_type, result, og_image_url')
      .eq('share_id', shareId)
      .single();

    if (!data) {
      return { title: '사주독 - 풀이 공유' };
    }

    const serviceName = SERVICE_NAMES[data.service_type] || data.service_type;
    const result = data.result as Record<string, unknown> | null;
    const summary = result?.summary
      ? String(result.summary).replace(/<[^>]*>/g, '').slice(0, 150)
      : '사주독에서 사주 풀이를 확인해보세요';

    const ogImage = data.og_image_url || '/images/og-image-pixel.png';

    return {
      title: `${serviceName} 풀이 결과 - 사주독`,
      description: summary,
      openGraph: {
        title: `${serviceName} 풀이 결과 - 사주독`,
        description: summary,
        images: [{ url: ogImage, width: 1200, height: 630 }],
        type: 'article',
        siteName: '사주독',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${serviceName} 풀이 결과 - 사주독`,
        description: summary,
        images: [ogImage],
      },
    };
  } catch {
    return {
      title: '사주독 - 사주 풀이',
      description: '멍도령과 함께하는 사주 풀이 서비스',
    };
  }
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
