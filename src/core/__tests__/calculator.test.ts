import { describe, it, expect } from 'vitest';
import { calculateSaju, toTrueSolarTime } from '../calculator.ts';
import type { SajuInput } from '@/types/saju.ts';

/**
 * 교차검증 케이스 — 사주아이(sajuai.com) 결과와 대조 검증
 */

describe('만세력 계산 엔진', () => {
  describe('라태웅 — 사주아이 기준 검증 (진태양시 적용)', () => {
    const sajuInput: SajuInput = {
      name: '라태웅',
      birthDate: new Date(1995, 4, 7, 9, 17), // 1995-05-07 09:17
      gender: 'male',
      calendarType: 'solar',
      useTrueSolar: true,
      longitude: 126.978, // 서울
    };

    const result = calculateSaju(sajuInput);

    it('년주: 을해(乙亥)', () => {
      expect(result.pillars.year.stem).toBe('을');
      expect(result.pillars.year.branch).toBe('해');
    });

    it('월주: 신사(辛巳)', () => {
      expect(result.pillars.month.stem).toBe('신');
      expect(result.pillars.month.branch).toBe('사');
    });

    it('일주: 무술(戊戌)', () => {
      expect(result.pillars.day.stem).toBe('무');
      expect(result.pillars.day.branch).toBe('술');
    });

    it('시주: 병진(丙辰) — 진태양시로 9:17→약8:48 → 진시', () => {
      expect(result.pillars.hour.stem).toBe('병');
      expect(result.pillars.hour.branch).toBe('진');
    });

    it('띠: 푸른 돼지띠 (을해년)', () => {
      expect(result.ddi.fullName).toBe('푸른 돼지띠');
    });

    it('별자리: 황소자리 (5월 7일)', () => {
      expect(result.zodiac.name).toBe('황소자리');
    });

    it('신살: 역마살(월주), 천살(일주), 반안살(시주), 지살(년주)', () => {
      expect(result.sinsal.pillarSinsal.month).toContain('역마살');
      expect(result.sinsal.pillarSinsal.day).toContain('천살');
      expect(result.sinsal.pillarSinsal.hour).toContain('반안살');
      expect(result.sinsal.pillarSinsal.year).toContain('지살');
    });

    it('신살: 괴강 (무술 일주)', () => {
      expect(result.sinsal.allSinsal).toContain('괴강');
    });
  });

  describe('라태웅 — 진태양시 미적용 (표준시)', () => {
    const sajuInput: SajuInput = {
      name: '라태웅',
      birthDate: new Date(1995, 4, 7, 9, 17),
      gender: 'male',
      calendarType: 'solar',
      useTrueSolar: false,
    };

    const result = calculateSaju(sajuInput);

    it('일주는 동일: 무술(戊戌)', () => {
      expect(result.pillars.day.stem).toBe('무');
      expect(result.pillars.day.branch).toBe('술');
    });

    it('시주: 9:17 → 사시 (진태양시 미적용)', () => {
      expect(result.pillars.hour.branch).toBe('사');
    });
  });

  describe('진태양시 보정', () => {
    it('서울(126.978°E)에서 약 -28~-35분 보정', () => {
      const date = new Date(2024, 0, 1, 12, 0);
      const adjusted = toTrueSolarTime(date, 126.978);
      const diffMinutes = (adjusted.getTime() - date.getTime()) / 60000;
      expect(diffMinutes).toBeLessThan(-25);
      expect(diffMinutes).toBeGreaterThan(-40);
    });
  });

  describe('기본 구조 검증', () => {
    it('결과에 모든 필수 필드가 포함됨', () => {
      const result = calculateSaju({
        name: '테스트',
        birthDate: new Date(1990, 0, 15, 10, 30),
        gender: 'female',
        calendarType: 'solar',
        useTrueSolar: true,
      });

      expect(result.pillars.year).toBeDefined();
      expect(result.pillars.month).toBeDefined();
      expect(result.pillars.day).toBeDefined();
      expect(result.pillars.hour).toBeDefined();

      const totalOhaeng = Object.values(result.ohaengCount).reduce((a, b) => a + b, 0);
      expect(totalOhaeng).toBe(8);

      expect(result.daeun.length).toBe(10);
      expect(result.currentYear.year).toBe(new Date().getFullYear());
      expect(Array.isArray(result.specialFormations)).toBe(true);
    });

    it('일주 십신은 항상 "일주"', () => {
      const result = calculateSaju({
        name: '테스트',
        birthDate: new Date(1985, 5, 15, 14, 0),
        gender: 'male',
        calendarType: 'solar',
        useTrueSolar: false,
      });
      expect(result.pillars.day.stemSipsin).toBe('일주');
    });

    it('2000-01-01 기준점 검증: 무오(戊午)일', () => {
      const result = calculateSaju({
        name: '기준점',
        birthDate: new Date(2000, 0, 1, 12, 0),
        gender: 'male',
        calendarType: 'solar',
        useTrueSolar: false,
      });
      expect(result.pillars.day.stem).toBe('무');
      expect(result.pillars.day.branch).toBe('오');
    });
  });
});
