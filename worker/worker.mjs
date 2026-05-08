/**
 * saju-dog 워커 — EC2 상시 실행
 *
 * - pending reading을 감시하고 OpenAI/Claude API로 동시 처리
 * - 레이트리밋/서버 장애 시 무한 재시도 (지수 백오프)
 * - 실패 시 자동 환불
 * - 동시 처리 수 제한 (MAX_CONCURRENT)
 *
 * PM2: pm2 start ecosystem.config.cjs
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { z, toJSONSchema } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

// ===== 설정 =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI;
const OPENAI_ORG = process.env.OPENAI_ORG;
const OPENAI_PROJECT = process.env.OPENAI_PROJECT;
const AI_PROVIDER = (process.env.AI_PROVIDER || (OPENAI_KEY ? 'openai' : 'anthropic')).toLowerCase();
const OPENAI_RESPONSES_MODEL = process.env.OPENAI_RESPONSES_MODEL || 'gpt-5.5';
const OPENAI_IMAGE_PROMPT_MODEL = process.env.OPENAI_IMAGE_PROMPT_MODEL || 'gpt-5.5';
const OPENAI_IMAGE_GENERATION_MODEL = process.env.OPENAI_IMAGE_GENERATION_MODEL || 'gpt-image-2';
const OPENAI_REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || 'medium';
const OPENAI_WEB_SEARCH = process.env.OPENAI_WEB_SEARCH !== 'false';
const OPENAI_WEB_SEARCH_CONTEXT_SIZE = process.env.OPENAI_WEB_SEARCH_CONTEXT_SIZE || 'low';
const OPENAI_MAX_TOOL_CALLS = parseInt(process.env.OPENAI_MAX_TOOL_CALLS || '2');
const OPENAI_SERVICE_TIER = process.env.OPENAI_SERVICE_TIER;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '3000');
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '500');
const RETRY_BASE_DELAY = parseInt(process.env.RETRY_BASE_DELAY_MS || '5000');
const RETRY_MAX_DELAY = 60_000; // 최대 60초 대기

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY, timeout: 10 * 60 * 1000 }) : null; // 10분 타임아웃

// DB에서 서비스 비용 로드 (폴백용 하드코딩)
let CREDIT_COSTS = {
  comprehensive: 5, compatibility: 5, daeun: 4, yearly: 4,
  daily: 1, chat: 1, business: 5, luckyday: 4,
  love: 4, wealth: 4, health: 4, career: 4, pastlife: 4, moving: 4,
  mbti: 4, pet: 4, travel: 4, food: 4, color: 4,
  study: 4, ancestor: 4, child: 4, secret: 4, timing: 4,
};

async function loadServiceCosts() {
  try {
    const { data } = await supabase.from('service_costs').select('service_type, bones').eq('is_active', true);
    if (data) {
      const costs = {};
      for (const row of data) costs[row.service_type] = row.bones;
      CREDIT_COSTS = { ...CREDIT_COSTS, ...costs };
      log('info', `Service costs loaded from DB: ${Object.keys(costs).length} types`);
    }
  } catch (err) {
    log('warn', `Failed to load service costs from DB, using defaults: ${err.message}`);
  }
}

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

// ===== Claude API 호출 (SDK, 무한 재시도) =====
async function callClaudeParsed(params, zodSchema, requestOptions = {}) {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다');
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      const response = await anthropic.messages.parse({
        ...params,
        output_config: { format: zodOutputFormat(zodSchema) },
      }, requestOptions);
      return response;
    } catch (err) {
      // 레이트리밋 또는 서버 에러 → 재시도
      const status = err?.status || err?.error?.status;
      if (status === 429 || (status && status >= 500)) {
        const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, attempt - 1), RETRY_MAX_DELAY);
        log('warn', `API ${status}, attempt ${attempt}, retry in ${(delay / 1000).toFixed(0)}s`);
        await sleep(delay);
        continue;
      }

      // 네트워크 에러 → 재시도
      if (err.message?.includes('fetch') || err.message?.includes('ECONNREFUSED') || err.code === 'ENOTFOUND') {
        const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, attempt - 1), RETRY_MAX_DELAY);
        log('warn', `Network error (attempt ${attempt}): ${err.message}, retry in ${(delay / 1000).toFixed(0)}s`);
        await sleep(delay);
        continue;
      }

      throw err; // 4xx 등 재시도 불가 에러
    }
  }
}

// 채팅용 (Zod 없이 일반 호출)
async function callClaude(params) {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다');
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await anthropic.messages.create(params);
    } catch (err) {
      const status = err?.status;
      if (status === 429 || (status && status >= 500) || err.message?.includes('fetch')) {
        const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, attempt - 1), RETRY_MAX_DELAY);
        log('warn', `API ${status || 'network'}, attempt ${attempt}, retry in ${(delay / 1000).toFixed(0)}s`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

function isOpenAIModel(model = '') {
  return /^(gpt-|o\d|chatgpt-|computer-use)/.test(model);
}

function shouldUseOpenAIForText(config = {}) {
  if (AI_PROVIDER === 'openai') return true;
  if (AI_PROVIDER === 'anthropic' || AI_PROVIDER === 'claude') return false;
  return isOpenAIModel(config.model);
}

function getOpenAIModel() {
  return OPENAI_RESPONSES_MODEL;
}

function getOpenAIMaxOutputTokens(serviceType, configuredMaxTokens) {
  const configured = Number(configuredMaxTokens) || 0;
  const envOverride = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 0);
  if (envOverride > 0) return envOverride;
  if (serviceType === 'chat') return Math.max(configured, 2048);
  if (serviceType === 'daily') return Math.max(configured, 4096);
  return Math.max(configured, 24000);
}

function buildWebSearchTools() {
  if (!OPENAI_WEB_SEARCH) return [];
  return [{
    type: 'web_search',
    search_context_size: OPENAI_WEB_SEARCH_CONTEXT_SIZE,
    user_location: {
      type: 'approximate',
      country: 'KR',
      timezone: 'Asia/Seoul',
    },
  }];
}

function openAIHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${OPENAI_KEY}`,
  };
  if (OPENAI_ORG) headers['OpenAI-Organization'] = OPENAI_ORG;
  if (OPENAI_PROJECT) headers['OpenAI-Project'] = OPENAI_PROJECT;
  return headers;
}

function sanitizeJsonSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const rest = { ...schema };
  delete rest.$schema;
  return rest;
}

function getResponseText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  const chunks = [];
  for (const item of response?.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join('\n').trim();
}

function getOpenAIToolStats(response) {
  const output = response?.output || [];
  const webSearchCalls = output.filter(item => item.type === 'web_search_call').length;
  const imageGenerationCalls = output.filter(item => item.type === 'image_generation_call').length;
  return {
    web_search_calls: webSearchCalls,
    image_generation_calls: imageGenerationCalls,
  };
}

function getOpenAIStopReason(response) {
  if (response?.status === 'incomplete') {
    return response?.incomplete_details?.reason || 'incomplete';
  }
  if (response?.status === 'failed') return response?.error?.message || 'failed';
  return response?.status || 'completed';
}

async function callOpenAIResponse(body) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다');
  let attempt = 0;

  while (true) {
    attempt++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: openAIHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const err = new Error(data?.error?.message || `OpenAI API ${response.status}`);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      const status = err?.status;
      if (status === 429 || (status && status >= 500) || err.name === 'AbortError' || err.message?.includes('fetch')) {
        const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, attempt - 1), RETRY_MAX_DELAY);
        log('warn', `OpenAI API ${status || err.name || 'network'}, attempt ${attempt}, retry in ${(delay / 1000).toFixed(0)}s`);
        await sleep(delay);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function callOpenAIParsed(params, zodSchema, schemaName) {
  const jsonSchema = sanitizeJsonSchema(toJSONSchema(zodSchema));
  const response = await callOpenAIResponse({
    ...params,
    text: {
      verbosity: params.text?.verbosity || 'high',
      format: {
        type: 'json_schema',
        name: schemaName,
        strict: true,
        schema: jsonSchema,
      },
    },
  });

  const rawText = getResponseText(response);
  let parsedOutput = null;
  if (rawText) {
    parsedOutput = zodSchema.parse(JSON.parse(rawText));
  }

  return {
    ...response,
    parsed_output: parsedOutput,
    stop_reason: getOpenAIStopReason(response),
    tool_stats: getOpenAIToolStats(response),
  };
}

async function callOpenAIText(params) {
  const response = await callOpenAIResponse(params);
  return {
    ...response,
    output_text: getResponseText(response),
    stop_reason: getOpenAIStopReason(response),
    tool_stats: getOpenAIToolStats(response),
  };
}

function buildOpenAIBaseParams({ model, instructions, input, maxOutputTokens, metadata = {}, text }) {
  const tools = buildWebSearchTools();
  const body = {
    model,
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: OPENAI_REASONING_EFFORT },
    store: false,
    parallel_tool_calls: true,
    metadata,
  };
  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
    body.max_tool_calls = OPENAI_MAX_TOOL_CALLS;
  }
  if (text) body.text = text;
  if (OPENAI_SERVICE_TIER) body.service_tier = OPENAI_SERVICE_TIER;
  return body;
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
function buildLuckySection(data, p) {
  const ohaeng = data.ohaengCount || {};
  const STEM_ELEM = { '갑':'목','을':'목','병':'화','정':'화','무':'토','기':'토','경':'금','신':'금','임':'수','계':'수' };
  const dayStem = p.day.stem;
  const dayElement = STEM_ELEM[dayStem] || '토';
  const monthBranch = p.month.branch;

  // 1. 계절 득령 (월지 기준) — 상생 계절도 부분 가점
  const SEASON_STRONG = { '인':'목','묘':'목','진':'목', '사':'화','오':'화','미':'화', '신':'금','유':'금','술':'금', '해':'수','자':'수','축':'수' };
  const seasonElement = SEASON_STRONG[monthBranch] || '토';
  const GEN = { '목':'수','화':'목','토':'화','금':'토','수':'금' };
  const DRAIN = { '목':'화','화':'토','토':'금','금':'수','수':'목' };
  const CONTROL = { '목':'금','화':'수','토':'목','금':'화','수':'토' };

  let deukryeong = 0;
  if (seasonElement === dayElement) deukryeong = 2;        // 정득령
  else if (seasonElement === GEN[dayElement]) deukryeong = 1; // 상생 득령 (인성 계절)

  // 2. 지원 vs 견제 세력 (전통 명리 방식)
  const genElement = GEN[dayElement];     // 나를 생하는 오행 (인성)
  const drainElement = DRAIN[dayElement]; // 내가 생하는 오행 (식상)
  const controlMe = CONTROL[dayElement];  // 나를 극하는 오행 (관살)
  const controlBy = DRAIN[DRAIN[dayElement]]; // 내가 극하는 오행 (재성)

  const support = (Number(ohaeng[dayElement]) || 0) + (Number(ohaeng[genElement]) || 0) + deukryeong;
  const oppose = (Number(ohaeng[drainElement]) || 0) + (Number(ohaeng[controlBy]) || 0) + (Number(ohaeng[controlMe]) || 0);

  const ratio = support / (support + oppose || 1);
  const isDayStrong = ratio > 0.5;
  const strengthLabel = ratio >= 0.7 ? '극신강' : ratio > 0.5 ? '신강' : ratio > 0.3 ? '신약' : '극신약';

  // 3. 용신 — 과다한 오행 기반 선택 (단순 식상/인성 고정 X)
  let yongshin, heeshin, gishin;
  if (isDayStrong) {
    // 신강: 비겁이 과다하면 식상(설기), 인성이 과다하면 재성(극인)
    if ((Number(ohaeng[dayElement]) || 0) >= (Number(ohaeng[genElement]) || 0)) {
      yongshin = drainElement;  // 식상
      heeshin = controlBy;      // 재성
    } else {
      yongshin = controlBy;     // 재성
      heeshin = drainElement;   // 식상
    }
    gishin = genElement; // 인성 (더 강하게 만듦)
  } else {
    // 신약: 관살이 과다하면 인성(화살), 식상이 과다하면 비겁(보강)
    if ((Number(ohaeng[controlMe]) || 0) >= (Number(ohaeng[drainElement]) || 0)) {
      yongshin = genElement;    // 인성
      heeshin = dayElement;     // 비겁
    } else {
      yongshin = dayElement;    // 비겁
      heeshin = genElement;     // 인성
    }
    gishin = controlMe; // 관살 (더 약하게 만듦)
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
  if (sinsal.includes('현침살')) sinsalNotes.push('현침살 → 말/글/손끝이 예리한 기운, 일주·십신·오행으로 증폭/완화 판단');

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
- 일간: ${dayStem}(${dayElement}) / 강약: ${strengthLabel} (지원:${support} vs 견제:${oppose}, 득령:${deukryeong > 0 ? (deukryeong === 2 ? '정득령' : '상생득령') : 'X'})
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

function parseJsonMeta(value, fallback) {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

function cleanLabel(value) {
  return String(value || '').replace(/[(){}[\]"']/g, '').replace(/\s+/g, ' ').trim();
}

function getSummaryStyleGuide(serviceType) {
  if (serviceType === 'compatibility' || serviceType === 'business' || serviceType === 'chat') return '';

  return `## ★ summary 대표설명 규칙
- summary는 카드/상단에 보이는 대표 설명입니다. 억지로 짧은 표어처럼 만들지 말고, 사용자가 바로 읽고 "내 이야기네"라고 느낄 자연스러운 소개문으로 쓰세요.
- 한 문장 또는 짧은 두 절 정도로 충분합니다. 길이를 30자 안에 억지로 맞추지 마세요.
- 성향 또는 현재 흐름 + 부드러운 방향성을 담으세요. 예: "단단한 추진력이 방향을 잡으면 크게 움직이는 흐름", "큰 책임감이 쌓인 만큼 유연한 선택이 중요해지는 시기".
- 금지: "목/화/토/금/수", "용신/희신/기신", "신강/신약", "일간", "대운", "오행", "칼/물/불/나무/흙" 같은 기술어/보정재료를 summary에 쓰지 마세요.
- 금지: "~이 필요", "~가 부족", "~을 보완"처럼 처방 메모 같은 문장으로 끝내지 마세요.
- 오행 보정 이야기는 챕터 본문에서 쉽게 풀고, summary에는 사람의 성향과 방향만 남기세요.`;
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function getSummaryQualityIssue(summary, serviceType) {
  if (serviceType === 'compatibility' || serviceType === 'business' || serviceType === 'chat') return '';
  const text = stripTags(summary);
  if (!text) return 'summary가 비어 있음';
  if (text.length < 8) return 'summary가 너무 짧음';
  if (text.length > 120) return 'summary가 너무 김';
  if (/용신|희신|기신|신강|신약|일간|대운|세운|오행/.test(text)) return 'summary에 명리 기술어가 노출됨';
  if (/[목화토금수]\s*(이|가|을|를|에|으로|와|과)?\s*(필요|부족|과다|보완)/.test(text)) return 'summary가 오행 보정 메모처럼 보임';
  if (/(칼|물|불|나무|흙).*(필요|부족|보완|더해야|써야)/.test(text)) return 'summary가 재료 처방처럼 보임';
  if (/(필요|부족|보완)$/.test(text) || /필요/.test(text)) return 'summary가 처방문처럼 끝남';
  return '';
}

function fallbackSummaryFor(serviceType) {
  if (serviceType === 'daily') return '오늘은 흐름을 살피며 방향을 차분히 다듬기 좋은 날';
  return '단단한 추진력이 방향을 잡으면 크게 움직이는 흐름';
}

function getChapterStructureGuide(serviceType) {
  if (serviceType === 'daily' || serviceType === 'chat') return '';

  const isCompatibility = serviceType === 'compatibility' || serviceType === 'business';
  const labels = isCompatibility
    ? ['관계요약', '성향차이', '소통', '갈등', '생활궁합', '현실조언', '개운법']
    : serviceType === 'comprehensive'
      ? ['핵심', '일주', '신살연결', '오행', '재물/직업', '관계', '흐름', '개운법']
      : ['핵심', '사주근거', '타이밍', '주의점', '개운법'];
  const chapterCount = isCompatibility || serviceType === 'comprehensive' ? '6~8개' : '5~6개';

  return `## ★ 챕터 구조/분량 규칙
- 이전 프롬프트에 더 많은 챕터 수가 적혀 있어도 이 규칙을 우선하세요.
- 챕터는 ${chapterCount}만 작성하세요. 나열식으로 길게 늘리지 말고 핵심만 남기세요.
- 각 title은 반드시 "카테고리: 제목" 형식으로 쓰세요. 사용 가능한 카테고리: ${labels.join(', ')}.
- emoji는 장식일 뿐입니다. 사용자가 섹션 성격을 알 수 있도록 title의 카테고리를 더 중요하게 쓰세요.
- 각 content는 120~260자 정도로 압축하세요. 한 챕터에서 근거 1~2개와 결론 1개만 선명하게 쓰세요.
- 같은 근거를 여러 챕터에서 반복하지 마세요.`;
}

function getRelationalSajuGuide(serviceType) {
  if (serviceType === 'compatibility' || serviceType === 'business' || serviceType === 'daily' || serviceType === 'chat') return '';

  return `## ★ 사주 관계성 해석 규칙
- 사주 요소를 단순 나열하지 마세요. "무엇이 있다"가 아니라 "무엇이 무엇과 만나 어떻게 작동한다"를 설명하세요.
- 신살은 단독으로 풀이하지 마세요. 반드시 위치(년/월/일/시), 일주(일간+일지), 십신, 오행 균형, 대운/세운, 귀인/공망/충합형파해 중 2개 이상과 연결해 해석하세요.
- 예: 현침살은 "있다"로 끝내지 말고 어느 기둥에 있는지, 일간/식상/관성과 만나 말·글·손기술·비판성으로 살아나는지, 귀인이나 용신이 완화하는지까지 판단하세요.
- 일주는 최소 1개 챕터에서 반드시 다루세요. 일간의 기본 기질과 일지의 생활/관계 반응이 전체 사주를 어떻게 끌고 가는지 설명하세요.
- 상쇄/보완 관계를 반드시 넣으세요. 강한 기운이나 신살이 대운, 용신/희신, 귀인, 충합에 의해 증폭되는지 누그러지는지 구분하세요.
- 겁주는 표현보다 "이 기운을 이렇게 쓰면 장점이 된다"는 식으로 마무리하세요.`;
}

function inferProfileRole(profile) {
  const relation = cleanLabel(profile?.relation);
  if (!relation || relation === '본인' || relation === '기타') return '';
  if (relation === '부모') {
    if (profile.gender === 'male') return '아버지';
    if (profile.gender === 'female') return '어머니';
    return '부모';
  }
  if (relation === '자녀') {
    if (profile.gender === 'male') return '아들';
    if (profile.gender === 'female') return '딸';
    return '자녀';
  }
  return relation;
}

function inferRelationRole(relationType) {
  const relation = cleanLabel(relationType);
  if (!relation) return '';
  if (/부부|배우자/.test(relation)) return '배우자';
  if (/연인|커플/.test(relation)) return '연인';
  if (/친구/.test(relation)) return '친구';
  if (/동료/.test(relation)) return '동료';
  if (/선후배/.test(relation)) return '선후배 관계의 상대';
  if (/룸메이트/.test(relation)) return '룸메이트';
  if (/동업|사업/.test(relation)) return '동업자';
  if (/프로젝트|팀/.test(relation)) return '팀원';
  if (/가족/.test(relation)) return '가족';
  if (/상사|부하|직장/.test(relation)) return '직장 관계자';
  return '';
}

function buildCompatibilityDescriptors(participants, meta, relationType) {
  const roleRows = parseJsonMeta(meta.participantRoles, []);
  const roleByProfileId = new Map(
    (Array.isArray(roleRows) ? roleRows : [])
      .filter(row => row?.profileId)
      .map(row => [row.profileId, cleanLabel(row.role)]),
  );
  const fallbackRole = inferRelationRole(relationType);

  return participants.map((participant, index) => {
    const data = participant.calculated_saju || {};
    const name = cleanLabel(data.input?.name || participant.name || `참여자${index + 1}`);
    const explicitRole = roleByProfileId.get(participant.id) || '';
    const role = explicitRole || inferProfileRole(participant) || fallbackRole;
    const reference = `${name}님`;
    return { index: index + 1, name, role, reference };
  });
}

function buildCompatibilityVoiceGuide(descriptors, relationType) {
  const hasRoles = descriptors.some(d => d.role);
  const relation = cleanLabel(relationType) || '관계 미지정';
  const rows = descriptors
    .map(d => `- ${d.index}번 ${d.name}: ${d.role ? `관계상 역할 ${d.role}` : '명시된 역할 없음'}`)
    .join('\n');

  return `## ★ 관계 맥락표
관계 유형: ${relation}
${rows}

## ★ 관계 중심 풀이 규칙
- 위 정보는 호칭 강제가 아니라 해석의 맥락입니다. 본문 호칭은 기본적으로 "민수님", "준호님"처럼 자연스럽게 쓰세요.
- "배우자인 민수님은 배우자인 지현님은"처럼 모든 이름 앞에 역할을 반복하지 마세요.
- 역할이 부여된 경우 그 관계로 실제 궁합을 해석하세요. 예: 30세 아빠와 5세 아들이면 연애궁합이 아니라 부자지간의 정서, 양육, 독립, 애착, 대화 리듬을 보세요.
- 역할이 없다면 관계 유형에 맞춰 주제와 관점을 조절하세요.
- 가족/부모자녀 관계라면 연애·결혼 챕터를 만들지 말고, 정서적 거리, 대화 방식, 보호와 독립, 서로 서운해지는 지점을 중심으로 쓰세요.
- 동업/사업 관계라면 역할분담, 의사결정, 돈 얘기, 갈등 시 책임소재, 오래 가는 운영법을 중심으로 쓰세요.
- 친구/동료 관계라면 신뢰, 생활 리듬, 말투 차이, 서운함 회복법, 같이 성장하는 방식을 중심으로 쓰세요.
- 연인/부부 관계라면 끌림, 애정표현, 갈등 패턴, 생활궁합, 장기 안정성을 중심으로 쓰세요.
- 각 챕터는 사주 요소 나열보다 "두 사람이 실제 관계에서 어떻게 부딪히고 어떻게 풀면 좋은지"를 먼저 보여주세요.
- 최소 2개 챕터는 서로에게 바로 해볼 수 있는 말/행동 예시를 넣어주세요.
${hasRoles ? '- 역할명은 문맥상 필요할 때만 자연스럽게 쓰고, 매 문장마다 반복하지 마세요.' : ''}`;
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
    const participantDescriptors = buildCompatibilityDescriptors(allParticipants, meta, relationType);
    const relationshipGuide = buildCompatibilityVoiceGuide(participantDescriptors, relationType);
    const chapterStructureGuide = getChapterStructureGuide(reading.service_type);

    const relationContext = relationType
      ? `\n## 관계 유형: ${relationType}\n이 관계에 맞게 궁합을 풀어주세요. 역할이 있으면 그 역할 관계로 해석하고, 역할이 없으면 관계 유형에 맞춰 주제와 관점을 조절하세요.\n`
      : '\n## 관계 유형: 미지정\n관계가 명확하지 않으므로 연애/결혼으로 단정하지 말고, 서로의 상호작용과 대화 방식 중심으로 풀어주세요.\n';

    const participantBlocks = allParticipants.map((pp, i) => {
      const pd = pp.calculated_saju;
      const ppillars = pd.pillars;
      const ps = pd.sinsal || {};
      const pLucky = buildLuckySection(pd, ppillars);
      const descriptor = participantDescriptors[i];
      return `## ${i + 1}번째 참여자 (${descriptor?.reference || pd.input?.name || pp.name})
관계상 역할: ${descriptor?.role || '미지정'}
사주: ${ppillars.year.stem}${ppillars.year.branch} ${ppillars.month.stem}${ppillars.month.branch} ${ppillars.day.stem}${ppillars.day.branch} ${ppillars.hour.stem}${ppillars.hour.branch}
십신: ${ppillars.year.stemSipsin}/${ppillars.month.stemSipsin}/일주/${ppillars.hour.stemSipsin}
오행: 목${pd.ohaengCount?.['목']} 화${pd.ohaengCount?.['화']} 토${pd.ohaengCount?.['토']} 금${pd.ohaengCount?.['금']} 수${pd.ohaengCount?.['수']}
띠: ${pd.ddi?.fullName || '?'} / 별자리: ${pd.zodiac?.name || '?'}
신살: ${fmtArr(ps.allSinsal)}
귀인: ${fmtArr(ps.guiin)}
기둥관계: 년${fmtArr(ps.pillarRelations?.year)} / 월${fmtArr(ps.pillarRelations?.month)} / 일${fmtArr(ps.pillarRelations?.day)} / 시${fmtArr(ps.pillarRelations?.hour)}
공망: ${fmtArr(ps.gongmang)}
${pLucky}`;
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

    return `${relationContext}
${relationshipGuide}

${participantBlocks}

[중요] 이 궁합에는 총 ${totalCount}명이 참여합니다. 반드시 ${totalCount}명 전원의 관계를 분석하세요.
각 챕터에서는 참여자의 관계 맥락을 반영해 서로 간의 상호작용을 비교 분석해야 합니다.
2명만 분석하고 나머지를 빠뜨리면 실패 처리됩니다.
${chapterStructureGuide ? `\n${chapterStructureGuide}` : ''}

[서식 규칙]
- 각 챕터의 "emoji" 필드에 반드시 이모지 1개를 넣으세요. "title"에는 이모지를 넣지 마세요.
- **절대 마크다운 문법을 사용하지 마세요** (**, ##, *, _ 등 금지). 강조는 반드시 <strong>태그만 사용하세요.
- 말투는 친근한 존댓말로, 살짝 재밌되 품위 있게 쓰세요. 비속어, 조롱, 과한 유행어는 금지입니다.
${questionBlock}
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
    daily: '오늘의 운세를 오늘 일진(천간지지) 데이터 기반으로 분석해주세요. 오늘 일진과 사주 일간의 오행 관계(비겁/식상/재성/관성/인성)가 핵심입니다. 어제/내일과 다른 오늘만의 포인트를 찾아주세요.',
    mbti: '사주 오행/십신 조합으로 MBTI 16유형 중 가장 가까운 유형을 매칭하고 각 축(E/I, S/N, T/F, J/P)의 비율을 사주 근거로 분석해주세요.',
    pet: '사주 오행과 성격 분석으로 나와 가장 잘 맞는 반려동물 종류와 구체적 품종을 추천해주세요.',
    travel: '용신 방위 기반으로 올해 최고의 여행 방위와 시기, 여행 스타일을 분석해주세요.',
    food: '오행별 음식 매핑(목=채소, 화=매운맛, 토=단맛, 금=자극, 수=짠맛)으로 행운 음식과 식복을 분석해주세요.',
    color: '오행별 컬러 매핑(목=초록, 화=빨강, 토=노랑, 금=흰색, 수=검정)으로 퍼스널컬러와 행운 컬러를 분석해주세요.',
    study: '인성/식상으로 학습 스타일, 관성/재성으로 합격 타이밍, 대운에서 합격 최적기를 분석해주세요.',
    ancestor: '년주로 조상 기운, 월주로 부모 기운, 귀인으로 음덕을 분석해주세요. 가문의 에너지와 물려받은 재능.',
    child: '시주로 자녀 기운, 식상으로 자녀 수와 특성을 분석해주세요. 자녀와의 궁합, 최적 출산 시기, 양육 방향.',
    secret: '지장간 여기/중기의 숨은 십신으로 잠재 재능을 파악하고, 공망 위치로 막힌 재능, 대운에서 발현 시기를 분석해주세요.',
    timing: '대운/세운에서 결혼/이직/창업/부동산 등 인생 주요 결정의 황금 타이밍을 종합 분석해주세요. 용신 시기=황금기, 기신 시기=보류기.',
  };
  const serviceInstruction = SERVICE_INSTRUCTIONS[reading.service_type] || SERVICE_INSTRUCTIONS.comprehensive;
  const summaryStyleGuide = getSummaryStyleGuide(reading.service_type);
  const chapterStructureGuide = getChapterStructureGuide(reading.service_type);
  const relationalSajuGuide = getRelationalSajuGuide(reading.service_type);

  // ===== 고도화된 용신 분석 + 개인화 추천 (결정적) =====
  const luckySection = buildLuckySection(data, p);

  const today = new Date();
  const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  // 오늘 일진(천간지지) 계산 — 1900년 1월 1일 = 경자일 기준
  const STEMS = ['갑','을','병','정','무','기','경','신','임','계'];
  const BRANCHES = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
  const STEM_OHAENG = { '갑':'목','을':'목','병':'화','정':'화','무':'토','기':'토','경':'금','신':'금','임':'수','계':'수' };
  const baseDate = new Date(1900, 0, 1);
  const diffDays = Math.floor((today - baseDate) / 86400000);
  const baseStemIdx = 6; // 경=6
  const baseBranchIdx = 0; // 자=0
  const todayStemIdx = (baseStemIdx + diffDays) % 10;
  const todayBranchIdx = (baseBranchIdx + diffDays) % 12;
  const todayStem = STEMS[todayStemIdx];
  const todayBranch = BRANCHES[todayBranchIdx];
  const todayOhaeng = STEM_OHAENG[todayStem];
  const dayGanji = `${todayStem}${todayBranch}`;

  // 오늘 일진과 사주 일간의 관계 분석
  const dayStemOhaeng = STEM_OHAENG[p.day.stem] || '';
  const OHAENG_RELATION = {
    '목': { '목':'비겁', '화':'식상', '토':'재성', '금':'관성', '수':'인성' },
    '화': { '목':'인성', '화':'비겁', '토':'식상', '금':'재성', '수':'관성' },
    '토': { '목':'관성', '화':'인성', '토':'비겁', '금':'식상', '수':'재성' },
    '금': { '목':'재성', '화':'관성', '토':'인성', '금':'비겁', '수':'식상' },
    '수': { '목':'식상', '화':'재성', '토':'관성', '금':'인성', '수':'비겁' },
  };
  const dayRelation = OHAENG_RELATION[dayStemOhaeng]?.[todayOhaeng] || '';
  const todayDayInfo = `오늘 일진: ${dayGanji}일 (${todayOhaeng}) | 일간(${p.day.stem}/${dayStemOhaeng})과의 관계: ${dayRelation}`;

  return `[분석 유형: ${reading.service_type}]
[오늘 날짜: ${todayStr}]
[${todayDayInfo}]
아래는 서버에서 정밀 계산된 사주 데이터입니다. 이 데이터만 기반으로 해설하세요.
"올해"는 반드시 ${today.getFullYear()}년을 의미합니다. 작년(${today.getFullYear() - 1})이나 내년(${today.getFullYear() + 1}) 이야기를 올해로 혼동하지 마세요.
${luckySection}
## 기본 정보
- 이름: ${data.input?.name || profile.name} / 성별: ${data.input?.gender === 'male' ? '남성' : '여성'}
- 결혼여부: ${profile.marital_status === 'married' ? '기혼' : '미혼'}
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

## 대운 (★현재 표시된 대운이 현재 대운입니다. 나이 범위와 현재 대운을 반드시 아래 데이터 그대로 사용하세요. 절대 직접 계산하거나 수정하지 마세요.)
${data.daeun?.map(d => `- ${d.startAge}~${d.endAge}세: ${d.stem}${d.branch} [${d.stemSipsin}/${d.branchSipsin}]${d.isCurrent ? ' ★현재 대운' : ''}`).join('\n') || '없음'}

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
${summaryStyleGuide ? `\n${summaryStyleGuide}` : ''}
${chapterStructureGuide ? `\n${chapterStructureGuide}` : ''}
${relationalSajuGuide ? `\n${relationalSajuGuide}` : ''}

[서식 규칙]
- 각 챕터의 "emoji" 필드에 반드시 이모지 1개를 넣으세요. "title"에는 이모지를 넣지 마세요.
- **절대 마크다운 문법을 사용하지 마세요** (**, ##, *, _ 등 금지). 강조는 반드시 <strong>태그만 사용하세요.

위 사주 데이터를 기반으로, 이 분석 유형(${reading.service_type})에 맞는 풀이를 JSON으로 작성하세요.
종합 사주풀이처럼 일반적인 분석을 하지 말고, 반드시 요청된 분석 유형에 집중하세요.`;
}

// ===== Zod 스키마 (Anthropic SDK zodOutputFormat) =====

const ChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  emoji: z.string(),
  content: z.string(),
});

const ReadingSchema = z.object({
  summary: z.string().describe('상단 카드용 대표 설명. 기술어/오행 보정 메모가 아니라 성향과 방향을 담은 자연스러운 한국어 소개문. 예: 단단한 추진력이 방향을 잡으면 크게 움직이는 흐름'),
  chapters: z.array(ChapterSchema),
  advice: z.array(z.string()),
  luckyItems: z.object({
    color: z.string(),
    number: z.string(),
    direction: z.string(),
    food: z.string(),
  }),
});

const CategorySchema = z.object({
  score: z.number(),
  message: z.string(),
});

const CompatibilitySchema = z.object({
  summary: z.string(),
  overallScore: z.number(),
  chapters: z.array(ChapterSchema),
  advice: z.array(z.string()),
});

const DailySchema = z.object({
  summary: z.string().describe('오늘 흐름을 자연스럽게 소개하는 상단 카드용 대표 설명'),
  overallLuck: z.number(),
  categories: z.object({
    love: CategorySchema,
    money: CategorySchema,
    work: CategorySchema,
    health: CategorySchema,
  }),
  advice: z.string(),
  luckyItems: z.object({
    color: z.string(),
    number: z.string(),
    food: z.string(),
  }),
});

function getZodSchema(serviceType) {
  if (serviceType === 'compatibility' || serviceType === 'business') return CompatibilitySchema;
  if (serviceType === 'daily') return DailySchema;
  return ReadingSchema;
}

// ===== 비용 계산 =====
function getModelRates(m) {
  if (m.includes('gpt-5.5-pro') || m.includes('gpt-5.4-pro')) return { i: 30.0, c: 0, o: 180.0 };
  if (m.includes('gpt-5.5')) return { i: 5.0, c: 0.5, o: 30.0 };
  if (m.includes('gpt-5.4-mini')) return { i: 0.75, c: 0.075, o: 4.5 };
  if (m.includes('gpt-5.4-nano')) return { i: 0.2, c: 0.02, o: 1.25 };
  if (m.includes('gpt-5.4')) return { i: 2.5, c: 0.25, o: 15.0 };
  if (m.includes('gpt-5.2')) return { i: 1.75, c: 0.175, o: 14.0 };
  if (m.includes('gpt-5-mini')) return { i: 0.25, c: 0.025, o: 2.0 };
  if (m.includes('gpt-5-nano')) return { i: 0.05, c: 0.005, o: 0.4 };
  if (m.includes('gpt-5')) return { i: 1.25, c: 0.125, o: 10.0 };
  if (m.includes('opus')) return { i: 15.0, o: 75.0 };
  if (m.includes('haiku')) return { i: 0.25, o: 1.25 };
  return { i: 3.0, o: 15.0 }; // sonnet
}

function calculateCost(model, usage, extras = {}) {
  const inp = usage.input_tokens || 0;
  const out = usage.output_tokens || 0;
  const openAICache = usage.input_tokens_details?.cached_tokens || 0;
  const cacheR = usage.cache_read_input_tokens || openAICache;
  const cacheC = usage.cache_creation_input_tokens || 0;
  const reasoningTokens = usage.output_tokens_details?.reasoning_tokens || 0;

  const { i: iRate, o: oRate } = getModelRates(model);
  const cachedRate = getModelRates(model).c;
  const isOpenAI = isOpenAIModel(model);
  let cost;

  if (isOpenAI) {
    cost = ((inp - cacheR) * iRate + cacheR * (cachedRate ?? iRate * 0.1) + out * oRate) / 1e6;
    cost += (extras.web_search_calls || 0) * 0.01; // $10 / 1k calls
  } else {
    cost = ((inp - cacheR) * iRate + cacheR * iRate * 0.1 + cacheC * iRate * 1.25 + out * oRate) / 1e6;
  }

  // Advisor iterations 비용 추가
  let advisorInput = 0, advisorOutput = 0;
  if (!isOpenAI && usage.iterations) {
    for (const iter of usage.iterations) {
      if (iter.type === 'advisor_message') {
        const aInp = iter.input_tokens || 0;
        const aOut = iter.output_tokens || 0;
        const aCacheR = iter.cache_read_input_tokens || 0;
        const aCacheC = iter.cache_creation_input_tokens || 0;
        const { i: aI, o: aO } = getModelRates(iter.model || '');
        cost += ((aInp - aCacheR) * aI + aCacheR * aI * 0.1 + aCacheC * aI * 1.25 + aOut * aO) / 1e6;
        advisorInput += aInp;
        advisorOutput += aOut;
      }
    }
  }

  const result = {
    provider: isOpenAI ? 'openai' : 'anthropic',
    model,
    input_tokens: inp,
    output_tokens: out,
    cache_read_tokens: cacheR,
    cache_creation_tokens: cacheC,
    reasoning_tokens: reasoningTokens,
    web_search_calls: extras.web_search_calls || 0,
    image_generation_calls: extras.image_generation_calls || 0,
    cost_usd: Math.round(cost * 1000000) / 1000000,
  };
  if (advisorInput > 0) {
    result.advisor_input_tokens = advisorInput;
    result.advisor_output_tokens = advisorOutput;
  }
  return result;
}

function getImageModelRates(m) {
  if (m.includes('gpt-image-1-mini')) return { i: 2.0, c: 0.2, o: 8.0 };
  if (m.includes('gpt-image-2')) return { i: 5.0, c: 1.25, o: 30.0 };
  return { i: 5.0, c: 1.25, o: 32.0 }; // gpt-image-1.5 fallback
}

function calculateImageGenerationCost(promptModel, imageModel, usage, extras = {}) {
  const inp = usage.input_tokens || 0;
  const out = usage.output_tokens || 0;
  const cacheR = usage.input_tokens_details?.cached_tokens || 0;
  const reasoningTokens = usage.output_tokens_details?.reasoning_tokens || 0;
  const rates = getImageModelRates(imageModel);
  let cost = ((inp - cacheR) * rates.i + cacheR * rates.c + out * rates.o) / 1e6;
  cost += (extras.web_search_calls || 0) * 0.01;

  return {
    provider: 'openai',
    model: promptModel,
    image_model: imageModel,
    input_tokens: inp,
    output_tokens: out,
    cache_read_tokens: cacheR,
    reasoning_tokens: reasoningTokens,
    web_search_calls: extras.web_search_calls || 0,
    image_generation_calls: extras.image_generation_calls || 0,
    cost_usd: Math.round(cost * 1000000) / 1000000,
  };
}

function withOpenAIGenerationRules(systemPrompt, serviceType) {
  const summaryStyleGuide = getSummaryStyleGuide(serviceType);
  return `${systemPrompt}

## OpenAI Responses API 생성 규칙
- 제공된 만세력/신살/오행/대운 데이터가 최우선입니다. 사주 계산을 새로 하지 마세요.
- web_search는 사용자의 질문이 최신 공개 정보, 현재 연도 정책/가격/장소/뉴스처럼 외부 사실을 요구할 때만 사용하세요. 사주 데이터 해석만으로 충분하면 검색하지 마세요.
- web_search를 사용했다면 관련 본문에 출처 제목 또는 URL을 짧게 포함하세요. 출처가 없으면 최신 외부 사실이라고 단정하지 마세요.
- 오늘/올해/내년 같은 상대 날짜는 입력에 제공된 날짜와 연도를 기준으로 절대 날짜/연도로 일관되게 해석하세요.
- 응답은 반드시 요청된 JSON 스키마와 일치해야 합니다. JSON 밖 설명, 코드블록, 마크다운을 출력하지 마세요.
- 모든 사용자-facing 문장은 한국어 존댓말로 쓰고, 불안감을 키우는 단정 대신 실행 가능한 조언으로 마무리하세요.
- 말투는 "따뜻한 상담사 + 재치 있는 멍도령" 느낌입니다. 너무 보고서처럼 딱딱하게 쓰지 말고, 자연스러운 구어체와 비유를 섞으세요.
- 한 챕터에 한두 번 정도만 가벼운 농담이나 생활 비유를 넣으세요. 비속어, 조롱, 저렴한 표현, 과한 밈 말투는 금지입니다.
- 제목은 짧고 생동감 있게 쓰되 자극적인 반말이나 공격적인 표현은 피하세요.
- 조언은 "해야 합니다"만 반복하지 말고 "~해보세요", "~가 훨씬 편해져요", "~로 바꿔보면 좋아요"처럼 부드럽게 권하세요.
${summaryStyleGuide ? `\n${summaryStyleGuide}` : ''}

[분석 유형] ${serviceType}`;
}

function buildChatInput(history, latestMessage) {
  const transcript = (history || [])
    .slice(-20)
    .map(h => `${h.role === 'assistant' ? '멍도령' : '사용자'}: ${String(h.content || '').replace(/\s+/g, ' ').trim()}`)
    .join('\n');

  return `${transcript ? `이전 대화:\n${transcript}\n\n` : ''}사용자 최신 메시지:
${latestMessage}`;
}

// ===== OG 이미지 생성 (OpenAI 우선, Gemini 레거시 폴백) =====
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GEMINI_KEY}`;

async function uploadOgImage(readingId, imageBuffer) {
  const filePath = `${readingId}.png`;
  const { error: uploadError } = await supabase.storage
    .from('og-images')
    .upload(filePath, imageBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadError) {
    log('warn', `[${readingId.slice(0, 8)}] OG upload failed: ${uploadError.message}`);
    return null;
  }

  const { data: urlData } = supabase.storage.from('og-images').getPublicUrl(filePath);
  const ogUrl = urlData.publicUrl;
  await supabase.from('readings').update({ og_image_url: ogUrl }).eq('id', readingId);
  return ogUrl;
}

async function generateOgImage(readingId, serviceType, summary, chapters, profileData, allProfiles = []) {
  const canUseOpenAIImage = AI_PROVIDER !== 'anthropic' && AI_PROVIDER !== 'claude' && !!OPENAI_KEY;
  const canUseGeminiFallback = AI_PROVIDER !== 'openai' && !!GEMINI_KEY;

  if (!canUseOpenAIImage && !canUseGeminiFallback) {
    log('warn', `[${readingId.slice(0, 8)}] OG image skipped: no image API key`);
    return null;
  }

  try {
    // 풀이 결과에서 핵심 내용 추출
    const plainSummary = (summary || '').replace(/<[^>]*>/g, '').slice(0, 200);
    const chapterSnippets = Array.isArray(chapters)
      ? chapters.slice(0, 3).map(ch => ch.content?.replace(/<[^>]*>/g, '').slice(0, 100)).join(' ')
      : '';
    const readingContext = `${plainSummary} ${chapterSnippets}`.slice(0, 400);

    // 띠/별자리 정보 추출 (궁합: 모든 참여자)
    const profileList = allProfiles.length > 0 ? allProfiles : [profileData].filter(Boolean);
    const profileSignals = profileList.map(p => {
      const saju = p?.calculated_saju;
      const name = p?.name || saju?.input?.name || '';
      const ddi = saju?.ddi?.fullName || saju?.ddi?.animal || '';
      const zodiac = saju?.zodiac?.name || '';
      return [name, ddi, zodiac].filter(Boolean).join(' ');
    }).filter(Boolean).join(' / ');
    const visualContext = readingContext || `Service: ${serviceType}. Profile symbols: ${profileSignals}`;

    // 궁합 여부에 따라 다른 프롬프트
    const isCompat = ['compatibility', 'business'].includes(serviceType);
    const personCount = profileList.length;

    let prompt;
    if (isCompat && personCount >= 2) {
      // 궁합: 띠 동물들이 상호작용하는 장면
      const animals = profileList.map(p => p?.calculated_saju?.ddi?.animal || '강아지').join(' and ');
      prompt = `Draw a wide 16-bit pixel art share-card illustration. ${personCount} cute pixel art animals (${animals}) interact in a scene that reflects their relationship energy. Use this context only as mood guidance: "${visualContext.slice(0, 240)}". Make every animal distinct through pose, expression, accessories, and spacing. Cozy detailed background, warm balanced palette, thick black outlines, visible pixel grid. No text, no letters, no words, no numbers, no signs, no speech bubbles.`;
    } else {
      // 개인 풀이: 띠 동물이 이 사람의 성격/분위기를 표현
      const animal = profileData?.calculated_saju?.ddi?.animal || '강아지';
      const zodiacSign = profileData?.calculated_saju?.zodiac?.name || '';
      prompt = `Draw a wide 16-bit pixel art share-card illustration. A cute pixel art ${animal} character embodies this person's personality and current life energy. Use this context only as mood guidance: "${visualContext.slice(0, 280)}". Show the ${animal}'s personality through pose, expression, accessories, and surrounding objects.${zodiacSign ? ` Subtly incorporate ${zodiacSign} constellation motifs as tiny stars, not text.` : ''} Rich detailed pixel art environment, warm balanced palette, thick black outlines, visible pixel grid. No text, no letters, no words, no numbers, no signs, no speech bubbles.`;
    }

    if (canUseOpenAIImage) {
      const response = await callOpenAIResponse({
        model: OPENAI_IMAGE_PROMPT_MODEL,
        instructions: 'Generate exactly one production-ready OG/share image. Follow the prompt literally, especially the no-text requirement. Do not answer with prose.',
        input: prompt,
        reasoning: { effort: OPENAI_REASONING_EFFORT },
        tools: [{
          type: 'image_generation',
          model: OPENAI_IMAGE_GENERATION_MODEL,
          action: 'generate',
          size: '1536x1024',
          quality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
          output_format: 'png',
          background: 'opaque',
        }],
        tool_choice: { type: 'image_generation' },
        max_tool_calls: 1,
        max_output_tokens: 2048,
        store: false,
        metadata: { reading_id: readingId, service_type: serviceType, purpose: 'og_image' },
      });

      const imageCall = (response.output || []).find(item => item.type === 'image_generation_call' && item.result);
      if (!imageCall) {
        const errMsg = response?.error?.message || response?.status || 'no image_generation_call result';
        log('warn', `[${readingId.slice(0, 8)}] OpenAI image no result: ${errMsg}`);
        return null;
      }

      const imageBuffer = Buffer.from(imageCall.result, 'base64');
      const ogUrl = await uploadOgImage(readingId, imageBuffer);
      if (!ogUrl) return null;

      const toolStats = getOpenAIToolStats(response);
      const cost = calculateImageGenerationCost(OPENAI_IMAGE_PROMPT_MODEL, OPENAI_IMAGE_GENERATION_MODEL, response.usage || {}, toolStats);
      log('info', `[${readingId.slice(0, 8)}] OG image(OpenAI): ${(imageBuffer.length / 1024).toFixed(0)}KB | ${cost.input_tokens}→${cost.output_tokens} tok | $${cost.cost_usd}`);

      return {
        provider: 'openai',
        url: ogUrl,
        size_bytes: imageBuffer.length,
        openai_og_cost_usd: cost.cost_usd,
        openai_input_tokens: cost.input_tokens,
        openai_output_tokens: cost.output_tokens,
        openai_reasoning_tokens: cost.reasoning_tokens,
        image_prompt_model: OPENAI_IMAGE_PROMPT_MODEL,
        image_generation_model: OPENAI_IMAGE_GENERATION_MODEL,
        revised_prompt: imageCall.revised_prompt || null,
      };
    }

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['image', 'text'],
        },
      }),
    });

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (!imagePart) {
      const errMsg = data?.error?.message || data?.candidates?.[0]?.finishReason || 'unknown';
      const textPart = parts.find(p => p.text);
      log('warn', `[${readingId.slice(0, 8)}] Gemini no image: ${errMsg}${textPart ? ` | text: ${textPart.text.slice(0, 100)}` : ''}`);
      return null;
    }

    // Gemini 비용 정밀 계산 (usageMetadata 기반)
    // gemini-3.1-flash-image: input $0.50/1M, output(image) $60.00/1M
    const usage = data?.usageMetadata || {};
    const inputTokens = usage.promptTokenCount || 0;
    const outputTokens = usage.candidatesTokenCount || 0;
    const inputCost = (inputTokens * 0.50) / 1_000_000;
    const outputCost = (outputTokens * 60.0) / 1_000_000;
    const geminiCost = Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6자리 정밀도

    // Supabase Storage에 업로드
    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const ogUrl = await uploadOgImage(readingId, imageBuffer);
    if (!ogUrl) return null;

    log('info', `[${readingId.slice(0, 8)}] OG image: ${(imageBuffer.length / 1024).toFixed(0)}KB | tokens ${inputTokens}→${outputTokens} | $${geminiCost}`);
    return {
      provider: 'gemini',
      url: ogUrl,
      size_bytes: imageBuffer.length,
      gemini_cost_usd: geminiCost,
      gemini_input_tokens: inputTokens,
      gemini_output_tokens: outputTokens,
    };
  } catch (err) {
    log('warn', `[${readingId.slice(0, 8)}] OG image error: ${err.message}`);
    return null;
  }
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

    // 채팅용 용신 요약 (JSON 출력 유발하는 luckySection 대신 핵심만)
    const STEM_ELEM = { '갑':'목','을':'목','병':'화','정':'화','무':'토','기':'토','경':'금','신':'금','임':'수','계':'수' };
    const chatDayEl = STEM_ELEM[p.day.stem] || '토';
    const DIR_MAP = { '목':'동쪽','화':'남쪽','토':'중앙','금':'서쪽','수':'북쪽' };
    const GEN_MAP = { '목':'수','화':'목','토':'화','금':'토','수':'금' };
    const DRAIN_MAP = { '목':'화','화':'토','토':'금','금':'수','수':'목' };
    const CTRL_MAP = { '목':'금','화':'수','토':'목','금':'화','수':'토' };
    const chatGenEl = GEN_MAP[chatDayEl];
    const chatDrainEl = DRAIN_MAP[chatDayEl];
    const chatCtrlMe = CTRL_MAP[chatDayEl];
    const chatSupport = (Number(data.ohaengCount?.[chatDayEl]) || 0) + (Number(data.ohaengCount?.[chatGenEl]) || 0);
    const chatOppose = (Number(data.ohaengCount?.[chatDrainEl]) || 0) + (Number(data.ohaengCount?.[DRAIN_MAP[DRAIN_MAP[chatDayEl]]]) || 0) + (Number(data.ohaengCount?.[chatCtrlMe]) || 0);
    const chatStrong = chatSupport > chatOppose;
    const chatYong = chatStrong
      ? ((Number(data.ohaengCount?.[chatDayEl])||0) >= (Number(data.ohaengCount?.[chatGenEl])||0) ? chatDrainEl : DRAIN_MAP[DRAIN_MAP[chatDayEl]])
      : ((Number(data.ohaengCount?.[chatCtrlMe])||0) >= (Number(data.ohaengCount?.[chatDrainEl])||0) ? chatGenEl : chatDayEl);
    const chatGishin = chatStrong ? chatGenEl : chatCtrlMe;

    const sajuContext = `사주 정보 (${data.input?.name || profile.name}, ${data.input?.gender === 'male' ? '남' : '여'}):
사주: ${p.year.stem}${p.year.branch} ${p.month.stem}${p.month.branch} ${p.day.stem}${p.day.branch} ${p.hour.stem}${p.hour.branch}
일간: ${p.day.stem}(${chatDayEl}) / ${chatStrong ? '신강' : '신약'}
십신: ${p.year.stemSipsin}/${p.month.stemSipsin}/일주/${p.hour.stemSipsin}
오행: 목${data.ohaengCount?.['목']} 화${data.ohaengCount?.['화']} 토${data.ohaengCount?.['토']} 금${data.ohaengCount?.['금']} 수${data.ohaengCount?.['수']}
용신: ${chatYong}(${DIR_MAP[chatYong]}) / 기신: ${chatGishin}(${DIR_MAP[chatGishin]})
띠: ${data.ddi?.fullName || '?'} / 별자리: ${data.zodiac?.name || '?'}
신살: ${fmtArr(s.allSinsal)}
귀인: ${fmtArr(s.guiin)}
공망: ${fmtArr(s.gongmang)}
현재 대운: ${data.daeun?.find(d => d.isCurrent)?.stem || '?'}${data.daeun?.find(d => d.isCurrent)?.branch || '?'}`;

    const systemPrompt = `당신은 '멍도령'이라는 이름의 사주 상담 골든 리트리버입니다.
사용자의 사주 데이터를 기반으로 친근하고 따뜻하게 상담합니다.

${sajuContext}

규칙:
- 한국어로 답변하세요
- 반말이 아닌 존댓말을 사용하세요
- 사주 데이터를 근거로 구체적으로 답변하세요
- 방위 추천 시 용신 방위(${DIR_MAP[chatYong]})를 기준으로 하세요
- 딱딱한 한문 용어 대신 쉬운 말로 설명하세요
- 가끔 강아지 이모지(🐾🐕)를 섞어 친근감을 주세요
- 답변은 300자 이내로 간결하게 하세요
- <strong>태그로 핵심 키워드를 강조하세요
- 절대 마크다운(**, ##, *, _)을 사용하지 마세요
- 절대 JSON, 코드블록(\`\`\`), 데이터 구조를 출력하지 마세요. 자연스러운 대화체로만 답변하세요
- 최신 공개 정보가 필요한 질문(현재 가격, 장소, 뉴스, 정책 등)에만 web_search를 사용하세요
- web_search를 사용했다면 답변 끝에 출처 제목 또는 URL을 아주 짧게 붙이세요`;

    const messages = [
      ...(history || []).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: msg.content },
    ];

    let reply;
    let cost;

    if (shouldUseOpenAIForText({ model: OPENAI_RESPONSES_MODEL })) {
      const model = getOpenAIModel();
      const apiResponse = await callOpenAIText(buildOpenAIBaseParams({
        serviceType: 'chat',
        model,
        instructions: systemPrompt,
        input: buildChatInput(history, msg.content),
        maxOutputTokens: getOpenAIMaxOutputTokens('chat', 1500),
        metadata: { chat_message_id: msg.id, session_id: msg.session_id, service_type: 'chat' },
        text: { verbosity: 'low' },
      }));

      reply = (apiResponse.output_text || '').trim();
      cost = calculateCost(model, apiResponse.usage || {}, apiResponse.tool_stats || {});
    } else {
      const apiResponse = await callClaude({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      reply = apiResponse.content.filter(b => b.type === 'text').map(b => b.text).join('');
      cost = calculateCost('sonnet', apiResponse.usage || {});
    }

    if (!reply) throw new Error('AI 응답이 비어 있습니다');

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

    // SDK + Zod 기반 Structured Outputs
    const zodSchema = getZodSchema(reading.service_type);
    const provider = shouldUseOpenAIForText(config) ? 'openai' : 'anthropic';
    const actualModel = provider === 'openai' ? getOpenAIModel() : config.model;

    let baseParams;
    let requestOptions = {};

    if (provider === 'openai') {
      baseParams = buildOpenAIBaseParams({
        serviceType: reading.service_type,
        model: actualModel,
        instructions: withOpenAIGenerationRules(config.system_prompt, reading.service_type),
        input: userMessage,
        maxOutputTokens: getOpenAIMaxOutputTokens(reading.service_type, config.max_tokens),
        metadata: { reading_id: reading.id, service_type: reading.service_type, prompt_config_id: config.id },
      });
      log('info', `[${rid}] OpenAI Responses enabled: ${actualModel} (${OPENAI_REASONING_EFFORT})`);
    } else {
      baseParams = {
        model: actualModel,
        max_tokens: config.max_tokens,
        messages: [{ role: 'user', content: userMessage }],
        system: config.use_prompt_caching
          ? [{ type: 'text', text: config.system_prompt, cache_control: { type: 'ephemeral' } }]
          : config.system_prompt,
      };
      if (config.temperature !== null) baseParams.temperature = config.temperature;

      // Advisor Tool 설정
      if (config.use_advisor && config.advisor_model) {
        baseParams.tools = [
          { type: 'advisor_20260301', name: 'advisor', model: config.advisor_model }
        ];
        requestOptions.headers = { 'anthropic-beta': 'advisor-tool-2026-03-01' };
        log('info', `[${rid}] Advisor enabled: ${actualModel} + ${config.advisor_model}`);
      }
    }

    // OG 이미지는 프로필/띠 정보를 기반으로 텍스트 풀이와 병렬 생성한다.
    // 결과 해설 뒤에 순차 생성하던 시간을 줄이되, completed 전에는 완료를 기다린다.
    const allOgProfiles = [profile, secondaryProfile, ...extraProfiles].filter(Boolean);
    const ogPromise = generateOgImage(reading.id, reading.service_type, null, null, profile, allOgProfiles)
      .catch((ogErr) => {
        log('warn', `[${rid}] OG image failed (non-blocking): ${ogErr.message}`);
        return null;
      });

    // 품질 검증 포함 재시도 루프: 최초 1회 + 재시도 1회까지만 허용한다.
    const MAX_QUALITY_RETRIES = 2;
    let parsed = null;
    let apiCost = null;
    let totalApiCost = 0;
    let lastChapterCount = 0;
    let lastTruncatedCount = 0;
    let lastSummaryIssue = '';

    for (let attempt = 1; attempt <= MAX_QUALITY_RETRIES; attempt++) {
      const params = { ...baseParams };

      // 재시도 시 이전 실패 사유를 구체적으로 알려줌
      if (attempt > 1) {
        const minChapters = reading.service_type === 'daily' ? 0
          : ['comprehensive', 'compatibility', 'business'].includes(reading.service_type) ? 8 : 5;
        const prevFailReasons = [];
        if (lastChapterCount < minChapters) prevFailReasons.push(`챕터가 ${lastChapterCount}개밖에 없었음 (최소 ${minChapters}개 필요)`);
        if (lastTruncatedCount > 0) prevFailReasons.push(`${lastTruncatedCount}개 챕터가 50자 미만으로 내용이 잘렸음`);
        if (lastSummaryIssue) prevFailReasons.push(`summary 문제: ${lastSummaryIssue}`);
        const failFeedback = prevFailReasons.length > 0 ? `\n이전 시도(${attempt - 1}차)의 문제: ${prevFailReasons.join('. ')}` : '';

        const retryMsg = `\n\n[중요 - ${attempt}차 재시도] 이전 시도에서 품질 문제가 있었습니다.${failFeedback}
반드시 다음을 지켜주세요:
- 최소 ${minChapters}개 이상의 완전한 챕터 (이전에 ${lastChapterCount}개였음)
- 각 챕터의 content는 120~260자 정도로 압축하되, 근거와 결론이 모두 있어야 함
- 각 챕터의 "emoji" 필드에 반드시 이모지 1개
- 모든 챕터 title은 서로 달라야 함
- 모든 챕터 title은 "카테고리: 제목" 형식이어야 함
- summary는 기술어/오행 보정 메모가 아니라 상단 카드에 어울리는 자연스러운 대표 설명이어야 함`;
        if (provider === 'openai') {
          params.input = userMessage + retryMsg;
        } else {
          params.messages = [{ role: 'user', content: userMessage + retryMsg }];
        }
      }

      const apiResponse = provider === 'openai'
        ? await callOpenAIParsed(params, zodSchema, `${reading.service_type}_reading`)
        : await callClaudeParsed(params, zodSchema, requestOptions);

      // stop_reason 체크
      const stopReason = apiResponse.stop_reason;
      if (stopReason === 'max_tokens' || stopReason === 'max_output_tokens') {
        log('warn', `[${rid}] Hit max_tokens (attempt ${attempt}), output truncated`);
      }

      // SDK가 자동 파싱 + Zod 검증 완료
      let result = apiResponse.parsed_output;
      if (!result) {
        log('warn', `[${rid}] parsed_output null (attempt ${attempt}), stop=${stopReason}`);
        if (attempt === MAX_QUALITY_RETRIES) throw new Error('parsed_output null after max retries');
        continue;
      }

      apiCost = calculateCost(actualModel, apiResponse.usage || {}, apiResponse.tool_stats || {});
      totalApiCost += apiCost.cost_usd;

      // luckyItems.direction 강제 덮어쓰기 (Claude가 무시할 수 있으므로)
      if (result.luckyItems && reading.service_type !== 'compatibility') {
        const luckyData = buildLuckySection(profile.calculated_saju, profile.calculated_saju.pillars);
        // direction은 서버 계산값으로 무조건 덮어쓰기
        const dirMatch = luckyData.match(/행운 방위: (.+?) \(용신\)/);
        if (dirMatch) {
          result.luckyItems.direction = dirMatch[1];
        }
        // 설명문이 포함된 값 정리 (예: "남서쪽 (토 기운의 방위)" → "서쪽")
        for (const key of ['color', 'number', 'food', 'direction']) {
          if (result.luckyItems[key] && result.luckyItems[key].length > 10) {
            // 괄호 앞까지만 또는 첫 단어만
            result.luckyItems[key] = result.luckyItems[key].split(/[(\s—,]/)[0].trim();
          }
        }
      }

      // 마크다운 → HTML 후처리 (**텍스트** → <strong>텍스트</strong>)
      function cleanMarkdown(text) {
        if (!text) return text;
        return text
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/^#{1,3}\s+/gm, '');  // ## 헤딩 제거
      }
      if (result.summary) result.summary = cleanMarkdown(result.summary);
      if (Array.isArray(result.chapters)) {
        for (const ch of result.chapters) {
          if (ch.content) ch.content = cleanMarkdown(ch.content);
          if (ch.title) ch.title = cleanMarkdown(ch.title);
        }
      }
      if (Array.isArray(result.advice)) {
        result.advice = result.advice.map(a => cleanMarkdown(a));
      } else if (typeof result.advice === 'string') {
        result.advice = cleanMarkdown(result.advice);
      }

      let summaryIssue = getSummaryQualityIssue(result.summary, reading.service_type);
      if (summaryIssue && attempt === MAX_QUALITY_RETRIES) {
        result.summary = fallbackSummaryFor(reading.service_type);
        summaryIssue = '';
      }

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

      // 중복/잘린 챕터 후처리
      if (Array.isArray(result.chapters)) {
        // 1. 같은 id의 중복 챕터 → 더 긴 content만 유지
        const byId = {};
        for (const ch of result.chapters) {
          const key = ch.id || ch.title;
          if (!byId[key] || (ch.content?.length || 0) > (byId[key].content?.length || 0)) {
            byId[key] = ch;
          }
        }
        result.chapters = Object.values(byId);

        // 2. 잘린 챕터 제거 (50자 미만)
        result.chapters = result.chapters.filter(ch => (ch.content?.length || 0) >= 50);

        // 3. 남은 중복 제목에 넘버링
        const titleCount = {};
        for (const ch of result.chapters) {
          if (!ch.title) continue;
          titleCount[ch.title] = (titleCount[ch.title] || 0) + 1;
          if (titleCount[ch.title] > 1) {
            ch.title = `${ch.title} (${titleCount[ch.title]})`;
          }
        }

        // 4. id 재정렬
        result.chapters.forEach((ch, i) => { ch.id = `chapter-${String(i + 1).padStart(2, '0')}`; });
      }

      // 품질 검증 (완화: 이모지 누락은 후처리로 보완, 챕터 수와 내용만 체크)
      const chapters = result.chapters;
      const minChapters = reading.service_type === 'daily' ? 0
        : ['comprehensive', 'compatibility', 'business'].includes(reading.service_type) ? 8 : 5;
      const chapterCount = Array.isArray(chapters) ? chapters.length : 0;
      const hasEnoughChapters = minChapters === 0 || chapterCount >= minChapters;

      // 챕터 내용 잘림 체크 (50자 미만이 과반수면 fail)
      const truncatedChapters = Array.isArray(chapters) ? chapters.filter(ch => ch.content && ch.content.length < 50) : [];
      const hasTruncated = truncatedChapters.length > Math.ceil(chapterCount / 2);
      const hasReadableSummary = !summaryIssue;

      // 이모지 누락은 후처리로 기본값 채움 (fail 사유에서 제외)
      if (Array.isArray(chapters)) {
        const defaultEmojis = ['🔮','⭐','💫','🌟','✨','🎯','💡','🌈','🍀','🌙','🔥','💎','🌊','🏔️','🎭'];
        for (let ci = 0; ci < chapters.length; ci++) {
          if (!chapters[ci].emoji || !chapters[ci].emoji.trim()) {
            chapters[ci].emoji = defaultEmojis[ci % defaultEmojis.length];
          }
        }
      }

      if (hasEnoughChapters && !hasTruncated && hasReadableSummary) {
        parsed = result;
        log('info', `[${rid}] Quality OK (attempt ${attempt}): ${chapterCount} chapters, stop=${stopReason}`);
        break;
      }

      // 실패 사유 기록 + 다음 재시도에 전달할 정보 갱신
      lastChapterCount = chapterCount;
      lastTruncatedCount = truncatedChapters.length;
      lastSummaryIssue = summaryIssue;
      const failReasons = [];
      if (!hasEnoughChapters) failReasons.push(`챕터 수 부족(${chapterCount}/${minChapters}개)`);
      if (hasTruncated) failReasons.push(`잘린 챕터 ${truncatedChapters.length}개(50자 미만)`);
      if (summaryIssue) failReasons.push(`summary 품질 문제(${summaryIssue})`);
      const failDetail = failReasons.join(', ');

      log('warn', `[${rid}] Quality FAIL (attempt ${attempt}/${MAX_QUALITY_RETRIES}): ${failDetail} | stop=${stopReason}`);

      if (attempt === MAX_QUALITY_RETRIES) {
        parsed = result;
        log('warn', `[${rid}] Using last attempt result despite: ${failDetail}`);
      }
    }

    // 위에서 시작한 OG 이미지 생성을 기다린다. 텍스트 생성과 겹쳐서 전체 대기 시간을 줄인다.
    let ogCost = 0;
    let ogResult = null;
    ogResult = await ogPromise;
    if (ogResult) {
      ogCost = ogResult.openai_og_cost_usd || ogResult.gemini_cost_usd || 0;
      totalCostUsd += ogCost;
      log('info', `[${rid}] OG cost: $${ogCost} → total session $${totalCostUsd.toFixed(4)}`);
    }

    const durationMs = Date.now() - startTime;
    const finalApiCost = {
      ...apiCost,
      total_cost_usd: Math.round((totalApiCost + ogCost) * 1_000_000) / 1_000_000,
      ...(ogCost > 0 ? { og_image_cost_usd: ogCost } : {}),
      ...(ogResult?.provider ? { og_image_provider: ogResult.provider } : {}),
      ...(ogResult?.image_generation_model ? { og_image_model: ogResult.image_generation_model } : {}),
    };

    await supabase.from('readings').update({
      result: parsed,
      processing_status: 'completed',
      processing_completed_at: new Date().toISOString(),
      processing_duration_ms: durationMs,
      api_cost: finalApiCost,
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
    const MAX_READING_RETRIES = 2;

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

      // stuck 복구 (10분 초과 processing, 30초마다 한번만 체크)
      if (Date.now() - (globalThis._lastStuckCheck || 0) > 30_000) {
        globalThis._lastStuckCheck = Date.now();
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: stuck } = await supabase
          .from('readings')
          .select('id')
          .eq('processing_status', 'processing')
          .lt('processing_started_at', tenMinAgo)
          .limit(10);

        if (stuck?.length > 0) {
          log('warn', `Resetting ${stuck.length} stuck readings (>10min)`);
          for (const s of stuck) {
            if (!activeJobs.has(s.id)) {
              await supabase.from('readings')
                .update({ processing_status: 'pending', processing_started_at: null })
                .eq('id', s.id);
            }
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
║  🐕 운명전쟁 워커                            ║
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

// Edge Function 콜드스타트 방지 (5분마다 warm-up 핑)
const EDGE_FUNCTIONS = ['saju-request', 'chat-send', 'payment-confirm'];
async function warmUpEdgeFunctions() {
  for (const fn of EDGE_FUNCTIONS) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'OPTIONS' });
    } catch {}
  }
}
warmUpEdgeFunctions(); // 시작 시 즉시 실행
setInterval(warmUpEdgeFunctions, 5 * 60_000); // 5분마다

resetStuckOnStartup().then(() => loadServiceCosts()).then(() => pollLoop());
// 10분마다 비용 갱신
setInterval(loadServiceCosts, 10 * 60_000);
