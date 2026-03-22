/**
 * saju-dog 워커 — EC2 상시 실행
 *
 * - pending reading을 감시하고 Claude API로 동시 처리
 * - 레이트리밋/서버 장애 시 무한 재시도 (지수 백오프)
 * - 실패 시 자동 환불
 * - 동시 처리 수 제한 (MAX_CONCURRENT)
 *
 * PM2: pm2 start ecosystem.config.cjs
 */

import { createClient } from '@supabase/supabase-js';

// ===== 설정 =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '3000');
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '500');
const RETRY_BASE_DELAY = parseInt(process.env.RETRY_BASE_DELAY_MS || '5000');
const RETRY_MAX_DELAY = 60_000; // 최대 60초 대기

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CREDIT_COSTS = {
  comprehensive: 3, compatibility: 3, daeun: 2, yearly: 2,
  daily: 0, chat: 1, business: 3, luckyday: 2,
  love: 2, wealth: 2, health: 2, career: 2, pastlife: 2, moving: 2,
};

// 현재 처리 중인 reading ID 추적
const activeJobs = new Set();
let totalProcessed = 0;
let totalFailed = 0;
let totalCostUsd = 0;

// ===== 로깅 =====
function log(level, msg, data) {
  const ts = new Date().toISOString();
  const prefix = { info: '✅', warn: '⚠️', error: '❌', debug: '🔍' }[level] || 'ℹ️';
  console.log(`[${ts}] ${prefix} ${msg}`, data ? JSON.stringify(data) : '');
}

// ===== Claude API 호출 (무한 재시도) =====
async function callClaude(params) {
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(params),
      });

      // 성공
      if (response.ok) {
        return response.json();
      }

      // 레이트리밋 (429) 또는 서버 에러 (5xx) → 무한 재시도
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get('retry-after');
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.min(RETRY_BASE_DELAY * Math.pow(2, attempt - 1), RETRY_MAX_DELAY);

        log('warn', `API ${response.status}, attempt ${attempt}, retry in ${(delay / 1000).toFixed(0)}s`);
        await sleep(delay);
        continue;
      }

      // 4xx (429 제외) → 재시도 불가한 에러
      const errBody = await response.text();
      throw new Error(`Claude API ${response.status}: ${errBody}`);

    } catch (err) {
      // 네트워크 에러 → 재시도
      if (err.message?.includes('Claude API')) throw err; // 4xx는 그대로 throw

      const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, attempt - 1), RETRY_MAX_DELAY);
      log('warn', `Network error (attempt ${attempt}): ${err.message}, retry in ${(delay / 1000).toFixed(0)}s`);
      await sleep(delay);
    }
  }
}

// ===== 프롬프트 설정 로드 =====
async function getPromptConfig(serviceType) {
  // 해당 서비스 타입으로 조회 (최대 5회 재시도, fallback 없음)
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { data, error } = await supabase
      .from('prompt_configs').select('*')
      .eq('service_type', serviceType).eq('is_active', true).single();

    if (data) {
      log('info', `Prompt config loaded: ${serviceType} (${data.id.slice(0, 8)})`);
      return data;
    }

    log('warn', `Prompt config query failed for "${serviceType}" (attempt ${attempt}/5): ${error?.message || 'no data'}`);
    if (attempt < 5) await sleep(2000 * attempt); // 2s, 4s, 6s, 8s
  }

  // 5회 전부 실패 → 에러 throw → reading 재시도로 처리
  throw new Error(`Prompt config "${serviceType}" 로드 실패 (5회 시도)`);
}

