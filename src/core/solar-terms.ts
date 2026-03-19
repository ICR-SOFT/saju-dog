/**
 * 절기 (Solar Terms) 계산
 * 월주는 절기를 기준으로 바뀜 (양력 날짜 X, 절기 기준 O)
 *
 * 24절기 중 "절"(節)만 월 경계로 사용:
 * 입춘(1월), 경칩(2월), 청명(3월), 입하(4월), 망종(5월), 소서(6월),
 * 입추(7월), 백로(8월), 한로(9월), 입동(10월), 대설(11월), 소한(12월)
 */

// 절기 테이블: [양력월, 대략적 일, 절기명]
// 실제 절기 시각은 년도별로 다르므로 근사값 + 보정 사용
export interface SolarTermEntry {
  month: number; // 양력 월
  day: number;   // 양력 일
  name: string;  // 절기 이름
  sajuMonth: number; // 사주 월 (인월=1, 묘월=2, ...)
}

// 절기(節)의 대략적 양력 날짜 (평균 기준)
const JEOL_APPROX: { name: string; month: number; day: number; sajuMonth: number }[] = [
  { name: '소한', month: 1, day: 6, sajuMonth: 12 },   // 12월 (축월)
  { name: '입춘', month: 2, day: 4, sajuMonth: 1 },    // 1월 (인월)
  { name: '경칩', month: 3, day: 6, sajuMonth: 2 },    // 2월 (묘월)
  { name: '청명', month: 4, day: 5, sajuMonth: 3 },    // 3월 (진월)
  { name: '입하', month: 5, day: 6, sajuMonth: 4 },    // 4월 (사월)
  { name: '망종', month: 6, day: 6, sajuMonth: 5 },    // 5월 (오월)
  { name: '소서', month: 7, day: 7, sajuMonth: 6 },    // 6월 (미월)
  { name: '입추', month: 8, day: 7, sajuMonth: 7 },    // 7월 (신월)
  { name: '백로', month: 9, day: 8, sajuMonth: 8 },    // 8월 (유월)
  { name: '한로', month: 10, day: 8, sajuMonth: 9 },   // 9월 (술월)
  { name: '입동', month: 11, day: 7, sajuMonth: 10 },  // 10월 (해월)
  { name: '대설', month: 12, day: 7, sajuMonth: 11 },  // 11월 (자월)
];

/**
 * 주어진 날짜의 사주 월(1~12, 인월=1) 반환
 * 절기 기준으로 월이 바뀜
 */
export function getSajuMonth(year: number, month: number, day: number): number {
  // 절기 근사 보정값 (윤년/세차 등에 의한 ±1~2일 변동)
  const terms = getAdjustedTerms(year);

  // 역순으로 검사: 현재 날짜가 어떤 절기 이후인지 확인
  for (let i = terms.length - 1; i >= 0; i--) {
    const term = terms[i];
    if (month > term.month || (month === term.month && day >= term.day)) {
      return term.sajuMonth;
    }
  }

  // 소한(1월 6일경) 이전이면 전년 12월(자월)의 다음, 즉 축월(12) 이전 → 전년 자월(11)
  // 실제로는 전년 대설~소한 사이이므로 사주월 11 (자월)
  return 11;
}

/**
 * 절기 근사 보정
 * 실제 운용에서는 정밀 천문 계산이 필요하지만,
 * MVP에서는 ±1일 오차를 허용하는 근사 알고리즘 사용
 */
function getAdjustedTerms(year: number): SolarTermEntry[] {
  return JEOL_APPROX.map(term => {
    // 세기별 보정 (그레고리력 보정)
    let dayAdjust = 0;

    // 윤년 보정: 3월 이후 절기에 영향
    if (isLeapYear(year) && term.month >= 3) {
      dayAdjust -= 0; // 큰 영향 없음, 정밀 계산 시 보정
    }

    // 세기 보정 (2000년대 기준 약간의 시프트)
    if (year >= 2000) {
      dayAdjust += Math.floor((year - 2000) / 100);
    }

    return {
      month: term.month,
      day: term.day + dayAdjust,
      name: term.name,
      sajuMonth: term.sajuMonth,
    };
  });
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * 입춘 기준 사주 년도 반환
 * 사주에서 새해는 입춘(2월 4일경)부터
 */
export function getSajuYear(year: number, month: number, day: number): number {
  // 입춘 전이면 전년도
  const ipchunMonth = 2;
  const ipchunDay = 4; // 근사값

  if (month < ipchunMonth || (month === ipchunMonth && day < ipchunDay)) {
    return year - 1;
  }
  return year;
}
