/**
 * 만세력 계산 엔진
 * 핵심 원칙: LLM에게 계산을 맡기지 않는다. 모든 계산은 이 모듈에서 수행.
 */

import {
  STEMS, BRANCHES,
  type Stem, type Branch, type Gender,
  type Pillar, type OhaengCount, type DaeunEntry,
  type SpecialFormation, type SajuPillars, type SajuInput,
  type JijangganEntry, type Sipsin,
} from '@/types/saju.ts';

import { calculateSinsal } from './sinsal.ts';
import { calculateDdi, calculateZodiac } from './zodiac.ts';

import {
  STEM_HANJA, STEM_OHAENG, STEM_YINYANG,
  BRANCH_HANJA, BRANCH_OHAENG, BRANCH_JIJANGGAN,
  YEAR_STEM_TO_MONTH_STEM, DAY_STEM_TO_HOUR_STEM,
  getHourBranchIndex, getSipsin, getTwelveStage,
  CHUNG_PAIRS, HAP_PAIRS, SAMHAP_GROUPS, BANGHAP_GROUPS,
  HYUNG_PAIRS, PA_PAIRS, HAE_PAIRS, WONJIN_PAIRS,
} from './tables.ts';

import { getSajuMonth, getSajuYear } from './solar-terms.ts';

// ===== 진태양시 보정 =====

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function toTrueSolarTime(date: Date, longitude = 126.978): Date {
  const lonCorr = (longitude - 135) * 4; // KST 기준 경선 135°E와의 차이 (분)
  const B = ((360 / 365) * (getDayOfYear(date) - 81)) * (Math.PI / 180);
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  return new Date(date.getTime() + (lonCorr + eot) * 60000);
}

// ===== 율리우스 적일 (Julian Day Number) =====