// ===== 고도화된 용신 분석 + 개인화 추천 =====
function buildLuckySection(data, p, serviceType) {
  const ohaeng = data.ohaengCount || {};
  const STEM_ELEM = { '갑':'목','을':'목','병':'화','정':'화','무':'토','기':'토','경':'금','신':'금','임':'수','계':'수' };
  const BRANCH_ELEM = { '자':'수','축':'토','인':'목','묘':'목','진':'토','사':'화','오':'화','미':'토','신':'금','유':'금','술':'토','해':'수' };
  const dayStem = p.day.stem;
  const dayElement = STEM_ELEM[dayStem] || '토';
  const monthBranch = p.month.branch;

  // 1. 계절 득령 판단 (월지 기준)
  const SEASON_STRONG = { '인':'목','묘':'목','진':'목', '사':'화','오':'화','미':'화', '신':'금','유':'금','술':'금', '해':'수','자':'수','축':'수' };
  const seasonElement = SEASON_STRONG[monthBranch] || '토';
  const isSeasonSupport = seasonElement === dayElement; // 득령

  // 2. 통근 판단 (지지에 일간과 같은 오행이 있는지)
  const branches = [p.year.branch, p.month.branch, p.day.branch, p.hour.branch];
  const tonggeun = branches.filter(b => BRANCH_ELEM[b] === dayElement).length;

  // 3. 종합 강약 판단
  const dayOhaengCount = Number(ohaeng[dayElement]) || 0;
  const totalCount = Object.values(ohaeng).reduce((a, b) => Number(a) + Number(b), 0);
  const strengthScore = dayOhaengCount + (isSeasonSupport ? 2 : 0) + tonggeun;
  const isDayStrong = strengthScore >= 4; // 신강 기준
  const strengthLabel = strengthScore >= 6 ? '극신강' : strengthScore >= 4 ? '신강' : strengthScore >= 2 ? '신약' : '극신약';

  // 4. 용신/희신/기신 계산
  const GEN = { '목':'수','화':'목','토':'화','금':'토','수':'금' }; // 생
  const DRAIN = { '목':'화','화':'토','토':'금','금':'수','수':'목' }; // 설
  const CONTROL = { '목':'금','화':'수','토':'목','금':'화','수':'토' }; // 극

  let yongshin, heeshin, gishin;
  if (isDayStrong) {
    yongshin = DRAIN[dayElement]; // 식상
    heeshin = DRAIN[DRAIN[dayElement]]; // 재성 (식상의 식상)
    gishin = GEN[dayElement]; // 인성 (더 강하게 만드는 것)
  } else {
    yongshin = GEN[dayElement]; // 인성
    heeshin = dayElement; // 비겁
    gishin = CONTROL[dayElement]; // 관살 (더 약하게 만드는 것)
  }

  // 5. 확정값 (사주 원리상 변하면 안 되는 것)
  const DIR_MAP = { '목':'동쪽', '화':'남쪽', '토':'중앙', '금':'서쪽', '수':'북쪽' };
  const primaryDir = DIR_MAP[yongshin] || '남쪽';
  const secondaryDir = DIR_MAP[heeshin] || '동쪽';
  const avoidDir = DIR_MAP[gishin] || '서쪽';

  // 6. 스타일 가이드 (Claude가 범위 내에서 자유롭게 선택)
  const COLOR_FAMILIES = {
    '목': '초록 계열 (진초록, 연두, 올리브, 민트, 카키 등)',
    '화': '빨강 계열 (빨간색, 주황, 코럴, 분홍, 와인색 등)',
    '토': '황색 계열 (노란색, 황토, 베이지, 카멜, 머스타드 등)',
    '금': '흰색/금속 계열 (흰색, 은색, 아이보리, 크림, 골드 등)',
    '수': '파랑/검정 계열 (남색, 파란색, 네이비, 검정, 차콜 등)',
  };
  const NUM_POOLS = { '목': [3,8], '화': [2,7], '토': [5,10], '금': [4,9], '수': [1,6] };
  const FOOD_STYLES = {
    '목': '신맛/푸른 채소 계열 (샐러드, 나물, 비빔밥, 청국장, 녹즙, 깻잎, 시금치 등에서 하나)',
    '화': '매운맛/구이 계열 (삼겹살, 양고기, 떡볶이, 매운탕, 불고기, 닭갈비 등에서 하나)',
    '토': '단맛/곡물 계열 (고구마, 떡, 호박죽, 잡곡밥, 감자탕, 된장찌개 등에서 하나)',
    '금': '담백/흰색 계열 (배, 무, 두부, 백숙, 흰쌀밥, 콩나물국 등에서 하나)',
    '수': '짠맛/해산물 계열 (미역국, 조개탕, 생선구이, 해물파전, 검은콩 등에서 하나)',
  };

  // 7. 신살 기반 참고사항
  const sinsal = data.sinsal?.allSinsal || [];
  const sinsalNotes = [];
  if (sinsal.includes('역마살')) sinsalNotes.push('역마살 → 이동/여행/변화에 유리');
  if (sinsal.includes('화개살')) sinsalNotes.push('화개살 → 예술/종교/학문에 유리');
  if (sinsal.includes('도화살')) sinsalNotes.push('도화살 → 인간관계/매력에 유리');
  if (sinsal.includes('괴강')) sinsalNotes.push('괴강 → 독립적 추진력, 고집');
  if (sinsal.includes('장성살')) sinsalNotes.push('장성살 → 리더십/승진에 유리');
  if (sinsal.includes('양인살')) sinsalNotes.push('양인살 → 결단력/추진력 강하나 과격 주의');
  if (sinsal.includes('백호살')) sinsalNotes.push('백호살 → 수술/사고 주의, 급변 가능');
  if (sinsal.includes('원진살')) sinsalNotes.push('원진살 → 가까운 관계 갈등 소지');
  if (sinsal.includes('형살')) sinsalNotes.push('형살 → 법적/관계 마찰 주의');
  if (sinsal.includes('관살혼잡')) sinsalNotes.push('관살혼잡 → 직업 변동 많음, 한 우물 파기 필요');
  if (sinsal.includes('상관견관')) sinsalNotes.push('상관견관 → 윗사람과 충돌 소지, 자유업 유리');
  if (sinsal.includes('식신제살')) sinsalNotes.push('식신제살 → 위기를 기회로 바꾸는 능력');
  if (sinsal.includes('효신살')) sinsalNotes.push('효신살 → 편인 작용, 변덕/모성 부족 주의');

  // 8. 대운 참고
  const currentDaeun = data.daeun?.find(d => d.isCurrent);
  const daeunElement = currentDaeun ? STEM_ELEM[currentDaeun.stem] : null;
  let daeunNote = '';
  if (daeunElement) {
    if (daeunElement === yongshin) daeunNote = '현재 대운이 용신과 일치 → 운세 상승기';
    else if (daeunElement === gishin) daeunNote = '현재 대운이 기신 → 신중함 필요';
  }

  return `
## ★ 사주 기반 분석 데이터

### 확정 사실 (반드시 일관되게 적용)
- 일간: ${dayStem}(${dayElement}) / 강약: ${strengthLabel} (득령:${isSeasonSupport?'O':'X'}, 통근:${tonggeun}개)
- 용신: ${yongshin} / 희신: ${heeshin} / 기신: ${gishin}
- 행운 방위: ${primaryDir} (용신) / 보조 방위: ${secondaryDir} (희신)
- 피할 방위: ${avoidDir} (기신)
${daeunNote ? `- ${daeunNote}` : ''}
${sinsalNotes.length > 0 ? `- 신살: ${sinsalNotes.join(', ')}` : ''}

### luckyItems 가이드 (범위 내에서 자유롭게 선택)
- color: ${COLOR_FAMILIES[yongshin]} 중 하나를 2~3글자로
- number: ${NUM_POOLS[yongshin].join(' 또는 ')} 중 하나
- direction: "${primaryDir}" (이것만 고정)
- food: ${FOOD_STYLES[yongshin]} — 2~4글자 음식명 하나

### 풀이 본문에서 자유롭게 활용
- 보조 행운색 범위: ${COLOR_FAMILIES[heeshin]}
- 피해야 할 색 범위: ${COLOR_FAMILIES[gishin]}
- 보조 숫자: ${NUM_POOLS[heeshin].join(', ')}
- 기신 음식(피할 음식) 범위: ${FOOD_STYLES[gishin]}

### [규칙]
- direction은 "${primaryDir}"으로 고정. 이사/여행/방위 관련 조언도 이 방위 기준
- color, number, food는 위 범위 안에서 매번 다르게 골라도 됨
- luckyItems 값은 짧은 단어만 (설명문 금지)
- 풀이 본문에서는 용신/희신/기신 개념을 활용해 자유롭게 해설
`;
}

