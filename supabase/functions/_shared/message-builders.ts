/**
 * 유저 메시지 빌더
 * 프롬프트(시스템)는 DB 관리이지만, 유저 메시지는 구조화된 사주 데이터를
 * 주입해야 하므로 코드에 둔다.
 */

interface Pillar {
  stem: string;
  branch: string;
  stemHanja: string;
  branchHanja: string;
  stemOhaeng: string;
  branchOhaeng: string;
  stemSipsin: string;
  branchSipsin: string;
  twelveStage: string;
  jijanggan: { stem: string; sipsin: string; type: string }[];
}

interface SajuData {
  input: {
    name: string;
    gender: string;
    birthDate: string;
    calendarType: string;
  };
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: Pillar;
  };
  ohaengCount: Record<string, number>;
  specialFormations: { description: string }[];
  sinsal?: {
    pillarSinsal?: { year?: string[]; month?: string[]; day?: string[]; hour?: string[] };
    pillarRelations?: { year?: string[]; month?: string[]; day?: string[]; hour?: string[] };
    allSinsal?: string[];
    gongmang?: string[];
    guiin?: string[];
  };
  ddi?: { fullName?: string; animal?: string; color?: string };
  zodiac?: { name?: string; emoji?: string };
  daeun: {
    startAge: number;
    endAge: number;
    stem: string;
    branch: string;
    stemSipsin: string;
    branchSipsin: string;
    isCurrent: boolean;
  }[];
  currentYear: {
    year: number;
    stem: string;
    branch: string;
    stemSipsin: string;
    branchSipsin: string;
  };
}

function fmtJijanggan(jj: { stem: string; sipsin: string; type: string }[]): string {
  return jj.map(j => `${j.stem}(${j.sipsin}·${j.type})`).join(', ');
}

function fmtArr(arr: string[] | undefined): string {
  return arr && arr.length > 0 ? arr.join(', ') : '없음';
}

export function buildComprehensiveUserMessage(data: SajuData): string {
  const { input, pillars: p, ohaengCount, daeun, currentYear, specialFormations } = data;
  const s = data.sinsal;

  return `아래는 서버에서 정밀 계산된 사주 데이터입니다. 이 데이터만 기반으로 해설하세요.

## 기본 정보
- 이름: ${input.name} / 성별: ${input.gender === 'male' ? '남성' : '여성'}
- 생년월일시: ${input.birthDate} (${input.calendarType === 'solar' ? '양력' : '음력'})
- 띠: ${data.ddi?.fullName || '미계산'}
- 별자리: ${data.zodiac?.name || '미계산'}

## 사주팔자
| 구분 | 년주 | 월주 | 일주 | 시주 |
|------|------|------|------|------|
| 천간 | ${p.year.stem}(${p.year.stemHanja}) | ${p.month.stem}(${p.month.stemHanja}) | ${p.day.stem}(${p.day.stemHanja})★일간 | ${p.hour.stem}(${p.hour.stemHanja}) |
| 지지 | ${p.year.branch}(${p.year.branchHanja}) | ${p.month.branch}(${p.month.branchHanja}) | ${p.day.branch}(${p.day.branchHanja}) | ${p.hour.branch}(${p.hour.branchHanja}) |
| 천간오행 | ${p.year.stemOhaeng} | ${p.month.stemOhaeng} | ${p.day.stemOhaeng} | ${p.hour.stemOhaeng} |
| 지지오행 | ${p.year.branchOhaeng} | ${p.month.branchOhaeng} | ${p.day.branchOhaeng} | ${p.hour.branchOhaeng} |
| 천간십신 | ${p.year.stemSipsin} | ${p.month.stemSipsin} | 일주 | ${p.hour.stemSipsin} |
| 지지십신 | ${p.year.branchSipsin} | ${p.month.branchSipsin} | ${p.day.branchSipsin} | ${p.hour.branchSipsin} |
| 12운성 | ${p.year.twelveStage} | ${p.month.twelveStage} | ${p.day.twelveStage} | ${p.hour.twelveStage} |

## 지장간
- 년지 ${p.year.branch}: ${fmtJijanggan(p.year.jijanggan)}
- 월지 ${p.month.branch}: ${fmtJijanggan(p.month.jijanggan)}
- 일지 ${p.day.branch}: ${fmtJijanggan(p.day.jijanggan)}
- 시지 ${p.hour.branch}: ${fmtJijanggan(p.hour.jijanggan)}

## 오행 분포
목:${ohaengCount['목']} / 화:${ohaengCount['화']} / 토:${ohaengCount['토']} / 금:${ohaengCount['금']} / 수:${ohaengCount['수']}

## 합충형파해 (특수 관계)
${specialFormations.length > 0 ? specialFormations.map(f => `- ${f.description}`).join('\n') : '- 없음'}

## 기둥별 신살
- 년주: ${fmtArr(s?.pillarSinsal?.year)}
- 월주: ${fmtArr(s?.pillarSinsal?.month)}
- 일주: ${fmtArr(s?.pillarSinsal?.day)}
- 시주: ${fmtArr(s?.pillarSinsal?.hour)}

## 기둥별 관계 (천간합/충, 지지합/충, 원진, 천라지망, 공망, 귀문관살)
- 년주: ${fmtArr(s?.pillarRelations?.year)}
- 월주: ${fmtArr(s?.pillarRelations?.month)}
- 일주: ${fmtArr(s?.pillarRelations?.day)}
- 시주: ${fmtArr(s?.pillarRelations?.hour)}

## 전체 신살
${fmtArr(s?.allSinsal)}

## 귀인
${fmtArr(s?.guiin)}

## 공망
${fmtArr(s?.gongmang)}

## 대운
${daeun.map(d => `- ${d.startAge}~${d.endAge}세: ${d.stem}${d.branch} [${d.stemSipsin}/${d.branchSipsin}]${d.isCurrent ? ' ★현재' : ''}`).join('\n')}

## ${currentYear.year}년 세운
- ${currentYear.stem}${currentYear.branch}년 [${currentYear.stemSipsin}/${currentYear.branchSipsin}]

위 모든 데이터를 종합하여 사주 풀이를 JSON으로 작성해주세요.
특히 신살, 귀인, 기둥별 관계(합/충/원진), 띠, 별자리를 각 챕터에서 적극 활용하세요.
예: "괴강이 있어서 성격이 강직하고", "역마살이 월주에 있어 직장 변동이", "천을귀인이 있어 위기에 도움을 받는" 등.`;
}

