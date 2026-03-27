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

    it('시주: 병진(丙辰) — 지방시 보정으로 9:17→약8:45 → 진시', () => {
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

  describe('이준성 — 참조 API 기준 검증 (야자시 처리)', () => {
    const sajuInput: SajuInput = {
      name: '이준성',
      birthDate: new Date(1986, 1, 6, 23, 35), // 1986-02-06 23:35
      gender: 'male',
      calendarType: 'solar',
      useTrueSolar: true,
      longitude: 126.978,
    };

    const result = calculateSaju(sajuInput);

    it('년주: 병인(丙寅)', () => {
      expect(result.pillars.year.stem).toBe('병');
      expect(result.pillars.year.branch).toBe('인');
    });

    it('월주: 경인(庚寅)', () => {
      expect(result.pillars.month.stem).toBe('경');
      expect(result.pillars.month.branch).toBe('인');
    });

    it('일주: 신사(辛巳) — 야자시에도 일주는 당일', () => {
      expect(result.pillars.day.stem).toBe('신');
      expect(result.pillars.day.branch).toBe('사');
    });

    it('시주: 경자(庚子) — 야자시: 23시→다음날 일간(壬)으로 시주 천간 계산', () => {
      expect(result.pillars.hour.stem).toBe('경');
      expect(result.pillars.hour.branch).toBe('자');
    });

    it('대운 시작 나이: 9세 (절기 거리 기반)', () => {
      expect(result.daeun[0].startAge).toBe(9);
    });

    it('대운 방향: 순행 (양남)', () => {
      // 대운 간지: 신묘→임진→계사→갑오 순행
      expect(result.daeun[0].stem).toBe('신');
      expect(result.daeun[0].branch).toBe('묘');
      expect(result.daeun[1].stem).toBe('임');
      expect(result.daeun[1].branch).toBe('진');
    });

    it('오행 분포: 금3 목2 화2 수1 토0', () => {
      expect(result.ohaengCount).toEqual({ 금: 3, 목: 2, 화: 2, 수: 1, 토: 0 });
    });

    it('신살: 참조 API 대비 주요 신살 포함 확인', () => {
      const guiin = result.sinsal.guiin.join(',');

      // 참조 API에 있는 주요 신살
      expect(result.sinsal.pillarSinsal.day).toContain('현침살');      // 일주
      expect(result.sinsal.pillarSinsal.hour).toContain('천주귀인');   // 시주
      expect(guiin).toContain('천을귀인');
      expect(guiin).toContain('태극귀인');
      expect(guiin).toContain('천주귀인');
      expect(guiin).toContain('문창귀인');
    });

    it('신살: 고신 포함 (년지 寅 기준)', () => {
      // 년지 寅 → 고신 대상 = 巳. 일지가 巳이므로 일주에 고신
      expect(result.sinsal.pillarSinsal.day).toContain('고신');
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