// ===== 유저 메시지 빌드 =====
function buildUserMessage(reading, profile, secondaryProfile, extraProfiles = []) {
  const data = profile.calculated_saju;
  if (!data) throw new Error('calculated_saju 없음');

  const p = data.pillars;
  const s = data.sinsal || {};
  const fmtArr = (arr) => arr?.length > 0 ? arr.join(', ') : '없음';
  const fmtJJ = (jj) => jj?.map(j => `${j.stem}(${j.sipsin}·${j.type})`).join(', ') || '';

  if (reading.service_type === 'compatibility' || reading.service_type === 'business') {
    // 모든 참여자를 allProfileIds에서 가져와서 통합
    const allParticipants = [profile, secondaryProfile, ...extraProfiles].filter(p => p?.calculated_saju);
    const totalCount = allParticipants.length;

    if (totalCount < 2) throw new Error('궁합 분석에 최소 2명의 프로필이 필요합니다');

    // metadata에서 관계 유형 읽기
    const meta = reading.metadata || {};
    const relationType = meta.relationType || '';

    const relationContext = relationType
      ? `\n## 관계 유형: ${relationType}\n이 관계에 맞게 궁합을 풀어주세요. 연인이면 연애/결혼 중심, 친구면 우정/신뢰 중심, 동업이면 사업/역할분담 중심, 가족이면 소통/갈등해결 중심으로.\n`
      : '';

    const participantBlocks = allParticipants.map((pp, i) => {
      const pd = pp.calculated_saju;
      const ppillars = pd.pillars;
      const ps = pd.sinsal || {};
      return `## ${i + 1}번째 참여자 (${pd.input?.name || pp.name})
사주: ${ppillars.year.stem}${ppillars.year.branch} ${ppillars.month.stem}${ppillars.month.branch} ${ppillars.day.stem}${ppillars.day.branch} ${ppillars.hour.stem}${ppillars.hour.branch}
십신: ${ppillars.year.stemSipsin}/${ppillars.month.stemSipsin}/일주/${ppillars.hour.stemSipsin}
오행: 목${pd.ohaengCount?.['목']} 화${pd.ohaengCount?.['화']} 토${pd.ohaengCount?.['토']} 금${pd.ohaengCount?.['금']} 수${pd.ohaengCount?.['수']}
띠: ${pd.ddi?.fullName || '?'} / 별자리: ${pd.zodiac?.name || '?'}
신살: ${fmtArr(ps.allSinsal)}
귀인: ${fmtArr(ps.guiin)}
기둥관계: 년${fmtArr(ps.pillarRelations?.year)} / 월${fmtArr(ps.pillarRelations?.month)} / 일${fmtArr(ps.pillarRelations?.day)} / 시${fmtArr(ps.pillarRelations?.hour)}
공망: ${fmtArr(ps.gongmang)}`;
    }).join('\n\n');

    const userQ = (reading.metadata || {}).userQuestion;
    const questionBlock = userQ ? `
## ★★★ 사용자 질문 (최우선) ★★★
"${userQ}"

[절대 규칙] 위 질문에 대한 답변을 반드시 전용 챕터 1개로 작성하세요.
- 챕터 제목에 질문 키워드를 포함하세요 (예: "프로포즈 타이밍", "결혼 시기" 등)
- 사주 데이터를 근거로 질문에 대한 구체적이고 실질적인 답변을 하세요
- 이 챕터가 없으면 실패 처리됩니다
` : '';

    return `${questionBlock}${relationContext}
${participantBlocks}

[중요] 이 궁합에는 총 ${totalCount}명이 참여합니다. 반드시 ${totalCount}명 전원의 관계를 분석하세요.
각 챕터에서 모든 참여자의 이름을 언급하고, 서로 간의 관계를 비교 분석해야 합니다.
2명만 분석하고 나머지를 빠뜨리면 실패 처리됩니다.

[이모지 규칙] 각 챕터의 "emoji" 필드에 반드시 이모지 1개를 넣으세요 (예: "🔥"). "title"에는 이모지를 넣지 마세요. 이모지는 오직 "emoji" 필드에만!
궁합을 JSON으로 작성해주세요.`;
  }

  // 서비스 타입별 분석 지시
  const SERVICE_INSTRUCTIONS = {
    comprehensive: '종합 사주풀이를 해주세요.',
    daeun: '대운(10년 단위) 흐름을 시간순으로 상세 분석해주세요. 현재 대운과 다음 대운 전환 시점을 특히 상세히.',
    yearly: '올해/특정연도 운세를 월별로 상세 분석해주세요.',
    luckyday: '결혼/이사/개업 등 중요한 일의 길일을 월별로 추천해주세요.',
    love: '연애/결혼 운세와 연애 시기를 분석해주세요. 이상형, 연애 스타일, 골든타임.',
    wealth: '재물운을 특화 분석해주세요. 돈 버는 스타일, 투자 적기, 위험 시기.',
    health: '건강운을 특화 분석해주세요. 오행 건강, 약한 장기, 운동/식이 조언.',
    career: '직업 적성을 특화 분석해주세요. 추천 직종, 이직 타이밍, 성공 전략.',
    pastlife: '전생 이야기를 사주 기반으로 재미있게 풀어주세요.',
    moving: '이사/부동산 운을 특화 분석해주세요. 좋은 방위, 피할 방위, 이사 적기, 부동산 투자.',
    daily: '오늘의 운세를 분석해주세요.',
  };
  const serviceInstruction = SERVICE_INSTRUCTIONS[reading.service_type] || SERVICE_INSTRUCTIONS.comprehensive;

  // ===== 고도화된 용신 분석 + 개인화 추천 (결정적) =====
  const luckySection = buildLuckySection(data, p, reading.service_type);

  return `[분석 유형: ${reading.service_type}]
아래는 서버에서 정밀 계산된 사주 데이터입니다. 이 데이터만 기반으로 해설하세요.
${luckySection}
## 기본 정보
- 이름: ${data.input?.name || profile.name} / 성별: ${data.input?.gender === 'male' ? '남성' : '여성'}
- 띠: ${data.ddi?.fullName || '?'} / 별자리: ${data.zodiac?.name || '?'}

## 사주팔자
| 구분 | 년주 | 월주 | 일주 | 시주 |
|------|------|------|------|------|
| 천간 | ${p.year.stem}(${p.year.stemHanja}) | ${p.month.stem}(${p.month.stemHanja}) | ${p.day.stem}(${p.day.stemHanja})★일간 | ${p.hour.stem}(${p.hour.stemHanja}) |
| 지지 | ${p.year.branch}(${p.year.branchHanja}) | ${p.month.branch}(${p.month.branchHanja}) | ${p.day.branch}(${p.day.branchHanja}) | ${p.hour.branch}(${p.hour.branchHanja}) |
| 천간십신 | ${p.year.stemSipsin} | ${p.month.stemSipsin} | 일주 | ${p.hour.stemSipsin} |
| 지지십신 | ${p.year.branchSipsin} | ${p.month.branchSipsin} | ${p.day.branchSipsin} | ${p.hour.branchSipsin} |
| 12운성 | ${p.year.twelveStage} | ${p.month.twelveStage} | ${p.day.twelveStage} | ${p.hour.twelveStage} |

## 지장간
- 년지: ${fmtJJ(p.year.jijanggan)} / 월지: ${fmtJJ(p.month.jijanggan)}
- 일지: ${fmtJJ(p.day.jijanggan)} / 시지: ${fmtJJ(p.hour.jijanggan)}

## 오행 분포
목:${data.ohaengCount?.['목']} / 화:${data.ohaengCount?.['화']} / 토:${data.ohaengCount?.['토']} / 금:${data.ohaengCount?.['금']} / 수:${data.ohaengCount?.['수']}

## 기둥별 신살
- 년주: ${fmtArr(s.pillarSinsal?.year)} / 월주: ${fmtArr(s.pillarSinsal?.month)}
- 일주: ${fmtArr(s.pillarSinsal?.day)} / 시주: ${fmtArr(s.pillarSinsal?.hour)}

## 기둥별 관계
- 년주: ${fmtArr(s.pillarRelations?.year)} / 월주: ${fmtArr(s.pillarRelations?.month)}
- 일주: ${fmtArr(s.pillarRelations?.day)} / 시주: ${fmtArr(s.pillarRelations?.hour)}

## 전체 신살: ${fmtArr(s.allSinsal)}
## 귀인: ${fmtArr(s.guiin)}
## 공망: ${fmtArr(s.gongmang)}

## 대운
${data.daeun?.map(d => `- ${d.startAge}~${d.endAge}세: ${d.stem}${d.branch} [${d.stemSipsin}/${d.branchSipsin}]${d.isCurrent ? ' ★현재' : ''}`).join('\n') || '없음'}

## ${data.currentYear?.year || new Date().getFullYear()}년 세운
- ${data.currentYear?.stem || '?'}${data.currentYear?.branch || '?'}년

${(() => {
  const q = (reading.metadata || {}).userQuestion;
  if (!q) return '';
  return `
## ★★★ 사용자 질문 (최우선) ★★★
"${q}"

[절대 규칙] 위 질문에 대한 답변을 반드시 전용 챕터 1개로 작성하세요.
- 챕터 제목에 질문 키워드를 포함하세요
- 사주 데이터를 근거로 질문에 대한 구체적이고 실질적인 답변을 하세요
- 이 챕터가 없으면 실패 처리됩니다
`;
})()}
[중요 지시] ${serviceInstruction}
[이모지 규칙] 각 챕터의 "emoji" 필드에 반드시 이모지 1개를 넣으세요 (예: "🔥"). "title"에는 이모지를 넣지 마세요. 이모지는 오직 "emoji" 필드에만!
위 사주 데이터를 기반으로, 이 분석 유형(${reading.service_type})에 맞는 풀이를 JSON으로 작성하세요.
종합 사주풀이처럼 일반적인 분석을 하지 말고, 반드시 요청된 분석 유형에 집중하세요.`;
}

