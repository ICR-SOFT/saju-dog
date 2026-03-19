/**
 * 신살(神殺) 계산 엔진
 * 모든 신살은 규칙 기반 테이블이므로 코드에서 계산.
 * AI에게 맡기지 않는다.
 */

import type { Branch, Stem } from '@/types/saju.ts';
import { BRANCHES } from '@/types/saju.ts';

// ===== 삼합 그룹 매핑 =====
// 각 지지가 속하는 삼합 그룹 인덱스
// 0: 인오술(화), 1: 사유축(금), 2: 신자진(수), 3: 해묘미(목)
const SAMHAP_GROUP: Record<Branch, number> = {
  '인': 0, '오': 0, '술': 0,
  '사': 1, '유': 1, '축': 1,
  '신': 2, '자': 2, '진': 2,
  '해': 3, '묘': 3, '미': 3,
};

// ===== 역마/천살/지살/반안살 (삼합 기반 4살) =====
// [역마, 반안, 천살, 지살] — 기준: 년지 또는 일지의 삼합 그룹
const FOUR_SPIRITS: Record<number, { 역마: Branch; 반안: Branch; 천살: Branch; 지살: Branch }> = {
  0: { 역마: '신', 반안: '유', 천살: '자', 지살: '인' }, // 인오술
  1: { 역마: '해', 반안: '자', 천살: '묘', 지살: '사' }, // 사유축
  2: { 역마: '인', 반안: '묘', 천살: '오', 지살: '신' }, // 신자진
  3: { 역마: '사', 반안: '진', 천살: '술', 지살: '해' }, // 해묘미
};

// ===== 도화살/화개살/겁살 (삼합 기반) =====
const SAMHAP_SPIRITS: Record<number, { 도화: Branch; 화개: Branch; 겁살: Branch }> = {
  0: { 도화: '묘', 화개: '술', 겁살: '해' }, // 인오술
  1: { 도화: '오', 화개: '축', 겁살: '인' }, // 사유축
  2: { 도화: '유', 화개: '진', 겁살: '사' }, // 신자진
  3: { 도화: '자', 화개: '미', 겁살: '신' }, // 해묘미
};

// ===== 괴강살 (魁罡) =====
// 무진, 무술, 경진, 경술 일주
const GWAEGANG_PILLARS = new Set(['무진', '무술', '경진', '경술']);

// ===== 천을귀인 (天乙貴人) — 일간 기준 =====
const CHEONUL_GUIIN: Record<Stem, Branch[]> = {
  '갑': ['축', '미'], '을': ['자', '신'],
  '병': ['해', '유'], '정': ['해', '유'],
  '무': ['축', '미'], '기': ['자', '신'],
  '경': ['축', '미'], '신': ['인', '오'],
  '임': ['묘', '사'], '계': ['묘', '사'],
};

// ===== 천덕귀인 (天德貴人) — 월지 기준 =====
const CHEONDUK: Record<Branch, Stem> = {
  '인': '정', '묘': '신', '진': '임', '사': '신',
  '오': '갑', '미': '계', '신': '임', '유': '병',
  '술': '갑', '해': '을', '자': '경', '축': '기',
};

// ===== 월덕귀인 (月德貴人) — 월지 기준 =====
const WOLDUK: Record<Branch, Stem> = {
  '인': '병', '묘': '갑', '진': '임', '사': '경',
  '오': '병', '미': '갑', '신': '임', '유': '경',
  '술': '병', '해': '갑', '자': '임', '축': '경',
};

// ===== 공망 (空亡) — 일주의 순(旬) 기준 =====
// 10일 주기(순)에서 나머지 2개 지지가 공망
function calculateGongmang(dayStemIndex: number, dayBranchIndex: number): Branch[] {
  // 해당 순의 시작점: 갑X일
  // 일주가 속한 순의 시작 지지 = dayBranchIndex - dayStemIndex
  const startBranch = ((dayBranchIndex - dayStemIndex) % 12 + 12) % 12;
  // 공망 = 순에 포함되지 않는 2개 지지 (startBranch + 10, startBranch + 11)
  const gm1 = (startBranch + 10) % 12;
  const gm2 = (startBranch + 11) % 12;
  return [BRANCHES[gm1], BRANCHES[gm2]];
}

