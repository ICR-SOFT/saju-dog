/**
 * 절기 (Solar Terms) 계산
 * 월주는 절기를 기준으로 바뀜 (양력 날짜 X, 절기 기준 O)
 *
 * 24절기 중 "절"(節)만 월 경계로 사용:
 * 입춘(1월), 경칩(2월), 청명(3월), 입하(4월), 망종(5월), 소서(6월),
 * 입추(7월), 백로(8월), 한로(9월), 입동(10월), 대설(11월), 소한(12월)
 *
 * 천문 계산 기반: Jean Meeus "Astronomical Algorithms" 태양 황경 공식
 */

export interface SolarTermEntry {
  month: number;
  day: number;
  name: string;
  sajuMonth: number;
}

// 절(節) 정의: 태양 황경(degree) 기준
const JEOL_DEFINITIONS: { name: string; longitude: number; sajuMonth: number }[] = [
  { name: '소한', longitude: 285, sajuMonth: 12 },
  { name: '입춘', longitude: 315, sajuMonth: 1 },
  { name: '경칩', longitude: 345, sajuMonth: 2 },
  { name: '청명', longitude: 15, sajuMonth: 3 },
  { name: '입하', longitude: 45, sajuMonth: 4 },
  { name: '망종', longitude: 75, sajuMonth: 5 },
  { name: '소서', longitude: 105, sajuMonth: 6 },
  { name: '입추', longitude: 135, sajuMonth: 7 },
  { name: '백로', longitude: 165, sajuMonth: 8 },
  { name: '한로', longitude: 195, sajuMonth: 9 },
  { name: '입동', longitude: 225, sajuMonth: 10 },
  { name: '대설', longitude: 255, sajuMonth: 11 },
];

// ===== 태양 황경 계산 (Jean Meeus 공식) =====

function solarLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;

  // 태양 평균 황경
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;

  // 태양 평균 근점각
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360;
  const Mr = M * Math.PI / 180;

  // 중심차
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
          + 0.000289 * Math.sin(3 * Mr);

  // 시황경 (겉보기 황경)
  const omega = 125.04 - 1934.136 * T;
  const apparent = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180);

  return ((apparent % 360) + 360) % 360;
}

function dateToJD(year: number, month: number, day: number, hour = 0): number {
  let y = year;
  let m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + hour / 24 + B - 1524.5;
}

function jdToDate(jd: number): { year: number; month: number; day: number } {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let A: number;
  if (z < 2299161) {
    A = z;
  } else {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    A = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const day = B - D - Math.floor(30.6001 * E) + Math.floor(f);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  return { year, month, day };
}

/**
 * 주어진 년도에서 특정 태양 황경에 도달하는 날짜 계산
 * Newton-Raphson 반복법 사용
 */
function findSolarTermDate(year: number, targetLon: number): { month: number; day: number } {
  // 황경으로부터 대략적인 월 추정
  const approxMonth = targetLon >= 285
    ? (targetLon >= 285 && targetLon < 315 ? 1 : targetLon >= 315 && targetLon < 345 ? 2 : 3)
    : Math.floor(targetLon / 30) + 4;

  // 초기 추정 JD
  let jd = dateToJD(year, Math.min(approxMonth, 12), 1, 12);

  // Newton-Raphson 반복 (최대 50회)
  for (let i = 0; i < 50; i++) {
    const lon = solarLongitude(jd);
    let diff = targetLon - lon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    if (Math.abs(diff) < 0.0001) break; // 약 8초 정밀도
    jd += diff / 360 * 365.25;
  }

  // JD를 KST로 변환 (UTC+9)
  const kstJD = jd + 9 / 24;
  return jdToDate(kstJD);
}

// 년도별 절기 날짜 캐시
const termCache = new Map<number, SolarTermEntry[]>();

/**
 * 주어진 년도의 12절기 날짜 계산 (캐시 포함)
 */
function getTermsForYear(year: number): SolarTermEntry[] {
  if (termCache.has(year)) return termCache.get(year)!;

  const terms = JEOL_DEFINITIONS.map(def => {
    const date = findSolarTermDate(year, def.longitude);
    return {
      month: date.month,
      day: date.day,
      name: def.name,
      sajuMonth: def.sajuMonth,
    };
  });

  termCache.set(year, terms);
  return terms;
}

/**
 * 주어진 날짜의 사주 월(1~12, 인월=1) 반환
 * 절기 기준으로 월이 바뀜
 */
export function getSajuMonth(year: number, month: number, day: number): number {
  const terms = getTermsForYear(year);

  // 역순으로 검사: 현재 날짜가 어떤 절기 이후인지 확인
  for (let i = terms.length - 1; i >= 0; i--) {
    const term = terms[i];
    if (month > term.month || (month === term.month && day >= term.day)) {
      return term.sajuMonth;
    }
  }

  // 소한 이전이면 전년 자월(11)
  return 11;
}

/**
 * 입춘 기준 사주 년도 반환
 * 사주에서 새해는 입춘부터
 */
export function getSajuYear(year: number, month: number, day: number): number {
  const terms = getTermsForYear(year);
  const ipchun = terms.find(t => t.name === '입춘')!;

  if (month < ipchun.month || (month === ipchun.month && day < ipchun.day)) {
    return year - 1;
  }
  return year;
}

/**
 * 생일 기준 이전/다음 절기 날짜 반환 (대운 시작 나이 계산용)
 */
export function getAdjacentTermDates(year: number, month: number, day: number): {
  prevTerm: Date;
  nextTerm: Date;
} {
  const terms = getTermsForYear(year);
  const prevYearTerms = getTermsForYear(year - 1);
  const nextYearTerms = getTermsForYear(year + 1);

  // 모든 절기를 시간순으로 정렬 (전년 + 당년 + 다음해)
  const allTermDates = [
    ...prevYearTerms.map(t => new Date(year - 1, t.month - 1, t.day)),
    ...terms.map(t => new Date(year, t.month - 1, t.day)),
    ...nextYearTerms.map(t => new Date(year + 1, t.month - 1, t.day)),
  ].sort((a, b) => a.getTime() - b.getTime());

  const birthDate = new Date(year, month - 1, day);
  let prevTerm = allTermDates[0];
  let nextTerm = allTermDates[allTermDates.length - 1];

  for (let i = 0; i < allTermDates.length; i++) {
    if (allTermDates[i].getTime() > birthDate.getTime()) {
      nextTerm = allTermDates[i];
      prevTerm = allTermDates[i - 1] || allTermDates[0];
      break;
    }
  }

  return { prevTerm, nextTerm };
}