// ===== Structured Outputs 스키마 (response_format: json_schema) =====
// https://platform.claude.com/docs/en/build-with-claude/structured-outputs

const READING_SCHEMA = {
  type: 'object',
  required: ['summary', 'chapters', 'advice', 'luckyItems'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'emoji', 'content'],
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          emoji: { type: 'string' },
          content: { type: 'string' },
        },
      },
    },
    advice: { type: 'array', items: { type: 'string' } },
    luckyItems: {
      type: 'object',
      additionalProperties: false,
      required: ['color', 'number', 'direction', 'food'],
      properties: {
        color: { type: 'string' },
        number: { type: 'string' },
        direction: { type: 'string' },
        food: { type: 'string' },
      },
    },
  },
};

const COMPATIBILITY_SCHEMA = {
  type: 'object',
  required: ['summary', 'overallScore', 'chapters', 'advice'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    overallScore: { type: 'number' },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'emoji', 'content'],
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          emoji: { type: 'string' },
          content: { type: 'string' },
        },
      },
    },
    advice: { type: 'array', items: { type: 'string' } },
  },
};

const DAILY_SCHEMA = {
  type: 'object',
  required: ['summary', 'overallLuck', 'categories', 'advice', 'luckyItems'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    overallLuck: { type: 'number' },
    categories: {
      type: 'object',
      additionalProperties: false,
      required: ['love', 'money', 'work', 'health'],
      properties: {
        love: { type: 'object', additionalProperties: false, required: ['score', 'message'], properties: { score: { type: 'number' }, message: { type: 'string' } } },
        money: { type: 'object', additionalProperties: false, required: ['score', 'message'], properties: { score: { type: 'number' }, message: { type: 'string' } } },
        work: { type: 'object', additionalProperties: false, required: ['score', 'message'], properties: { score: { type: 'number' }, message: { type: 'string' } } },
        health: { type: 'object', additionalProperties: false, required: ['score', 'message'], properties: { score: { type: 'number' }, message: { type: 'string' } } },
      },
    },
    advice: { type: 'string' },
    luckyItems: {
      type: 'object',
      additionalProperties: false,
      required: ['color', 'number', 'food'],
      properties: { color: { type: 'string' }, number: { type: 'string' }, food: { type: 'string' } },
    },
  },
};