// ===== 천라지망 (天羅地網) =====
// 술해 = 천라, 진사 = 지망
function hasCheollaJimang(branches: Branch[]): { 천라: boolean; 지망: boolean } {
  const has = (b: Branch) => branches.includes(b);
  return {
    천라: has('술') && has('해'),
    지망: has('진') && has('사'),
  };
}

// ===== 귀문관살 (鬼門關殺) =====
// 특정 지지 조합
const GUIMUN_PAIRS: [Branch, Branch][] = [
  ['인', '유'], ['묘', '오'], ['진', '해'],
  ['술', '사'], ['축', '신'], ['자', '미'],
];

// ===== 복성귀인 (福星貴人) — 일간 기준 =====
const BOKSUNG: Record<Stem, Branch> = {
  '갑': '인', '을': '축', '병': '자', '정': '유',
  '무': '신', '기': '미', '경': '오', '신': '사',
  '임': '진', '계': '묘',
};

// ===== 천록귀인 (天祿貴人) — 일간의 건록지 =====
const CHEONROK: Record<Stem, Branch> = {
  '갑': '인', '을': '묘', '병': '사', '정': '오',
  '무': '사', '기': '오', '경': '신', '신': '유',
  '임': '해', '계': '자',
};

// ===== 효신살 (梟神殺) — 편인이 있는 경우 =====
// 이미 십신 계산으로 확인 가능

// ===== 메인 신살 계산 =====

export interface SinsalResult {
  // 기둥별 신살 (기둥 이름 → 신살 목록)
  pillarSinsal: {
    year: string[];
    month: string[];
    day: string[];
    hour: string[];
  };
  // 전체 신살 목록
  allSinsal: string[];
  // 공망
  gongmang: Branch[];
  // 천라지망
  cheollaJimang: { 천라: boolean; 지망: boolean };
  // 귀인 목록
  guiin: string[];
  // 합충 관계 (이미 specialFormations에 있지만, 기둥별로도 매핑)
  pillarRelations: {
    year: string[];
    month: string[];
    day: string[];
    hour: string[];
  };
}

interface PillarInfo {
  stemIndex: number;
  branchIndex: number;
  stem: Stem;
  branch: Branch;
}