function toJulianDayNumber(year: number, month: number, day: number): number {
  // Meeus 알고리즘
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

// ===== 년주 계산 =====

function getYearPillarIndices(sajuYear: number): { stemIndex: number; branchIndex: number } {
  // 갑자년 기준: 1924, 1984, 2044 ...
  // (sajuYear - 4) % 10 → 천간 인덱스
  // (sajuYear - 4) % 12 → 지지 인덱스
  const stemIndex = ((sajuYear - 4) % 10 + 10) % 10;
  const branchIndex = ((sajuYear - 4) % 12 + 12) % 12;
  return { stemIndex, branchIndex };
}

// ===== 월주 계산 =====

function getMonthPillarIndices(
  yearStemIndex: number,
  sajuMonth: number,
): { stemIndex: number; branchIndex: number } {
  // 지지: 인월(1)=인(2), 묘월(2)=묘(3), ..., 축월(12)=축(1)
  const branchIndex = (sajuMonth + 1) % 12;

  // 천간: 년간에서 인월 천간을 구한 뒤, 사주월만큼 이동
  const inMonthStem = YEAR_STEM_TO_MONTH_STEM[yearStemIndex];
  const stemIndex = (inMonthStem + sajuMonth - 1) % 10;

  return { stemIndex, branchIndex };
}

// ===== 일주 계산 =====

function getDayPillarIndices(year: number, month: number, day: number): { stemIndex: number; branchIndex: number } {
  const jdn = toJulianDayNumber(year, month, day);
  const jdnFloor = Math.floor(jdn);
  // JDN → 육십갑자 오프셋 (2000-01-01 = 무오(戊午) 기준 검증)
  // stemIndex = JDN % 10, branchIndex = (JDN + 2) % 12
  const stemIndex = jdnFloor % 10;
  const branchIndex = (jdnFloor + 2) % 12;
  return { stemIndex, branchIndex };
}

// ===== 시주 계산 =====

function getHourPillarIndices(
  dayStemIndex: number,
  hour: number,
): { stemIndex: number; branchIndex: number } {
  const branchIndex = getHourBranchIndex(hour);

  // 일간에서 자시 천간을 구한 뒤, 시지만큼 이동
  const ziHourStem = DAY_STEM_TO_HOUR_STEM[dayStemIndex];
  const stemIndex = (ziHourStem + branchIndex) % 10;

  return { stemIndex, branchIndex };
}

// ===== Pillar 객체 생성 =====

function buildPillar(
  stemIndex: number,
  branchIndex: number,
  dayStemIndex: number,
  pillarType: 'year' | 'month' | 'day' | 'hour',
): Pillar {
  const stem = STEMS[stemIndex];
  const branch = BRANCHES[branchIndex];
  const dayStemOhaeng = STEM_OHAENG[STEMS[dayStemIndex]];
  const dayStemYinYang = STEM_YINYANG[STEMS[dayStemIndex]];

  const stemSipsin: Sipsin | '일주' = pillarType === 'day'
    ? '일주'
    : getSipsin(dayStemOhaeng, dayStemYinYang, STEM_OHAENG[stem], STEM_YINYANG[stem]) as Sipsin;

  const branchSipsin = getSipsin(
    dayStemOhaeng, dayStemYinYang,
    BRANCH_OHAENG[branch], STEM_YINYANG[BRANCH_JIJANGGAN[branch].find(j => j.type === '정기')!.stem],
  );

  const jijanggan: JijangganEntry[] = BRANCH_JIJANGGAN[branch].map(j => ({
    stem: j.stem,
    type: j.type,
    sipsin: getSipsin(dayStemOhaeng, dayStemYinYang, STEM_OHAENG[j.stem], STEM_YINYANG[j.stem]) as JijangganEntry['sipsin'],
  }));

  return {
    stem,
    branch,
    stemIndex,
    branchIndex,
    stemHanja: STEM_HANJA[stem],
    branchHanja: BRANCH_HANJA[branch],
    stemOhaeng: STEM_OHAENG[stem],
    branchOhaeng: BRANCH_OHAENG[branch],
    stemYinYang: STEM_YINYANG[stem],
    stemSipsin,
    branchSipsin: branchSipsin as Pillar['branchSipsin'],
    twelveStage: getTwelveStage(dayStemIndex, branchIndex),
    jijanggan,
  };
}

// ===== 오행 분포 계산 =====

function countOhaeng(pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar }): OhaengCount {
  const count: OhaengCount = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const all = [pillars.year, pillars.month, pillars.day, pillars.hour];

  for (const p of all) {
    count[p.stemOhaeng]++;
    count[p.branchOhaeng]++;
  }

  return count;
}

// ===== 대운 계산 =====

function calculateDaeun(
  yearStemIndex: number,
  monthStemIndex: number,
  monthBranchIndex: number,
  dayStemIndex: number,
  gender: Gender,
  birthYear: number,
): DaeunEntry[] {
  // 순행/역행 판단: 년간 양/음과 성별에 따라
  // 양남음녀 → 순행, 음남양녀 → 역행
  const yearYinYang = STEM_YINYANG[STEMS[yearStemIndex]];
  const isForward = (yearYinYang === '양' && gender === 'male') ||
                    (yearYinYang === '음' && gender === 'female');

  const direction = isForward ? 1 : -1;
  const entries: DaeunEntry[] = [];
  const currentAge = new Date().getFullYear() - birthYear;

  // 대운 시작 나이 (간략 계산: 보통 2~8세 사이)
  // 정밀 계산은 생일~절기 거리로 하지만, MVP에서는 근사값 사용
  const startAge = getApproxDaeunStartAge(gender, yearYinYang);

  for (let i = 0; i < 10; i++) {
    const stemIdx = ((monthStemIndex + direction * (i + 1)) % 10 + 10) % 10;
    const branchIdx = ((monthBranchIndex + direction * (i + 1)) % 12 + 12) % 12;

    const stem = STEMS[stemIdx];
    const branch = BRANCHES[branchIdx];
    const dayStemOhaeng = STEM_OHAENG[STEMS[dayStemIndex]];
    const dayStemYinYangVal = STEM_YINYANG[STEMS[dayStemIndex]];

    const ageStart = startAge + i * 10;
    const ageEnd = ageStart + 9;

    entries.push({
      stem,
      branch,
      stemHanja: STEM_HANJA[stem],
      branchHanja: BRANCH_HANJA[branch],
      startAge: ageStart,
      endAge: ageEnd,
      stemSipsin: getSipsin(dayStemOhaeng, dayStemYinYangVal, STEM_OHAENG[stem], STEM_YINYANG[stem]) as DaeunEntry['stemSipsin'],
      branchSipsin: getSipsin(
        dayStemOhaeng, dayStemYinYangVal,
        BRANCH_OHAENG[branch],
        STEM_YINYANG[BRANCH_JIJANGGAN[branch].find(j => j.type === '정기')!.stem],
      ) as DaeunEntry['branchSipsin'],
      isCurrent: currentAge >= ageStart && currentAge <= ageEnd,
    });
  }

  return entries;
}