function getOutputConfig(serviceType) {
  let schema;
  if (serviceType === 'compatibility') schema = COMPATIBILITY_SCHEMA;
  else if (serviceType === 'daily') schema = DAILY_SCHEMA;
  else schema = READING_SCHEMA;

  // Claude API: output_config.format (not response_format)
  return {
    format: {
      type: 'json_schema',
      schema,
    },
  };
}

// ===== 비용 계산 =====
function calculateCost(model, usage) {
  const inp = usage.input_tokens || 0;
  const out = usage.output_tokens || 0;
  const cacheR = usage.cache_read_input_tokens || 0;
  const cacheC = usage.cache_creation_input_tokens || 0;

  let iRate = 3.0, oRate = 15.0;
  if (model.includes('opus')) { iRate = 15.0; oRate = 75.0; }
  else if (model.includes('haiku')) { iRate = 0.25; oRate = 1.25; }

  const cost = ((inp - cacheR) * iRate + cacheR * iRate * 0.1 + cacheC * iRate * 1.25 + out * oRate) / 1e6;
  return { model, input_tokens: inp, output_tokens: out, cache_read_tokens: cacheR, cache_creation_tokens: cacheC, cost_usd: Math.round(cost * 10000) / 10000 };
}

// ===== 크레딧 환불 =====
async function refundCredits(userId, serviceType, readingId) {
  const cost = CREDIT_COSTS[serviceType] ?? 2;
  if (cost <= 0) return;
  const { data: credits } = await supabase.from('credits').select('bones').eq('user_id', userId).single();
  if (credits) {
    await supabase.from('credits').update({ bones: credits.bones + cost, updated_at: new Date().toISOString() }).eq('user_id', userId);
    await supabase.from('credit_transactions').insert({ user_id: userId, type: 'refund', bones_delta: cost, description: `${serviceType} 실패 자동환불`, related_reading_id: readingId });
    log('info', `Refunded ${cost} bones to ${userId.slice(0, 8)}...`);
  }
}

