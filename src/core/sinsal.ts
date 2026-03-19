/**
 * 신살(神殺) 계산 엔진 — 30+ 종류
 * 모든 신살은 규칙 기반 테이블이므로 코드에서 계산.
 * AI에게 맡기지 않는다.
 */

import type { Branch, Stem } from '@/types/saju.ts';
import { BRANCHES } from '@/types/saju.ts';
import { STEM_OHAENG, STEM_YINYANG, BRANCH_JIJANGGAN, getSipsin } from './tables.ts';

// ===== 유틸리티 =====

type PillarName = 'year' | 'month' | 'day' | 'hour';

const PILLAR_KOR: Record<PillarName, string> = {
  year: '년', month: '월', day: '일', hour: '시',
};

// ===== 삼합 그룹 매핑 =====
// 0: 인오술(화), 1: 사유축(금), 2: 신자진(수), 3: 해묘미(목)
const SAMHAP_GROUP: Record<Branch, number> = {
  '인': 0, '오': 0, '술': 0,
  '사': 1, '유': 1, '축': 1,
  '신': 2, '자': 2, '진': 2,
  '해': 3, '묘': 3, '미': 3,
};

// ===== 역마/천살/지살/반안살 (삼합 기반 4살) =====
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

// ===== 태극귀인 (太極貴人) — 일간 기준 =====
const TAEGEUK_GUIIN: Record<Stem, Branch[]> = {
  '갑': ['자', '오'], '을': ['자', '오'],
  '병': ['묘', '유'], '정': ['묘', '유'],
  '무': ['사', '축', '진', '술'], '기': ['사', '축', '진', '술'],
  '경': ['인', '해'], '신': ['인', '해'],
  '임': ['사', '오'], '계': ['사', '오'],
};

// ===== 재고귀인 (金輿祿) — 특정 일주 =====
// 일간 기준, 해당 지지가 있으면 금여록
const JAEGO_GUIIN: Record<Stem, Branch> = {
  '갑': '진', '을': '사', '병': '미', '정': '신',
  '무': '미', '기': '신', '경': '술', '신': '해',
  '임': '축', '계': '인',
};

// ===== 곡각살 (哭角殺) — 일지 기준 3칸 관계 =====
const GOGGAK: Record<Branch, Branch> = {
  '자': '묘', '묘': '자', '오': '유', '유': '오',
  '축': '진', '진': '축', '미': '술', '술': '미',
  '인': '사', '사': '인', '신': '해', '해': '신',
};

// ===== 현침살 (懸針殺) — 천간 중 세로 획이 긴 글자 =====
const HYUNCHIM_STEMS = new Set<Stem>(['갑', '신', '임']);

// ===== 의처의부살 (疑妻疑夫殺) — 일지 기준 =====
const UICHEO: Record<Branch, Branch> = {
  '자': '유', '축': '오', '인': '묘',
  '묘': '자', '진': '유', '사': '오',
  '오': '묘', '미': '자', '신': '유',
  '유': '오', '술': '묘', '해': '자',
};

// ===== 음욕살 (淫欲殺) — 일지 기준 =====
const EUMYOK: Record<Branch, Branch> = {
  '자': '유', '축': '신', '인': '미',
  '묘': '오', '진': '사', '사': '진',
  '오': '묘', '미': '인', '신': '축',
  '유': '자', '술': '해', '해': '술',
};

// ===== 단장관 (短腸關) — 월지+시지 조합 =====
// 월지 기준으로 해당 시지가 오면 단장관
const DANJANG: Record<Branch, Branch[]> = {
  '인': ['오', '미'], '묘': ['사', '오'],
  '진': ['진', '사'], '사': ['묘', '진'],
  '오': ['인', '묘'], '미': ['축', '인'],
  '신': ['자', '축'], '유': ['해', '자'],
  '술': ['술', '해'], '해': ['유', '술'],
  '자': ['신', '유'], '축': ['미', '신'],
};

// ===== 일덕 (日德) — 특정 일주 =====
const ILDUK_PILLARS = new Set(['갑인', '병진', '무진', '경술', '임술']);