export function buildCompatibilityUserMessage(primary: SajuData, secondary: SajuData): string {
  return `## 첫 번째 (${primary.input.name})
${buildFullSajuBlock(primary)}

## 두 번째 (${secondary.input.name})
${buildFullSajuBlock(secondary)}

두 사람의 궁합을 JSON으로 작성해주세요.
사주팔자, 오행 상성, 신살, 합충 관계를 모두 비교 분석하세요.`;
}

function buildFullSajuBlock(data: SajuData): string {
  const p = data.pillars;
  const s = data.sinsal;
  return `사주: ${p.year.stem}${p.year.branch} ${p.month.stem}${p.month.branch} ${p.day.stem}${p.day.branch} ${p.hour.stem}${p.hour.branch}
오행: 목${data.ohaengCount['목']} 화${data.ohaengCount['화']} 토${data.ohaengCount['토']} 금${data.ohaengCount['금']} 수${data.ohaengCount['수']}
띠: ${data.ddi?.fullName || '미계산'} / 별자리: ${data.zodiac?.name || '미계산'}
신살: ${fmtArr(s?.allSinsal)}
귀인: ${fmtArr(s?.guiin)}
관계: 년-${fmtArr(s?.pillarRelations?.year)} / 월-${fmtArr(s?.pillarRelations?.month)} / 일-${fmtArr(s?.pillarRelations?.day)} / 시-${fmtArr(s?.pillarRelations?.hour)}`;
}

export function buildDailyUserMessage(
  data: SajuData,
  todayStem: string,
  todayBranch: string,
  mood?: string,
): string {
  const s = data.sinsal;
  return `오늘 일진: ${todayStem}${todayBranch}
사주: ${data.pillars.day.stem}${data.pillars.day.branch}일주 (${data.ddi?.fullName || ''})
신살: ${fmtArr(s?.allSinsal)}
귀인: ${fmtArr(s?.guiin)}
${mood ? `현재 기분: ${mood}\n` : ''}오늘의 운세를 JSON으로 작성해주세요. 오늘 일진과 일주의 관계, 신살/귀인을 참고하세요.`;
}