// ===== 채팅 메시지 처리 =====
async function processChatMessage(msg) {
  const mid = msg.id.slice(0, 8);
  log('info', `[CHAT:${mid}] Start`);

  await supabase.from('chat_messages').update({ processing_status: 'processing' }).eq('id', msg.id);

  try {
    // 세션 + 프로필 로드
    const { data: session } = await supabase.from('chat_sessions').select('*, saju_profiles(*)').eq('id', msg.session_id).single();
    if (!session) throw new Error('세션 없음');
    const profile = session.saju_profiles;
    if (!profile?.calculated_saju) throw new Error('calculated_saju 없음');

    // 이전 메시지 로드 (최근 20개)
    const { data: history } = await supabase.from('chat_messages')
      .select('role, content')
      .eq('session_id', msg.session_id)
      .eq('processing_status', 'completed')
      .order('created_at', { ascending: true })
      .limit(20);

    // 사주 데이터 (풀이와 동일한 수준으로 제공)
    const data = profile.calculated_saju;
    const p = data.pillars;
    const s = data.sinsal || {};
    const fmtArr = (arr) => arr?.length > 0 ? arr.join(', ') : '없음';

    const luckyInfo = buildLuckySection(data, p, 'chat');

    const sajuContext = `사주 정보 (${data.input?.name || profile.name}, ${data.input?.gender === 'male' ? '남' : '여'}):
사주: ${p.year.stem}${p.year.branch} ${p.month.stem}${p.month.branch} ${p.day.stem}${p.day.branch} ${p.hour.stem}${p.hour.branch}
십신: ${p.year.stemSipsin}/${p.month.stemSipsin}/일주/${p.hour.stemSipsin}
오행: 목${data.ohaengCount?.['목']} 화${data.ohaengCount?.['화']} 토${data.ohaengCount?.['토']} 금${data.ohaengCount?.['금']} 수${data.ohaengCount?.['수']}
띠: ${data.ddi?.fullName || '?'} / 별자리: ${data.zodiac?.name || '?'}
신살: ${fmtArr(s.allSinsal)}
귀인: ${fmtArr(s.guiin)}
기둥별 관계: 년${fmtArr(s.pillarRelations?.year)} / 월${fmtArr(s.pillarRelations?.month)} / 일${fmtArr(s.pillarRelations?.day)} / 시${fmtArr(s.pillarRelations?.hour)}
공망: ${fmtArr(s.gongmang)}
현재 대운: ${data.daeun?.find(d => d.isCurrent)?.stem || '?'}${data.daeun?.find(d => d.isCurrent)?.branch || '?'}
${luckyInfo}`;

    const systemPrompt = `당신은 '복돌이'라는 이름의 사주 상담 골든 리트리버입니다.
사용자의 사주 데이터를 기반으로 친근하고 따뜻하게 상담합니다.

${sajuContext}

규칙:
- 한국어로 답변하세요
- 반말이 아닌 존댓말을 사용하세요
- 사주 데이터를 근거로 구체적으로 답변하세요
- 딱딱한 한문 용어 대신 쉬운 말로 설명하세요
- 가끔 강아지 이모지(🐾🐕)를 섞어 친근감을 주세요
- 답변은 300자 이내로 간결하게 하세요
- <strong>태그로 핵심 키워드를 강조하세요`;

    const messages = [
      ...(history || []).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: msg.content },
    ];

    const apiResponse = await callClaude({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = apiResponse.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const cost = calculateCost('sonnet', apiResponse.usage || {});

    // 응답 메시지 저장 (API 비용 포함)
    await supabase.from('chat_messages').insert({
      session_id: msg.session_id,
      role: 'assistant',
      content: reply,
      processing_status: 'completed',
      api_cost: cost,
    });

    // 원본 메시지 완료 처리
    await supabase.from('chat_messages').update({ processing_status: 'completed' }).eq('id', msg.id);

    // 세션 제목 자동 생성 (첫 메시지일 때)
    if (!history || history.length === 0) {
      const title = msg.content.length > 20 ? msg.content.slice(0, 20) + '...' : msg.content;
      await supabase.from('chat_sessions').update({ title, updated_at: new Date().toISOString() }).eq('id', msg.session_id);
    } else {
      await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', msg.session_id);
    }

    log('info', `[CHAT:${mid}] Done | ${cost.input_tokens}→${cost.output_tokens} tok | $${cost.cost_usd}`);
    totalCostUsd += cost.cost_usd;

  } catch (err) {
    log('error', `[CHAT:${mid}] Failed: ${err.message}`);
    await supabase.from('chat_messages').update({ processing_status: 'failed' }).eq('id', msg.id);
    // 실패 시 에러 메시지 응답
    await supabase.from('chat_messages').insert({
      session_id: msg.session_id,
      role: 'assistant',
      content: '죄송해요, 잠시 문제가 생겼어요. 다시 보내주세요 🐾',
      processing_status: 'completed',
    });
  } finally {
    activeJobs.delete(`chat:${msg.id}`);
  }
}

// ===== 단일 reading 처리 =====
async function processReading(reading) {
  const startTime = Date.now();
  const rid = reading.id.slice(0, 8);
  log('info', `[${rid}] Start (${reading.service_type}) [${activeJobs.size}/${MAX_CONCURRENT} slots]`);

  await supabase.from('readings').update({
    processing_status: 'processing',
    processing_started_at: new Date().toISOString(),
  }).eq('id', reading.id);

  try {
    const { data: profile } = await supabase.from('saju_profiles').select('*').eq('id', reading.profile_id).single();
    if (!profile?.calculated_saju) throw new Error('calculated_saju 없음');

    let secondaryProfile = null;
    if (reading.secondary_profile_id) {
      const { data } = await supabase.from('saju_profiles').select('*').eq('id', reading.secondary_profile_id).single();
      secondaryProfile = data;
    }

    // N명 궁합: metadata에서 추가 프로필 로드
    let extraProfiles = [];
    const readingMeta = reading.metadata || {};
    if (readingMeta.allProfileIds) {
      try {
        const allIds = JSON.parse(readingMeta.allProfileIds);
        const extraIds = allIds.filter(id => id !== reading.profile_id && id !== reading.secondary_profile_id);
        for (const eid of extraIds) {
          const { data: ep } = await supabase.from('saju_profiles').select('*').eq('id', eid).single();
          if (ep) extraProfiles.push(ep);
        }
      } catch {}
    }

    const config = await getPromptConfig(reading.service_type);
    const userMessage = buildUserMessage(reading, profile, secondaryProfile, extraProfiles);

    // Structured Outputs — output_config.format (Claude API 네이티브)
    const outputConfig = getOutputConfig(reading.service_type);

    const params = {
      model: config.model,
      max_tokens: config.max_tokens,
      messages: [{ role: 'user', content: userMessage }],
      output_config: outputConfig,
    };

    if (config.temperature !== null) params.temperature = config.temperature;
    if (config.use_prompt_caching) {
      params.system = [{ type: 'text', text: config.system_prompt, cache_control: { type: 'ephemeral' } }];
    } else {
      params.system = config.system_prompt;
    }

    // 품질 검증 포함 재시도 루프
    const MAX_QUALITY_RETRIES = 5;
    let parsed = null;
    let apiCost = null;
    let totalApiCost = 0;

    for (let attempt = 1; attempt <= MAX_QUALITY_RETRIES; attempt++) {
      // 재시도 시 유저 메시지에 피드백 추가
      if (attempt > 1) {
        const minChapters = reading.service_type === 'daily' ? 0 : 5;
        const retryMsg = `\n\n[중요] 이전 시도에서 품질 문제가 있었습니다. 반드시 다음을 지켜주세요:
- 최소 ${minChapters}개 이상의 완전한 챕터
- 각 챕터의 content는 최소 200자 이상
- 각 챕터의 "emoji" 필드에 반드시 이모지 1개를 넣으세요 (예: "🔥", "💰", "❤️")
- "title" 필드에는 이모지를 넣지 마세요. 이모지는 오직 "emoji" 필드에만!`;
        params.messages = [{ role: 'user', content: userMessage + retryMsg }];
      }

      const apiResponse = await callClaude(params);

      // stop_reason 체크
      const stopReason = apiResponse.stop_reason;
      if (stopReason === 'max_tokens') {
        log('warn', `[${rid}] Hit max_tokens (attempt ${attempt}), output truncated`);
      }

      const text = apiResponse.content.filter(b => b.type === 'text').map(b => b.text).join('');
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        // JSON 복구 시도: content 필드 내 이스케이프 안 된 따옴표 수정
        try {
          const fixed = text.replace(/"content"\s*:\s*"((?:[^"\\]|\\.)*)(?="(?:\s*[,}]))/gs, (match) => {
            return match;
          });
          // 더 공격적인 복구: 잘린 JSON 닫기
          let repaired = text;
          if (!repaired.trim().endsWith('}')) {
            // 마지막 완전한 객체까지 자르기
            const lastBrace = repaired.lastIndexOf('}');
            if (lastBrace > 0) {
              repaired = repaired.slice(0, lastBrace + 1);
              // 배열/객체 닫기
              const opens = (repaired.match(/\[/g) || []).length;
              const closes = (repaired.match(/\]/g) || []).length;
              for (let j = 0; j < opens - closes; j++) repaired += ']';
              const openBraces = (repaired.match(/\{/g) || []).length;
              const closeBraces = (repaired.match(/\}/g) || []).length;
              for (let j = 0; j < openBraces - closeBraces; j++) repaired += '}';
            }
          }
          result = JSON.parse(repaired);
          log('info', `[${rid}] JSON repaired successfully (attempt ${attempt})`);
        } catch {
          log('warn', `[${rid}] JSON parse failed (attempt ${attempt}): ${e.message}`);
          if (attempt === MAX_QUALITY_RETRIES) throw e;
          continue;
        }
      }
      apiCost = calculateCost(config.model, apiResponse.usage || {});
      totalApiCost += apiCost.cost_usd;

      // 이모지 후처리
      const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u;
      if (Array.isArray(result.chapters)) {
        for (const ch of result.chapters) {
          const titleMatch = ch.title?.match(emojiRegex);
          if (titleMatch) {
            // 타이틀 앞에 이모지가 있으면 제거
            const titleEmoji = titleMatch[1];
            ch.title = ch.title.replace(emojiRegex, '').trim();
            // emoji 필드가 비어있으면 타이틀에서 옮기기
            if (!ch.emoji || !ch.emoji.trim()) {
              ch.emoji = titleEmoji;
            }
          }
          // emoji 필드도 여러 개면 첫 번째만
          if (ch.emoji) {
            const em = ch.emoji.match(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u);
            ch.emoji = em ? em[1] : ch.emoji.trim().slice(0, 2);
          }
        }
      }

      // 품질 검증
      const chapters = result.chapters;
      const minChapters = reading.service_type === 'daily' ? 0 : 5;
      const chapterCount = Array.isArray(chapters) ? chapters.length : 0;
      const hasEnoughChapters = minChapters === 0 || chapterCount >= minChapters;

      // 챕터 내용 잘림 체크
      const truncatedChapters = Array.isArray(chapters) ? chapters.filter(ch => ch.content && ch.content.length < 100) : [];
      const hasTruncated = truncatedChapters.length > 2;

      // 이모지 누락 체크 (daily 제외)
      const missingEmoji = reading.service_type !== 'daily' && Array.isArray(chapters) && chapters.some(ch => !ch.emoji || !ch.emoji.trim());

      if (hasEnoughChapters && !hasTruncated && !missingEmoji) {
        parsed = result;
        log('info', `[${rid}] Quality OK (attempt ${attempt}): ${chapterCount} chapters, stop=${stopReason}`);
        break;
      }

      log('warn', `[${rid}] Quality FAIL (attempt ${attempt}/${MAX_QUALITY_RETRIES}): chapters=${chapterCount}/${minChapters}, truncated=${truncatedChapters.length}, missingEmoji=${missingEmoji}, stop=${stopReason}`);

      if (attempt === MAX_QUALITY_RETRIES) {
        parsed = result;
        log('warn', `[${rid}] Using last attempt result despite quality issues`);
      }
    }

    const durationMs = Date.now() - startTime;

    await supabase.from('readings').update({
      result: parsed,
      processing_status: 'completed',
      processing_completed_at: new Date().toISOString(),
      processing_duration_ms: durationMs,
      api_cost: { ...apiCost, total_cost_usd: Math.round(totalApiCost * 10000) / 10000 },
      prompt_config_id: config.id,
    }).eq('id', reading.id);

    totalProcessed++;
    totalCostUsd += totalApiCost;
    log('info', `[${rid}] Done ${(durationMs / 1000).toFixed(1)}s | ${apiCost.input_tokens}→${apiCost.output_tokens} tok | $${Math.round(totalApiCost * 10000) / 10000}`);

  } catch (err) {
    const durationMs = Date.now() - startTime;
    const reason = err.message || String(err);

    // 재시도 횟수 체크 (failure_reason에 retry count 기록)
    const prevReason = reading.failure_reason || '';
    const retryMatch = prevReason.match(/\[retry:(\d+)\]/);
    const retryCount = retryMatch ? parseInt(retryMatch[1]) + 1 : 1;
    const MAX_READING_RETRIES = 5;

    if (retryCount < MAX_READING_RETRIES) {
      // pending으로 되돌려서 자동 재시도
      await supabase.from('readings').update({
        processing_status: 'pending',
        processing_started_at: null,
        failure_reason: `[retry:${retryCount}] ${reason}`,
      }).eq('id', reading.id);
      log('warn', `[${rid}] Failed (retry ${retryCount}/${MAX_READING_RETRIES}): ${reason}`);
    } else {
      // 최대 재시도 초과 → 최종 실패 + 환불
      await supabase.from('readings').update({
        processing_status: 'failed',
        processing_completed_at: new Date().toISOString(),
        processing_duration_ms: durationMs,
        failure_reason: `[max retries] ${reason}`,
      }).eq('id', reading.id);
      await refundCredits(reading.user_id, reading.service_type, reading.id);
      totalFailed++;
      log('error', `[${rid}] Final fail after ${MAX_READING_RETRIES} retries: ${reason}`);
    }
  } finally {
    activeJobs.delete(reading.id);
  }
}