// ===== 평두살 (平頭殺) — 천간 갑/을/병 + 지지 진/사 =====
const PYEONGDU_STEMS = new Set<Stem>(['갑', '을', '병']);
const PYEONGDU_BRANCHES = new Set<Branch>(['진', '사']);

// ===== 취명관 (聚明關) — 특정 월+시 조합 =====
const CHWIMYEONG: Record<Branch, Branch[]> = {
  '인': ['미', '신'], '묘': ['오', '미'],
  '진': ['사', '오'], '사': ['진', '사'],
  '오': ['묘', '진'], '미': ['인', '묘'],
  '신': ['축', '인'], '유': ['자', '축'],
  '술': ['해', '자'], '해': ['술', '해'],
  '자': ['유', '술'], '축': ['신', '유'],
};

// ===== 천간합 (天干合) =====
// 갑기→토, 을경→금, 병신→수, 정임→목, 무계→화
const CHEONGAN_HAP: [number, number, string][] = [
  [0, 5, '토'], // 갑기
  [1, 6, '금'], // 을경
  [2, 7, '수'], // 병신
  [3, 8, '목'], // 정임
  [4, 9, '화'], // 무계
];

// ===== 천간충 (天干沖) =====
// 갑경, 을신, 병임, 정계 (5칸 거리)
const CHEONGAN_CHUNG: [number, number][] = [
  [0, 6], // 갑경
  [1, 7], // 을신
  [2, 8], // 병임
  [3, 9], // 정계
];

// ===== 지지충 (地支沖) =====
const JIJI_CHUNG: [number, number][] = [
  [0, 6],  // 자오
  [1, 7],  // 축미
  [2, 8],  // 인신
  [3, 9],  // 묘유
  [4, 10], // 진술
  [5, 11], // 사해
];

// ===== 지지합 (地支合, 육합) =====
const JIJI_HAP: [number, number, string][] = [
  [0, 1, '토'],  // 자축
  [2, 11, '목'], // 인해
  [3, 10, '화'], // 묘술
  [4, 9, '금'],  // 진유
  [5, 8, '수'],  // 사신
  [6, 7, '토'],  // 오미
];

// ===== 원진 (怨嗔) =====
const WONJIN: [number, number][] = [
  [0, 7],  // 자미
  [1, 6],  // 축오
  [2, 9],  // 인유
  [3, 8],  // 묘신
  [4, 11], // 진해
  [5, 10], // 사술
];

// ===== 천라지망 (天羅地網) =====
// 술해 = 천라, 진사 = 지망

// ===== 귀문관살 (鬼門關殺) =====
const GUIMUN_PAIRS: [Branch, Branch][] = [
  ['인', '유'], ['묘', '오'], ['진', '해'],
  ['술', '사'], ['축', '신'], ['자', '미'],
];

// ===== 공망 (空亡) =====
function calculateGongmang(dayStemIndex: number, dayBranchIndex: number): Branch[] {
  const startBranch = ((dayBranchIndex - dayStemIndex) % 12 + 12) % 12;
  const gm1 = (startBranch + 10) % 12;
  const gm2 = (startBranch + 11) % 12;
  return [BRANCHES[gm1], BRANCHES[gm2]];
}

// ===== 천라지망 판별 =====
function hasCheollaJimang(branches: Branch[]): { 천라: boolean; 지망: boolean } {
  const has = (b: Branch) => branches.includes(b);
  return {
    천라: has('술') && has('해'),
    지망: has('진') && has('사'),
  };
}

