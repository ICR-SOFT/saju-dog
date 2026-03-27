/**
 * 프로필 생년월일/성별/생시 배지
 * 사주 상세, 보관함 상세, 공유 상세 페이지 상단에 표시
 */

interface ProfileInfoBadgesProps {
  birthDate: string;       // ISO string
  calendarType: string;    // 'solar' | 'lunar' | 'lunar_leap'
  gender: string;          // 'male' | 'female'
  className?: string;
}

const CALENDAR_LABELS: Record<string, string> = {
  solar: '양력',
  lunar: '음력',
  lunar_leap: '윤달',
};

export function ProfileInfoBadges({ birthDate, calendarType, gender, className = '' }: ProfileInfoBadgesProps) {
  const date = new Date(birthDate);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');

  const genderLabel = gender === 'male' ? '♂ 남' : '♀ 여';
  const calLabel = CALENDAR_LABELS[calendarType] || '양력';
  const dateStr = `${y}.${m}.${d}`;
  const timeStr = `${hh}:${mm}생`;

  return (
    <div className={`flex flex-wrap gap-1.5 justify-center ${className}`}>
      <span className="text-[11px] bg-warm-gray/10 text-warm-gray rounded-full px-2.5 py-0.5">
        {genderLabel}
      </span>
      <span className="text-[11px] bg-warm-gray/10 text-warm-gray rounded-full px-2.5 py-0.5">
        {dateStr} {calLabel}
      </span>
      <span className="text-[11px] bg-warm-gray/10 text-warm-gray rounded-full px-2.5 py-0.5">
        {timeStr}
      </span>
    </div>
  );
}