function getApproxDaeunStartAge(gender: Gender, yearYinYang: string): number {
  // 양남음녀 순행: 다음 절기까지 → 보통 빠름 (2~4세)
  // 음남양녀 역행: 이전 절기까지 → 보통 느림 (5~8세)
  const isForward = (yearYinYang === '양' && gender === 'male') ||
                    (yearYinYang === '음' && gender === 'female');
  return isForward ? 3 : 6;
}

// ===== 특수 관계 찾기 =====

function findSpecialFormations(pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar }): SpecialFormation[] {
  const formations: SpecialFormation[] = [];
  const pillarNames = ['년', '월', '일', '시'] as const;
  const pillarArray = [pillars.year, pillars.month, pillars.day, pillars.hour];

  // 지지 인덱스 배열
  const branchIndices = pillarArray.map(p => p.branchIndex);

  // 육충 검사
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (const [a, b] of CHUNG_PAIRS) {
        if ((branchIndices[i] === a && branchIndices[j] === b) ||
            (branchIndices[i] === b && branchIndices[j] === a)) {
          formations.push({
            type: '충',
            pillars: [pillarNames[i], pillarNames[j]],
            characters: [pillarArray[i].branch, pillarArray[j].branch],
            description: `${pillarNames[i]}지-${pillarNames[j]}지 ${pillarArray[i].branch}${pillarArray[j].branch} 충`,
          });
        }
      }
    }
  }

  // 육합 검사
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (const [a, b, result] of HAP_PAIRS) {
        if ((branchIndices[i] === a && branchIndices[j] === b) ||
            (branchIndices[i] === b && branchIndices[j] === a)) {
          formations.push({
            type: '합',
            pillars: [pillarNames[i], pillarNames[j]],
            characters: [pillarArray[i].branch, pillarArray[j].branch],
            description: `${pillarNames[i]}지-${pillarNames[j]}지 ${pillarArray[i].branch}${pillarArray[j].branch} 합(${result})`,
          });
        }
      }
    }
  }

  // 삼합 검사
  for (const [a, b, c, result] of SAMHAP_GROUPS) {
    const indices = [a, b, c];
    const found: number[] = [];
    for (let i = 0; i < 4; i++) {
      if (indices.includes(branchIndices[i])) {
        found.push(i);
      }
    }
    if (found.length >= 3) {
      formations.push({
        type: '삼합',
        pillars: found.map(i => pillarNames[i]),
        characters: found.map(i => pillarArray[i].branch),
        description: `${found.map(i => pillarArray[i].branch).join('')} 삼합(${result}국)`,
      });
    } else if (found.length === 2) {
      formations.push({
        type: '반합',
        pillars: found.map(i => pillarNames[i]),
        characters: found.map(i => pillarArray[i].branch),
        description: `${found.map(i => pillarArray[i].branch).join('')} 반합(${result})`,
      });
    }
  }

  // 방합 검사
  for (const [a, b, c, result] of BANGHAP_GROUPS) {
    const indices = [a, b, c];
    const found: number[] = [];
    for (let i = 0; i < 4; i++) {
      if (indices.includes(branchIndices[i])) {
        found.push(i);
      }
    }
    if (found.length >= 3) {
      formations.push({
        type: '방합',
        pillars: found.map(i => pillarNames[i]),
        characters: found.map(i => pillarArray[i].branch),
        description: `${found.map(i => pillarArray[i].branch).join('')} 방합(${result}방)`,
      });
    }
  }

  // 형 검사
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (const [a, b] of HYUNG_PAIRS) {
        if ((branchIndices[i] === a && branchIndices[j] === b) ||
            (branchIndices[i] === b && branchIndices[j] === a)) {
          formations.push({
            type: '형',
            pillars: [pillarNames[i], pillarNames[j]],
            characters: [pillarArray[i].branch, pillarArray[j].branch],
            description: `${pillarNames[i]}지-${pillarNames[j]}지 ${pillarArray[i].branch}${pillarArray[j].branch} 형`,
          });
        }
      }
    }
  }

  // 파 검사
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (const [a, b] of PA_PAIRS) {
        if ((branchIndices[i] === a && branchIndices[j] === b) ||
            (branchIndices[i] === b && branchIndices[j] === a)) {
          formations.push({
            type: '파',
            pillars: [pillarNames[i], pillarNames[j]],
            characters: [pillarArray[i].branch, pillarArray[j].branch],
            description: `${pillarNames[i]}지-${pillarNames[j]}지 ${pillarArray[i].branch}${pillarArray[j].branch} 파`,
          });
        }
      }
    }
  }

  // 해 검사
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (const [a, b] of HAE_PAIRS) {
        if ((branchIndices[i] === a && branchIndices[j] === b) ||
            (branchIndices[i] === b && branchIndices[j] === a)) {
          formations.push({
            type: '해',
            pillars: [pillarNames[i], pillarNames[j]],
            characters: [pillarArray[i].branch, pillarArray[j].branch],
            description: `${pillarNames[i]}지-${pillarNames[j]}지 ${pillarArray[i].branch}${pillarArray[j].branch} 해`,
          });
        }
      }
    }
  }

  // 원진 검사
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (const [a, b] of WONJIN_PAIRS) {
        if ((branchIndices[i] === a && branchIndices[j] === b) ||
            (branchIndices[i] === b && branchIndices[j] === a)) {
          formations.push({
            type: '원진',
            pillars: [pillarNames[i], pillarNames[j]],
            characters: [pillarArray[i].branch, pillarArray[j].branch],
            description: `${pillarNames[i]}지-${pillarNames[j]}지 ${pillarArray[i].branch}${pillarArray[j].branch} 원진`,
          });
        }
      }
    }
  }

  return formations;
}