// ===== 효신살 (梟神殺) — 편인이 사주 내에 존재하면 효신살 =====
function hasHyoshin(dayStem: Stem, allStems: Stem[], allBranches: Branch[]): boolean {
  const dayStemOhaeng = STEM_OHAENG[dayStem];
  const dayStemYinYang = STEM_YINYANG[dayStem];

  // 천간에서 편인 찾기
  for (const s of allStems) {
    const sipsin = getSipsin(dayStemOhaeng, dayStemYinYang, STEM_OHAENG[s], STEM_YINYANG[s]);
    if (sipsin === '편인') return true;
  }

  // 지지 정기에서 편인 찾기
  for (const b of allBranches) {
    const jjg = BRANCH_JIJANGGAN[b].find(j => j.type === '정기');
    if (jjg) {
      const sipsin = getSipsin(dayStemOhaeng, dayStemYinYang, STEM_OHAENG[jjg.stem], STEM_YINYANG[jjg.stem]);
      if (sipsin === '편인') return true;
    }
  }

  return false;
}

// ===== 메인 신살 계산 =====

export interface SinsalResult {
  pillarSinsal: {
    year: string[];
    month: string[];
    day: string[];
    hour: string[];
  };
  allSinsal: string[];
  gongmang: Branch[];
  cheollaJimang: { 천라: boolean; 지망: boolean };
  guiin: string[];
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
  const allStems = pillars.map(p => p.stem);

  const pillarSinsal: SinsalResult['pillarSinsal'] = { year: [], month: [], day: [], hour: [] };
  const pillarRelations: SinsalResult['pillarRelations'] = { year: [], month: [], day: [], hour: [] };
  const allSinsal: string[] = [];
  const guiin: string[] = [];

  // ===== 1. 삼합 기반 4살 (년지 기준) =====
  const yearGroup = SAMHAP_GROUP[year.branch];
  const fourSpirits = FOUR_SPIRITS[yearGroup];
  const samhapSpirits = SAMHAP_SPIRITS[yearGroup];

  for (const p of pillars) {
    if (p.branch === fourSpirits.역마) { pillarSinsal[p.name].push('역마살'); allSinsal.push(`${PILLAR_KOR[p.name]}주 역마살`); }
    if (p.branch === fourSpirits.반안) { pillarSinsal[p.name].push('반안살'); }
    if (p.branch === fourSpirits.천살) { pillarSinsal[p.name].push('천살'); }
    if (p.branch === fourSpirits.지살) { pillarSinsal[p.name].push('지살'); }
    if (p.branch === samhapSpirits.도화) { pillarSinsal[p.name].push('도화살'); allSinsal.push('도화살'); }
    if (p.branch === samhapSpirits.화개) { pillarSinsal[p.name].push('화개살'); allSinsal.push('화개살'); }
    if (p.branch === samhapSpirits.겁살) { pillarSinsal[p.name].push('겁살'); allSinsal.push('겁살'); }
  }

  // ===== 2. 괴강 =====
  const dayPillarStr = `${day.stem}${day.branch}`;
  if (GWAEGANG_PILLARS.has(dayPillarStr)) {
    pillarSinsal.day.push('괴강');
    allSinsal.push('괴강');
  }

  // ===== 3. 천을귀인 (일간 기준) =====
  const cheonulTargets = CHEONUL_GUIIN[day.stem];
  for (const p of pillars) {
    if (cheonulTargets.includes(p.branch)) {
      guiin.push(`천을귀인(${PILLAR_KOR[p.name]}지)`);
    }
  }

  // ===== 4. 천덕귀인 (월지 기준) =====
  const cheondukTarget = CHEONDUK[month.branch];
  for (const p of pillars) {
    if (p.stem === cheondukTarget) {
      guiin.push(`천덕귀인(${PILLAR_KOR[p.name]}간)`);
    }
  }

  // ===== 5. 월덕귀인 =====
  const woldukTarget = WOLDUK[month.branch];
  for (const p of pillars) {
    if (p.stem === woldukTarget) {
      guiin.push(`월덕귀인(${PILLAR_KOR[p.name]}간)`);
    }
  }

  // ===== 6. 복성귀인 =====
  const boksungTarget = BOKSUNG[day.stem];
  for (const p of pillars) {
    if (p.branch === boksungTarget) {
      guiin.push(`복성귀인(${PILLAR_KOR[p.name]}지)`);
    }
  }

  // ===== 7. 천록귀인 =====
  const cheonrokTarget = CHEONROK[day.stem];
  for (const p of pillars) {
    if (p.branch === cheonrokTarget) {
      guiin.push(`천록귀인(${PILLAR_KOR[p.name]}지)`);
    }
  }

