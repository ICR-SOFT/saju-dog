/**
 * saju-dog 워커 — EC2 상시 실행
 *
 * pending 상태의 reading을 감시하고 Claude API로 처리.
 * 레이트리밋 시 지수 백오프 재시도.
 * 실패 시 자동 환불.
 *
 * 실행: node --env-file=.env worker.mjs
 * PM2: pm2 start worker.mjs --name saju-worker --env-file .env
 */

import { createClient } from '@supabase/supabase-js';

// ===== 설정 =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '3000');
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');
const RETRY_BASE_DELAY = parseInt(process.env.RETRY_BASE_DELAY_MS || '5000');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CREDIT_COSTS = {
  comprehensive: 3, compatibility: 3, daeun: 2, yearly: 2,
  daily: 0, chat: 1, business: 3, luckyday: 2,
  love: 2, wealth: 2, health: 2, career: 2, pastlife: 2, moving: 2,
};

let isProcessing = false;
let totalProcessed = 0;
let totalFailed = 0;
let totalCostUsd = 0;

// ===== 로깅 =====
function log(level, msg, data) {
  const ts = new Date().toISOString();
  const prefix = { info: '✅', warn: '⚠️', error: '❌', debug: '🔍' }[level] || 'ℹ️';
  console.log(`[${ts}] ${prefix} ${msg}`, data ? JSON.stringify(data) : '');
}