// ===== 메인 루프 =====
async function pollLoop() {
  while (true) {
    try {
      const available = MAX_CONCURRENT - activeJobs.size;

      if (available > 0) {
        // pending reading 가져오기 (동시 처리 가능한 만큼)
        const { data: pendings } = await supabase
          .from('readings')
          .select('*')
          .eq('processing_status', 'pending')
          .order('created_at', { ascending: true })
          .limit(available);

        if (pendings?.length > 0) {
          log('info', `Found ${pendings.length} pending (slots: ${available}/${MAX_CONCURRENT})`);
          for (const reading of pendings) {
            if (!activeJobs.has(reading.id)) {
              activeJobs.add(reading.id);
              // 비동기로 동시 실행 (await 안 함)
              processReading(reading);
            }
          }
        }
      }

      // 채팅 메시지 폴링
      const chatAvailable = MAX_CONCURRENT - activeJobs.size;
      if (chatAvailable > 0) {
        const { data: pendingChats } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('processing_status', 'pending')
          .eq('role', 'user')
          .order('created_at', { ascending: true })
          .limit(Math.min(chatAvailable, 10));

        if (pendingChats?.length > 0) {
          log('info', `Found ${pendingChats.length} pending chats`);
          for (const cm of pendingChats) {
            const key = `chat:${cm.id}`;
            if (!activeJobs.has(key)) {
              activeJobs.add(key);
              processChatMessage(cm);
            }
          }
        }
      }

      // stuck 복구 (5분 초과 processing)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: stuck } = await supabase
        .from('readings')
        .select('id')
        .eq('processing_status', 'processing')
        .lt('processing_started_at', fiveMinAgo)
        .limit(10);

      if (stuck?.length > 0) {
        log('warn', `Resetting ${stuck.length} stuck readings`);
        for (const s of stuck) {
          if (!activeJobs.has(s.id)) {
            await supabase.from('readings')
              .update({ processing_status: 'pending', processing_started_at: null })
              .eq('id', s.id);
          }
        }
      }
    } catch (err) {
      log('error', `Poll error: ${err.message}`);
    }

    await sleep(POLL_INTERVAL);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== 시작 =====
console.log(`
╔═══════════════════════════════════════════╗
║  🐕 사주독 워커                            ║
║  Poll: ${POLL_INTERVAL}ms | Concurrent: ${MAX_CONCURRENT}            ║
║  Retry: 무한 (지수 백오프, max 60s)        ║
║  ${new Date().toISOString()}          ║
╚═══════════════════════════════════════════╝
`);

setInterval(() => {
  log('info', `📊 active=${activeJobs.size}/${MAX_CONCURRENT} processed=${totalProcessed} failed=${totalFailed} cost=$${totalCostUsd.toFixed(4)}`);
}, 60_000);

process.on('SIGINT', () => {
  log('info', `🛑 Shutdown | processed=${totalProcessed} failed=${totalFailed} cost=$${totalCostUsd.toFixed(4)}`);
  process.exit(0);
});

// 시작 시 모든 processing → pending 리셋 (이전 실행에서 중단된 작업)
async function resetStuckOnStartup() {
  const { data } = await supabase
    .from('readings')
    .update({ processing_status: 'pending', processing_started_at: null })
    .eq('processing_status', 'processing')
    .select('id');
  if (data?.length > 0) {
    log('info', `🔄 Startup: reset ${data.length} stuck processing → pending`);
  }
}

resetStuckOnStartup().then(() => pollLoop());