  // ===== 8. 태극귀인 (일간 기준) =====
  const taegeukTargets = TAEGEUK_GUIIN[day.stem];
  for (const p of pillars) {
    if (taegeukTargets.includes(p.branch)) {
      guiin.push(`태극귀인(${PILLAR_KOR[p.name]}지)`);
    }
  }

  // ===== 9. 재고귀인 / 금여록 (일간 기준) =====
  const jaegoTarget = JAEGO_GUIIN[day.stem];
  for (const p of pillars) {
    if (p.branch === jaegoTarget) {
      guiin.push(`금여록(${PILLAR_KOR[p.name]}지)`);
    }
  }

  // ===== 10. 효신살 (편인이 있으면) =====
  if (hasHyoshin(day.stem, allStems, allBranches)) {
    allSinsal.push('효신살');
  }

  // ===== 11. 곡각살 (일지 기준) =====
  const goggakTarget = GOGGAK[day.branch];
  for (const p of pillars) {
    if (p.name !== 'day' && p.branch === goggakTarget) {
      pillarSinsal[p.name].push('곡각살');
      allSinsal.push('곡각살');
    }
  }

  // ===== 12. 현침살 (천간에 갑/신/임 있으면) =====
  for (const p of pillars) {
    if (HYUNCHIM_STEMS.has(p.stem)) {
      pillarSinsal[p.name].push('현침살');
      allSinsal.push('현침살');
    }
  }

  // ===== 13. 의처의부살 (일지 기준) =====
  const uicheoTarget = UICHEO[day.branch];
  for (const p of pillars) {
    if (p.name !== 'day' && p.branch === uicheoTarget) {
      pillarSinsal[p.name].push('의처의부살');
      allSinsal.push('의처의부살');
    }
  }

  // ===== 14. 음욕살 (일지 기준) =====
  const eumyokTarget = EUMYOK[day.branch];
  for (const p of pillars) {
    if (p.name !== 'day' && p.branch === eumyokTarget) {
      pillarSinsal[p.name].push('음욕살');
      allSinsal.push('음욕살');
    }
  }

  // ===== 15. 단장관 (월지+시지 조합) =====
  const danjangTargets = DANJANG[month.branch];
  if (danjangTargets && danjangTargets.includes(hour.branch)) {
    pillarSinsal.hour.push('단장관');
    allSinsal.push('단장관');
  }

  // ===== 16. 일덕 (특정 일주) =====
  if (ILDUK_PILLARS.has(dayPillarStr)) {
    pillarSinsal.day.push('일덕');
    allSinsal.push('일덕');
  }

  // ===== 17. 평두살 (천간 갑/을/병 + 지지 진/사) =====
  for (const p of pillars) {
    if (PYEONGDU_STEMS.has(p.stem) && PYEONGDU_BRANCHES.has(p.branch)) {
      pillarSinsal[p.name].push('평두살');
      allSinsal.push('평두살');
    }
  }

  // ===== 18. 취명관 (월지+시지 조합) =====
  const chwimyeongTargets = CHWIMYEONG[month.branch];
  if (chwimyeongTargets && chwimyeongTargets.includes(hour.branch)) {
    pillarSinsal.hour.push('취명관');
    allSinsal.push('취명관');
  }

  // ===== 19. 공망 =====
  const gongmang = calculateGongmang(day.stemIndex, day.branchIndex);

  // 공망 기둥 표시
  for (const p of pillars) {
    if (gongmang.includes(p.branch)) {
      pillarSinsal[p.name].push('공망');
    }
  }

  // ===== 20. 천라지망 =====
  const cheollaJimang = hasCheollaJimang(allBranches);
  if (cheollaJimang.천라) allSinsal.push('천라');
  if (cheollaJimang.지망) allSinsal.push('지망');

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

