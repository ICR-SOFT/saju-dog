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
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '5');
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
  const mappedType = ['comprehensive', 'compatibility', 'daily', 'chat'].includes(serviceType)
    ? serviceType : 'comprehensive';

  const { data, error } = await supabase
    .from('prompt_configs').select('*')
    .eq('service_type', mappedType).eq('is_active', true).single();

  if (error || !data) throw new Error(`No prompt config: ${mappedType}`);
  return data;
}

// ===== 유저 메시지 빌드 =====
function buildUserMessage(reading, profile, secondaryProfile) {
  const data = profile.calculated_saju;
  if (!data) throw new Error('calculated_saju 없음');

  const p = data.pillars;
  const s = data.sinsal || {};
  const fmtArr = (arr) => arr?.length > 0 ? arr.join(', ') : '없음';
  const fmtJJ = (jj) => jj?.map(j => `${j.stem}(${j.sipsin}·${j.type})`).join(', ') || '';

  if (reading.service_type === 'compatibility' && secondaryProfile?.calculated_saju) {
    const d2 = secondaryProfile.calculated_saju;
    const p2 = d2.pillars;
    const s2 = d2.sinsal || {};
    return `## 첫 번째 (${data.input?.name || profile.name})
사주: ${p.year.stem}${p.year.branch} ${p.month.stem}${p.month.branch} ${p.day.stem}${p.day.branch} ${p.hour.stem}${p.hour.branch}
오행: 목${data.ohaengCount?.['목']} 화${data.ohaengCount?.['화']} 토${data.ohaengCount?.['토']} 금${data.ohaengCount?.['금']} 수${data.ohaengCount?.['수']}
띠: ${data.ddi?.fullName || '?'} / 별자리: ${data.zodiac?.name || '?'}
신살: ${fmtArr(s.allSinsal)} / 귀인: ${fmtArr(s.guiin)}

## 두 번째 (${d2.input?.name || secondaryProfile.name})
사주: ${p2.year.stem}${p2.year.branch} ${p2.month.stem}${p2.month.branch} ${p2.day.stem}${p2.day.branch} ${p2.hour.stem}${p2.hour.branch}
오행: 목${d2.ohaengCount?.['목']} 화${d2.ohaengCount?.['화']} 토${d2.ohaengCount?.['토']} 금${d2.ohaengCount?.['금']} 수${d2.ohaengCount?.['수']}
띠: ${d2.ddi?.fullName || '?'} / 별자리: ${d2.zodiac?.name || '?'}
신살: ${fmtArr(s2.allSinsal)} / 귀인: ${fmtArr(s2.guiin)}

궁합을 JSON으로 작성해주세요.`;
  }

  return `아래는 서버에서 정밀 계산된 사주 데이터입니다. 이 데이터만 기반으로 해설하세요.

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

위 모든 데이터를 종합하여 사주 풀이를 JSON으로 작성해주세요.
신살, 귀인, 기둥별 관계, 띠, 별자리를 적극 활용하세요.`;
}

// ===== JSON 파싱 =====
function parseResponse(text) {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  try { return JSON.parse(jsonStr); } catch {}
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start !== -1 && end !== -1) return JSON.parse(jsonStr.slice(start, end + 1));
  throw new Error('JSON 파싱 실패');
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

    const config = await getPromptConfig(reading.service_type);
    const userMessage = buildUserMessage(reading, profile, secondaryProfile);

    const params = {
      model: config.model,
      max_tokens: config.max_tokens,
      messages: [{ role: 'user', content: userMessage }],
    };
    if (config.use_thinking && config.thinking_type) params.thinking = { type: config.thinking_type };
    if (config.temperature !== null) params.temperature = config.temperature;
    if (config.use_prompt_caching) {
      params.system = [{ type: 'text', text: config.system_prompt, cache_control: { type: 'ephemeral' } }];
    } else {
      params.system = config.system_prompt;
    }

    const apiResponse = await callClaude(params);
    const durationMs = Date.now() - startTime;

    const text = apiResponse.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = parseResponse(text);
    const apiCost = calculateCost(config.model, apiResponse.usage || {});

    await supabase.from('readings').update({
      result: parsed,
      processing_status: 'completed',
      processing_completed_at: new Date().toISOString(),
      processing_duration_ms: durationMs,
      api_cost: apiCost,
      prompt_config_id: config.id,
    }).eq('id', reading.id);

    totalProcessed++;
    totalCostUsd += apiCost.cost_usd;
    log('info', `[${rid}] Done ${(durationMs / 1000).toFixed(1)}s | ${apiCost.input_tokens}→${apiCost.output_tokens} tok | $${apiCost.cost_usd}`);

  } catch (err) {
    const durationMs = Date.now() - startTime;
    const reason = err.message || String(err);

    await supabase.from('readings').update({
      processing_status: 'failed',
      processing_completed_at: new Date().toISOString(),
      processing_duration_ms: durationMs,
      failure_reason: reason,
    }).eq('id', reading.id);

    await refundCredits(reading.user_id, reading.service_type, reading.id);
    totalFailed++;
    log('error', `[${rid}] Failed: ${reason}`);
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

pollLoop();