// ===== 세운 (올해 운세) =====

function getCurrentYearPillar(dayStemIndex: number) {
  const year = new Date().getFullYear();
  const { stemIndex, branchIndex } = getYearPillarIndices(year);
  const stem = STEMS[stemIndex];
  const branch = BRANCHES[branchIndex];
  const dayStemOhaeng = STEM_OHAENG[STEMS[dayStemIndex]];
  const dayStemYinYang = STEM_YINYANG[STEMS[dayStemIndex]];

  return {
    year,
    stem,
    branch,
    stemSipsin: getSipsin(dayStemOhaeng, dayStemYinYang, STEM_OHAENG[stem], STEM_YINYANG[stem]) as DaeunEntry['stemSipsin'],
    branchSipsin: getSipsin(
      dayStemOhaeng, dayStemYinYang,
      BRANCH_OHAENG[branch],
      STEM_YINYANG[BRANCH_JIJANGGAN[branch].find(j => j.type === '정기')!.stem],
    ) as DaeunEntry['branchSipsin'],
  };
}

// ===== 메인 계산 함수 =====

export function calculateSaju(input: SajuInput): SajuPillars {
  let date = input.birthDate;

  // 진태양시 보정
  if (input.useTrueSolar) {
    date = toTrueSolarTime(date, input.longitude ?? 126.978);
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();

  // 사주 년도 (입춘 기준)
  const sajuYear = getSajuYear(year, month, day);

  // 사주 월 (절기 기준)
  const sajuMonth = getSajuMonth(year, month, day);

  // 각 기둥 인덱스 계산
  const yearIndices = getYearPillarIndices(sajuYear);
  const monthIndices = getMonthPillarIndices(yearIndices.stemIndex, sajuMonth);
  const dayIndices = getDayPillarIndices(year, month, day);
  const hourIndices = getHourPillarIndices(dayIndices.stemIndex, hour);

  // Pillar 객체 생성 (일간 기준으로 십신 계산)
  const yearPillar = buildPillar(yearIndices.stemIndex, yearIndices.branchIndex, dayIndices.stemIndex, 'year');
  const monthPillar = buildPillar(monthIndices.stemIndex, monthIndices.branchIndex, dayIndices.stemIndex, 'month');
  const dayPillar = buildPillar(dayIndices.stemIndex, dayIndices.branchIndex, dayIndices.stemIndex, 'day');
  const hourPillar = buildPillar(hourIndices.stemIndex, hourIndices.branchIndex, dayIndices.stemIndex, 'hour');

  const pillars = { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar };

  // 오행 분포
  const ohaengCount = countOhaeng(pillars);

  // 대운
  const daeun = calculateDaeun(
    yearIndices.stemIndex,
    monthIndices.stemIndex,
    monthIndices.branchIndex,
    dayIndices.stemIndex,
    input.gender,
    sajuYear,
  );

  // 현재 대운
  const currentDaeun = daeun.find(d => d.isCurrent) ?? null;

  // 올해 세운
  const currentYear = getCurrentYearPillar(dayIndices.stemIndex);

  // 특수 관계
  const specialFormations = findSpecialFormations(pillars);

  // 신살 계산
  const sinsalResult = calculateSinsal(
    { stemIndex: yearIndices.stemIndex, branchIndex: yearIndices.branchIndex, stem: yearPillar.stem, branch: yearPillar.branch },
    { stemIndex: monthIndices.stemIndex, branchIndex: monthIndices.branchIndex, stem: monthPillar.stem, branch: monthPillar.branch },
    { stemIndex: dayIndices.stemIndex, branchIndex: dayIndices.branchIndex, stem: dayPillar.stem, branch: dayPillar.branch },
    { stemIndex: hourIndices.stemIndex, branchIndex: hourIndices.branchIndex, stem: hourPillar.stem, branch: hourPillar.branch },
  );

  // 띠 계산
  const ddi = calculateDdi(yearPillar.stem, yearPillar.branch);

  // 별자리 계산
  const zodiac = calculateZodiac(month, day);

  return {
    input,
    pillars,
    ohaengCount,
    daeun,
    currentDaeun,
    currentYear,
    specialFormations,
    sinsal: {
      pillarSinsal: sinsalResult.pillarSinsal,
      pillarRelations: sinsalResult.pillarRelations,
      allSinsal: sinsalResult.allSinsal,
      gongmang: sinsalResult.gongmang,
      guiin: sinsalResult.guiin,
    },
    ddi: { animal: ddi.animal, color: ddi.color, fullName: ddi.fullName },
    zodiac: { name: zodiac.name, emoji: zodiac.emoji },
  };
}

// ===== 오늘의 일진 =====

export function getTodayDayPillar(): { stem: Stem; branch: Branch } {
  const today = new Date();
  const { stemIndex, branchIndex } = getDayPillarIndices(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );
  return { stem: STEMS[stemIndex], branch: BRANCHES[branchIndex] };
}