  // ===== 21. 귀문관살 (지지 조합) =====
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (const [a, b] of GUIMUN_PAIRS) {
        if ((allBranches[i] === a && allBranches[j] === b) ||
            (allBranches[i] === b && allBranches[j] === a)) {
          const nameI = pillars[i].name;
          const nameJ = pillars[j].name;
          const desc = `${allBranches[i]}${allBranches[j]}귀문관살`;
          pillarRelations[nameI].push(desc);
          pillarRelations[nameJ].push(desc);
          allSinsal.push('귀문관살');
        }
      }
    }
  }

  // ===== 22. 천간합 (기둥 간 관계) =====
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const si = pillars[i].stemIndex;
      const sj = pillars[j].stemIndex;
      for (const [a, b, result] of CHEONGAN_HAP) {
        if ((si === a && sj === b) || (si === b && sj === a)) {
          const desc = `${pillars[i].stem}${pillars[j].stem}합→${result}`;
          pillarRelations[pillars[i].name].push(desc);
          pillarRelations[pillars[j].name].push(desc);
        }
      }
    }
  }

  // ===== 23. 천간충 (기둥 간 관계) =====
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const si = pillars[i].stemIndex;
      const sj = pillars[j].stemIndex;
      for (const [a, b] of CHEONGAN_CHUNG) {
        if ((si === a && sj === b) || (si === b && sj === a)) {
          const desc = `${pillars[i].stem}${pillars[j].stem}충`;
          pillarRelations[pillars[i].name].push(desc);
          pillarRelations[pillars[j].name].push(desc);
        }
      }
    }
  }

  // ===== 24. 지지충 (기둥 간 관계) =====
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const bi = pillars[i].branchIndex;
      const bj = pillars[j].branchIndex;
      for (const [a, b] of JIJI_CHUNG) {
        if ((bi === a && bj === b) || (bi === b && bj === a)) {
          const desc = `${pillars[i].branch}${pillars[j].branch}충`;
          pillarRelations[pillars[i].name].push(desc);
          pillarRelations[pillars[j].name].push(desc);
        }
      }
    }
  }

  // ===== 25. 지지합 / 육합 (기둥 간 관계) =====
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const bi = pillars[i].branchIndex;
      const bj = pillars[j].branchIndex;
      for (const [a, b, result] of JIJI_HAP) {
        if ((bi === a && bj === b) || (bi === b && bj === a)) {
          const desc = `${pillars[i].branch}${pillars[j].branch}합→${result}`;
          pillarRelations[pillars[i].name].push(desc);
          pillarRelations[pillars[j].name].push(desc);
        }
      }
    }
  }

  // ===== 26. 원진 (기둥 간 관계) =====
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const bi = pillars[i].branchIndex;
      const bj = pillars[j].branchIndex;
      for (const [a, b] of WONJIN) {
        if ((bi === a && bj === b) || (bi === b && bj === a)) {
          const desc = `${pillars[i].branch}${pillars[j].branch}원진`;
          pillarRelations[pillars[i].name].push(desc);
          pillarRelations[pillars[j].name].push(desc);
        }
      }
    }
  }

  // ===== 27. 천라지망 (기둥 간 관계) =====
  if (cheollaJimang.천라) {
    // 술해가 있는 기둥들을 찾아 관계 표시
    const sulPillars = pillars.filter(p => p.branch === '술');
    const haePillars = pillars.filter(p => p.branch === '해');
    for (const sp of sulPillars) {
      for (const hp of haePillars) {
        pillarRelations[sp.name].push('천라(술해)');
        pillarRelations[hp.name].push('천라(술해)');
      }
    }
  }
  if (cheollaJimang.지망) {
    const jinPillars = pillars.filter(p => p.branch === '진');
    const saPillars = pillars.filter(p => p.branch === '사');
    for (const jp of jinPillars) {
      for (const sp of saPillars) {
        pillarRelations[jp.name].push('지망(진사)');
        pillarRelations[sp.name].push('지망(진사)');
      }
    }
  }

  // ===== 28. 공망 관계 표시 =====
  for (const p of pillars) {
    if (gongmang.includes(p.branch)) {
      pillarRelations[p.name].push(`공망(${p.branch})`);
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
