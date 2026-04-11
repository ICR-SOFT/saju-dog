/**
 * 띠 (동물 + 색상) + 별자리 (서양 조디악) 계산
 */

import type { Stem, Branch } from '@/types/saju';

// ===== 띠 (12동물) =====
const ANIMAL_MAP: Record<Branch, string> = {
  '자': '쥐', '축': '소', '인': '호랑이', '묘': '토끼',
  '진': '용', '사': '뱀', '오': '말', '미': '양',
  '신': '원숭이', '유': '닭', '술': '개', '해': '돼지',
};

// ===== 천간 → 색상 (오행색) =====
const STEM_COLOR: Record<Stem, string> = {
  '갑': '푸른', '을': '푸른',   // 목 = 청
  '병': '붉은', '정': '붉은',   // 화 = 적
  '무': '노란', '기': '노란',   // 토 = 황
  '경': '하얀', '신': '하얀',   // 금 = 백
  '임': '검은', '계': '검은',   // 수 = 흑
};

export interface DdiInfo {
  animal: string;       // "돼지"
  color: string;        // "푸른"
  fullName: string;     // "푸른 돼지띠"
  hanja: string;        // "乙亥"
}

export function calculateDdi(yearStem: Stem, yearBranch: Branch): DdiInfo {
  return {
    animal: ANIMAL_MAP[yearBranch],
    color: STEM_COLOR[yearStem],
    fullName: `${STEM_COLOR[yearStem]} ${ANIMAL_MAP[yearBranch]}띠`,
    hanja: `${yearStem}${yearBranch}`,
  };
}

// ===== 별자리 (서양 조디악) =====

interface ZodiacSign {
  name: string;
  emoji: string;
  english: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

const ZODIAC_SIGNS: ZodiacSign[] = [
  { name: '물병자리', emoji: '♒', english: 'Aquarius', startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  { name: '물고기자리', emoji: '♓', english: 'Pisces', startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
  { name: '양자리', emoji: '♈', english: 'Aries', startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  { name: '황소자리', emoji: '♉', english: 'Taurus', startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  { name: '쌍둥이자리', emoji: '♊', english: 'Gemini', startMonth: 5, startDay: 21, endMonth: 6, endDay: 21 },
  { name: '게자리', emoji: '♋', english: 'Cancer', startMonth: 6, startDay: 22, endMonth: 7, endDay: 22 },
  { name: '사자자리', emoji: '♌', english: 'Leo', startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { name: '처녀자리', emoji: '♍', english: 'Virgo', startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { name: '천칭자리', emoji: '♎', english: 'Libra', startMonth: 9, startDay: 23, endMonth: 10, endDay: 23 },
  { name: '전갈자리', emoji: '♏', english: 'Scorpio', startMonth: 10, startDay: 24, endMonth: 11, endDay: 22 },
  { name: '궁수자리', emoji: '♐', english: 'Sagittarius', startMonth: 11, startDay: 23, endMonth: 12, endDay: 21 },
  { name: '염소자리', emoji: '♑', english: 'Capricorn', startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
];

export interface ZodiacInfo {
  name: string;
  emoji: string;
  english: string;
}

export function calculateZodiac(month: number, day: number): ZodiacInfo {
  for (const sign of ZODIAC_SIGNS) {
    if (sign.startMonth === sign.endMonth) {
      if (month === sign.startMonth && day >= sign.startDay && day <= sign.endDay) {
        return { name: sign.name, emoji: sign.emoji, english: sign.english };
      }
    } else if (sign.endMonth < sign.startMonth) {
      // 염소자리 (12월~1월)
      if ((month === sign.startMonth && day >= sign.startDay) ||
          (month === sign.endMonth && day <= sign.endDay)) {
        return { name: sign.name, emoji: sign.emoji, english: sign.english };
      }
    } else {
      if ((month === sign.startMonth && day >= sign.startDay) ||
          (month === sign.endMonth && day <= sign.endDay)) {
        return { name: sign.name, emoji: sign.emoji, english: sign.english };
      }
    }
  }
  // fallback
  return { name: '염소자리', emoji: '♑', english: 'Capricorn' };
}