// ===== Claude API 호출 (레이트리밋 재시도) =====
async function callClaude(params, attempt = 1) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(params),
  });

  // 레이트리밋 (429) 또는 서버 에러 (5xx)
  if (response.status === 429 || response.status >= 500) {
    if (attempt > MAX_RETRIES) {
      const errBody = await response.text();
      throw new Error(`Claude API ${response.status} after ${MAX_RETRIES} retries: ${errBody}`);
    }

    const retryAfter = response.headers.get('retry-after');
    const delay = retryAfter
      ? parseInt(retryAfter) * 1000
      : RETRY_BASE_DELAY * Math.pow(2, attempt - 1); // 지수 백오프

    log('warn', `Rate limited (${response.status}), retry ${attempt}/${MAX_RETRIES} in ${delay}ms`);
    await sleep(delay);
    return callClaude(params, attempt + 1);
  }

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Claude API ${response.status}: ${errBody}`);
  }

  return response.json();
}

// ===== 프롬프트 설정 로드 =====
async function getPromptConfig(serviceType) {
  const mappedType = ['comprehensive', 'compatibility', 'daily', 'chat'].includes(serviceType)
    ? serviceType
    : 'comprehensive';

  const { data, error } = await supabase
    .from('prompt_configs')
    .select('*')
    .eq('service_type', mappedType)
    .eq('is_active', true)
    .single();

  if (error || !data) throw new Error(`No active prompt config for: ${mappedType}`);
  return data;
}

// ===== 유저 메시지 빌드 =====
function buildUserMessage(reading, profile, secondaryProfile) {
  const data = profile.calculated_saju;
  if (!data) throw new Error('calculated_saju가 없습니다');

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

  // 종합 풀이 (+ 기타 서비스)
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
  try {
    return JSON.parse(jsonStr);
  } catch {
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end !== -1) return JSON.parse(jsonStr.slice(start, end + 1));
    throw new Error('JSON 파싱 실패');
  }
}

// ===== 비용 계산 =====
function calculateCost(model, usage) {
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheCreation = usage.cache_creation_input_tokens || 0;

  let inputRate = 3.0, outputRate = 15.0; // Sonnet
  if (model.includes('opus')) { inputRate = 15.0; outputRate = 75.0; }
  else if (model.includes('haiku')) { inputRate = 0.25; outputRate = 1.25; }

  const costUsd = (
    (inputTokens - cacheRead) * inputRate +
    cacheRead * inputRate * 0.1 +
    cacheCreation * inputRate * 1.25 +
    outputTokens * outputRate
  ) / 1_000_000;

  return {
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheRead,
    cache_creation_tokens: cacheCreation,
    cost_usd: Math.round(costUsd * 10000) / 10000,
  };
}

// ===== 크레딧 환불 =====
async function refundCredits(userId, serviceType, readingId) {
  const cost = CREDIT_COSTS[serviceType] ?? 2;
  if (cost <= 0) return;

  const { data: credits } = await supabase
    .from('credits').select('bones').eq('user_id', userId).single();

  if (credits) {
    await supabase.from('credits')
      .update({ bones: credits.bones + cost, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    await supabase.from('credit_transactions').insert({
      user_id: userId, type: 'refund', bones_delta: cost,
      description: `${serviceType} 풀이 실패 자동환불`,
      related_reading_id: readingId,
    });

    log('info', `Refunded ${cost} bones to user ${userId.slice(0, 8)}...`);
  }
}

// ===== 단일 reading 처리 =====
async function processReading(reading) {
  const startTime = Date.now();
  log('info', `Processing reading ${reading.id.slice(0, 8)}... (${reading.service_type})`);

  // processing 상태로 전환
  await supabase.from('readings').update({
    processing_status: 'processing',
    processing_started_at: new Date().toISOString(),
  }).eq('id', reading.id);

  try {
    // 프로필 로드
    const { data: profile } = await supabase
      .from('saju_profiles').select('*').eq('id', reading.profile_id).single();
    if (!profile?.calculated_saju) throw new Error('calculated_saju 없음');

    let secondaryProfile = null;
    if (reading.secondary_profile_id) {
      const { data } = await supabase
        .from('saju_profiles').select('*').eq('id', reading.secondary_profile_id).single();
      secondaryProfile = data;
    }

    // 프롬프트 설정 로드
    const config = await getPromptConfig(reading.service_type);

    // 유저 메시지 빌드
    const userMessage = buildUserMessage(reading, profile, secondaryProfile);

    // Claude API 파라미터
    const params = {
      model: config.model,
      max_tokens: config.max_tokens,
      messages: [{ role: 'user', content: userMessage }],
    };

    if (config.use_thinking && config.thinking_type) {
      params.thinking = { type: config.thinking_type };
    }
    if (config.temperature !== null) {
      params.temperature = config.temperature;
    }
    if (config.use_prompt_caching) {
      params.system = [{
        type: 'text',
        text: config.system_prompt,
        cache_control: { type: 'ephemeral' },
      }];
    } else {
      params.system = config.system_prompt;
    }

    // Claude API 호출 (레이트리밋 자동 재시도)
    const apiResponse = await callClaude(params);
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // 텍스트 추출 + 파싱
    const text = apiResponse.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const parsed = parseResponse(text);
    const apiCost = calculateCost(config.model, apiResponse.usage || {});

    // 완료 저장
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

    log('info', `Completed ${reading.id.slice(0, 8)} in ${(durationMs / 1000).toFixed(1)}s`, {
      model: apiCost.model,
      tokens: `${apiCost.input_tokens}→${apiCost.output_tokens}`,
      cost: `$${apiCost.cost_usd}`,
    });

  } catch (err) {
    const endTime = Date.now();
    const failureReason = err.message || String(err);

    await supabase.from('readings').update({
      processing_status: 'failed',
      processing_completed_at: new Date().toISOString(),
      processing_duration_ms: endTime - startTime,
      failure_reason: failureReason,
    }).eq('id', reading.id);

    // 자동 환불
    await refundCredits(reading.user_id, reading.service_type, reading.id);

    totalFailed++;
    log('error', `Failed ${reading.id.slice(0, 8)}: ${failureReason}`);
  }
}

// ===== 메인 루프 =====
async function pollLoop() {
  while (true) {
    try {
      if (!isProcessing) {
        // pending 상태인 reading 조회 (오래된 것부터)
        const { data: pendings } = await supabase
          .from('readings')
          .select('*')
          .eq('processing_status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1);

        if (pendings?.length > 0) {
          isProcessing = true;
          await processReading(pendings[0]);
          isProcessing = false;
        }

        // stuck된 processing 복구 (5분 이상 processing인 것)
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: stuck } = await supabase
          .from('readings')
          .select('id')
          .eq('processing_status', 'processing')
          .lt('processing_started_at', fiveMinAgo)
          .limit(5);

        if (stuck?.length > 0) {
          log('warn', `Found ${stuck.length} stuck readings, resetting to pending`);
          for (const s of stuck) {
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 시작 =====
console.log(`
╔══════════════════════════════════════╗
║     🐕 사주독 워커 시작              ║
║     Poll: ${POLL_INTERVAL}ms                    ║
║     Retries: ${MAX_RETRIES}                       ║
║     ${new Date().toISOString()}     ║
╚══════════════════════════════════════╝
`);

// 상태 리포트 (1분마다)
setInterval(() => {
  log('info', `📊 Status: processed=${totalProcessed} failed=${totalFailed} cost=$${totalCostUsd.toFixed(4)} processing=${isProcessing}`);
}, 60_000);

// 우아한 종료
process.on('SIGINT', () => {
  log('info', '🛑 Shutting down...');
  log('info', `📊 Final: processed=${totalProcessed} failed=${totalFailed} cost=$${totalCostUsd.toFixed(4)}`);
  process.exit(0);
});

pollLoop();