export function calculateSinsal(
  year: PillarInfo,
  month: PillarInfo,
  day: PillarInfo,
  hour: PillarInfo,
): SinsalResult {
  const pillars = [
    { name: 'year' as const, ...year },
    { name: 'month' as const, ...month },
    { name: 'day' as const, ...day },
    { name: 'hour' as const, ...hour },
  ];
  const allBranches = pillars.map(p => p.branch);

  const pillarSinsal: SinsalResult['pillarSinsal'] = { year: [], month: [], day: [], hour: [] };
  const allSinsal: string[] = [];
  const guiin: string[] = [];

  // 1. 삼합 기반 4살 (년지 기준)
  const yearGroup = SAMHAP_GROUP[year.branch];
  const fourSpirits = FOUR_SPIRITS[yearGroup];
  const samhapSpirits = SAMHAP_SPIRITS[yearGroup];

  for (const p of pillars) {
    if (p.branch === fourSpirits.역마) { pillarSinsal[p.name].push('역마살'); allSinsal.push(`${p.name === 'year' ? '년' : p.name === 'month' ? '월' : p.name === 'day' ? '일' : '시'}주 역마살`); }
    if (p.branch === fourSpirits.반안) { pillarSinsal[p.name].push('반안살'); }
    if (p.branch === fourSpirits.천살) { pillarSinsal[p.name].push('천살'); }
    if (p.branch === fourSpirits.지살) { pillarSinsal[p.name].push('지살'); }
    if (p.branch === samhapSpirits.도화) { pillarSinsal[p.name].push('도화살'); allSinsal.push('도화살'); }
    if (p.branch === samhapSpirits.화개) { pillarSinsal[p.name].push('화개살'); allSinsal.push('화개살'); }
    if (p.branch === samhapSpirits.겁살) { pillarSinsal[p.name].push('겁살'); allSinsal.push('겁살'); }
  }

  // 2. 괴강
  const dayPillarStr = `${day.stem}${day.branch}`;
  if (GWAEGANG_PILLARS.has(dayPillarStr)) {
    pillarSinsal.day.push('괴강');
    allSinsal.push('괴강');
  }

  // 3. 천을귀인 (일간 기준)
  const cheonulTargets = CHEONUL_GUIIN[day.stem];
  for (const p of pillars) {
    if (cheonulTargets.includes(p.branch)) {
      guiin.push(`천을귀인(${p.name === 'year' ? '년' : p.name === 'month' ? '월' : p.name === 'day' ? '일' : '시'}지)`);
    }
  }

  // 4. 천덕귀인 (월지 기준)
  const cheondukTarget = CHEONDUK[month.branch];
  for (const p of pillars) {
    if (p.stem === cheondukTarget) {
      guiin.push(`천덕귀인(${p.name === 'year' ? '년' : p.name === 'month' ? '월' : p.name === 'day' ? '일' : '시'}간)`);
    }
  }

  // 5. 월덕귀인
  const woldukTarget = WOLDUK[month.branch];
  for (const p of pillars) {
    if (p.stem === woldukTarget) {
      guiin.push(`월덕귀인(${p.name === 'year' ? '년' : p.name === 'month' ? '월' : p.name === 'day' ? '일' : '시'}간)`);
    }
  }

  // 6. 복성귀인
  const boksungTarget = BOKSUNG[day.stem];
  for (const p of pillars) {
    if (p.branch === boksungTarget) {
      guiin.push(`복성귀인(${p.name === 'year' ? '년' : p.name === 'month' ? '월' : p.name === 'day' ? '일' : '시'}지)`);
    }
  }

  // 7. 천록귀인
  const cheonrokTarget = CHEONROK[day.stem];
  for (const p of pillars) {
    if (p.branch === cheonrokTarget) {
      guiin.push(`천록귀인(${p.name === 'year' ? '년' : p.name === 'month' ? '월' : p.name === 'day' ? '일' : '시'}지)`);
    }
  }

  // 8. 공망
  const gongmang = calculateGongmang(day.stemIndex, day.branchIndex);

  // 9. 천라지망
  const cheollaJimang = hasCheollaJimang(allBranches);
  if (cheollaJimang.천라) allSinsal.push('천라');
  if (cheollaJimang.지망) allSinsal.push('지망');

  // 10. 귀문관살
  const pillarRelations: SinsalResult['pillarRelations'] = { year: [], month: [], day: [], hour: [] };
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (const [a, b] of GUIMUN_PAIRS) {
        if ((allBranches[i] === a && allBranches[j] === b) ||
            (allBranches[i] === b && allBranches[j] === a)) {
          const nameI = pillars[i].name;
          const nameJ = pillars[j].name;
          pillarRelations[nameI].push('귀문관살');
          pillarRelations[nameJ].push('귀문관살');
          allSinsal.push('귀문관살');
        }
      }
    }
  }

  // 공망 기둥 표시
  for (const p of pillars) {
    if (gongmang.includes(p.branch)) {
      pillarSinsal[p.name].push('공망');
    }
  }

  // 천라지망 기둥 표시
  if (cheollaJimang.천라 || cheollaJimang.지망) {
    for (const p of pillars) {
      if ((p.branch === '술' || p.branch === '해') && cheollaJimang.천라) {
        pillarSinsal[p.name].push('천라지망');
      }
      if ((p.branch === '진' || p.branch === '사') && cheollaJimang.지망) {
        pillarSinsal[p.name].push('천라지망');
      }
    }
  }

  return {
    pillarSinsal,
    allSinsal: [...new Set(allSinsal)],
    gongmang,
    cheollaJimang,
    guiin,
    pillarRelations,
  };
}
