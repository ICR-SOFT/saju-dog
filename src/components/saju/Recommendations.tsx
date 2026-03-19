import { useNavigate } from 'react-router';
import type { ServiceType } from '@/types/saju.ts';

interface Recommendation {
  type: ServiceType;
  title: string;
  subtitle: string;
  emoji: string;
  cost: string;
  gradient: string;
}

const RECOMMENDATIONS: Recommendation[] = [
  {
    type: 'compatibility',
    title: '우리 사이는 몇점?',
    subtitle: 'SNS에서 소문난 궁합 맛집',
    emoji: '💕',
    cost: '🦴 3',
    gradient: 'from-pink-50 to-rose-50',
  },
  {
    type: 'daeun',
    title: '대운을 아직 모르신다구요?',
    subtitle: '언제 물 들어오는지 한번 확인해보자구요',
    emoji: '🌊',
    cost: '🦴 2',
    gradient: 'from-teal-50 to-cyan-50',
  },
  {
    type: 'yearly',
    title: '특정 연도의 사주가 궁금하다면?',
    subtitle: '내후년 운세는 어떨까?',
    emoji: '📅',
    cost: '🦴 2',
    gradient: 'from-violet-50 to-purple-50',
  },
  {
    type: 'daily',
    title: '아참, 오늘의 무료 운세는 챙겨보셨죠?',
    subtitle: '간단한 한줄운세는 이제 그만~',
    emoji: '🌅',
    cost: '무료',
    gradient: 'from-orange-50 to-yellow-50',
  },
  {
    type: 'luckyday',
    title: '중요한 일일수록 좋은 날에!',
    subtitle: 'Top 3 길일을 골라드려요',
    emoji: '🗓️',
    cost: '🦴 2',
    gradient: 'from-amber-50 to-yellow-50',
  },
  {
    type: 'chat',
    title: '더 궁금한 점이 있다면?',
    subtitle: '복돌이에게 직접 물어보세요!',
    emoji: '💬',
    cost: '🦴 1',
    gradient: 'from-sky-50 to-blue-50',
  },
];

interface RecommendationsProps {
  /** Exclude these service types from recommendations */
  exclude?: ServiceType[];
  /** Max number to show */
  limit?: number;
}

export function Recommendations({ exclude = [], limit = 5 }: RecommendationsProps) {
  const navigate = useNavigate();

  const items = RECOMMENDATIONS
    .filter(r => !exclude.includes(r.type))
    .slice(0, limit);

  if (items.length === 0) return null;

  const handleClick = (type: ServiceType) => {
    switch (type) {
      case 'comprehensive':
        navigate('/');
        break;
      case 'compatibility':
        navigate('/compatibility');
        break;
      case 'daily':
        navigate('/daily');
        break;
      case 'chat':
        navigate('/chat');
        break;
      default:
        // Not yet implemented - go to home
        navigate('/');
        break;
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-base font-bold text-dark mb-3 flex items-center gap-2">
        <span>🐾</span> 이것도 봐보세요
      </h3>
      <div className="space-y-2">
        {items.map(rec => (
          <div
            key={rec.type}
            onClick={() => handleClick(rec.type)}
            className={`flex items-center gap-3 rounded-xl px-4 py-3.5 bg-gradient-to-r ${rec.gradient} cursor-pointer hover:shadow-md active:scale-[0.99] transition-all`}
          >
            <span className="text-2xl flex-shrink-0">{rec.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-dark text-sm leading-snug">{rec.title}</p>
              <p className="text-xs text-warm-gray mt-0.5">{rec.subtitle}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] font-medium text-brown bg-white/60 rounded-full px-2 py-0.5 border border-brown/10">
                {rec.cost}
              </span>
              <span className="text-warm-gray text-sm">›</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
