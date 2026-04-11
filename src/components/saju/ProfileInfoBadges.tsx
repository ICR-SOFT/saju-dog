'use client';

import type { SajuPillars } from '@/types/saju';

interface ProfileInfoBadgesProps {
  sajuData: SajuPillars;
  name?: string;
}

const HOUR_NAMES: Record<number, string> = {
  0: '자시', 1: '자시', 2: '축시', 3: '축시', 4: '인시', 5: '인시',
  6: '묘시', 7: '묘시', 8: '진시', 9: '진시', 10: '사시', 11: '사시',
  12: '오시', 13: '오시', 14: '미시', 15: '미시', 16: '신시', 17: '신시',
  18: '유시', 19: '유시', 20: '술시', 21: '술시', 22: '해시', 23: '해시',
};

export default function ProfileInfoBadges({ sajuData, name }: ProfileInfoBadgesProps) {
  const { input, ddi, zodiac } = sajuData;
  const birthDate = new Date(input.birthDate);
  const dateStr = birthDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const hour = birthDate.getHours();
  const minute = birthDate.getMinutes();
  const hourName = HOUR_NAMES[hour] || '';
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}${hourName ? ` (${hourName})` : ''}`;
  const calendarLabel = input.calendarType === 'solar' ? '양력' : input.calendarType === 'lunar' ? '음력' : '윤달';
  const genderLabel = input.gender === 'male' ? '남' : '여';

  return (
    <div className="flex flex-wrap gap-1.5">
      {name && (
        <span className="pixel-border-sm px-2 py-0.5 text-[10px] font-pixel text-[var(--text-primary)] bg-[var(--bg-card)]">
          {name}
        </span>
      )}
      <span className="pixel-border-sm px-2 py-0.5 text-[10px] text-[var(--text-secondary)] bg-[var(--bg-card)]">
        {dateStr} ({calendarLabel})
      </span>
      <span className="pixel-border-sm px-2 py-0.5 text-[10px] text-[var(--text-secondary)] bg-[var(--bg-card)]">
        {timeStr}
      </span>
      <span className="pixel-border-sm px-2 py-0.5 text-[10px] text-[var(--text-secondary)] bg-[var(--bg-card)]">
        {genderLabel}
      </span>
      {ddi && (
        <span className="pixel-border-sm px-2 py-0.5 text-[10px] text-[var(--text-secondary)] bg-[var(--bg-card)]">
          {ddi.fullName}
        </span>
      )}
      {zodiac && (
        <span className="pixel-border-sm px-2 py-0.5 text-[10px] text-[var(--text-secondary)] bg-[var(--bg-card)]">
          {zodiac.emoji} {zodiac.name}
        </span>
      )}
    </div>
  );
}
