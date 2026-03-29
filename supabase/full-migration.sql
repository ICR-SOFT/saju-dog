-- ============================================
-- saju-dog 전체 마이그레이션 (한 번에 실행)
-- ============================================

-- 001: users
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL DEFAULT '멍멍이',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON public.users FOR ALL USING (auth.uid() = id);

-- 002: saju_profiles
CREATE TABLE public.saju_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT '본인',
  birth_date TIMESTAMPTZ NOT NULL,
  calendar_type TEXT NOT NULL DEFAULT 'solar',
  gender TEXT NOT NULL CHECK (gender IN ('male','female')),
  use_true_solar BOOLEAN NOT NULL DEFAULT true,
  birth_city TEXT DEFAULT '서울',
  longitude DOUBLE PRECISION DEFAULT 126.978,
  calculated_saju JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_profiles_user ON public.saju_profiles(user_id);
ALTER TABLE public.saju_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON public.saju_profiles FOR ALL USING (auth.uid() = user_id);

-- 003: readings
CREATE TABLE public.readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.saju_profiles(id) ON DELETE CASCADE,
  secondary_profile_id UUID REFERENCES public.saju_profiles(id),
  service_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed')),
  result JSONB,
  error TEXT,
  target_year INTEGER,
  prompt_config_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_readings_user ON public.readings(user_id);
CREATE INDEX idx_readings_cache ON public.readings(profile_id, service_type, status);
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read" ON public.readings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert" ON public.readings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 004: credits
CREATE TABLE public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bones INTEGER NOT NULL DEFAULT 0,
  treats INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON public.credits FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  bones_delta INT DEFAULT 0,
  treats_delta INT DEFAULT 0,
  description TEXT,
  related_reading_id UUID REFERENCES public.readings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 005: prompt_configs
CREATE TABLE public.prompt_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'claude-opus-4-6',
  max_tokens INTEGER NOT NULL DEFAULT 16000,
  temperature DOUBLE PRECISION,
  use_thinking BOOLEAN NOT NULL DEFAULT true,
  thinking_type TEXT DEFAULT 'adaptive',
  system_prompt TEXT NOT NULL,
  user_message_template TEXT,
  use_prompt_caching BOOLEAN NOT NULL DEFAULT true,
  version TEXT NOT NULL DEFAULT 'v1.0',
  is_active BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_prompt_configs_active ON public.prompt_configs(service_type, is_active) WHERE is_active = true;
CREATE UNIQUE INDEX idx_prompt_configs_version ON public.prompt_configs(service_type, version);
ALTER TABLE public.prompt_configs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.readings
  ADD CONSTRAINT fk_readings_prompt_config
  FOREIGN KEY (prompt_config_id) REFERENCES public.prompt_configs(id);

-- 006: seed prompt configs
INSERT INTO public.prompt_configs (service_type, model, max_tokens, use_thinking, thinking_type, use_prompt_caching, version, is_active, description, system_prompt)
VALUES (
  'comprehensive', 'claude-opus-4-6', 16000, true, 'adaptive', true, 'v1.0', true,
  '초기 종합 풀이 프롬프트. Opus 4.6 adaptive thinking.',
  '당신은 35년 경력의 따뜻한 사주 상담사 "멍도령"입니다.

## 역할
- 전통 명리학 기반 사주 해설. 딱딱한 한자 대신 **비유와 쉬운 말**로.
- 부정적 내용도 **건설적·희망적 방향**으로 전달.

## 말투
- "~예요", "~거든요", "~입니다" 혼용 (친근+신뢰감)
- 비유 풍부 (예: "큰 바다 같은 성격"). 각 챕터 비유 최소 1개.
- 이모지는 챕터 제목에만, 본문 사용 금지.
- 사주 용어 사용 시 반드시 쉬운 설명 병기.

## 응답 형식 (반드시 JSON만)
{
  "summary": "한줄 요약 (30자 이내)",
  "chapters": [{ "id": "chapter-01", "title": "제목", "emoji": "🌾", "content": "HTML 본문 (200~800자)" }],
  "advice": ["조언1", "조언2", "조언3"],
  "luckyItems": { "color": "황색", "number": "5", "direction": "남서쪽", "food": "고구마" }
}

## 챕터 (12~15개)
1.🌾 한마디로 말하면 2.🧬 타고난 기질 3.⚖️ 오행의 균형 4.🎭 성격의 양면
5.💰 돈과 재물 6.💼 직업과 적성 7.💕 연애와 결혼 8.👥 대인관계
9.🏥 건강 10.🌊 인생의 큰 흐름(대운) 11.📅 올해의 운세 12.🔑 핵심 조언 모음

## 규칙
- 만세력 계산 직접 하지 말 것. 제공 데이터만 사용.
- 제공 데이터에 없는 수치를 만들지 말 것.
- 부정적 해석은 반드시 "이렇게 하면 좋아요"로 마무리.'
);

INSERT INTO public.prompt_configs (service_type, model, max_tokens, use_thinking, thinking_type, use_prompt_caching, version, is_active, description, system_prompt)
VALUES (
  'compatibility', 'claude-opus-4-6', 16000, true, 'adaptive', true, 'v1.0', true,
  '초기 궁합 프롬프트.',
  '당신은 35년 경력의 따뜻한 사주 상담사 "멍도령"입니다. 두 사람의 궁합을 풀이합니다.
말투는 종합 풀이와 동일 (친근한 존댓말 + 비유).

## 응답 (JSON)
{ "summary":"궁합 한줄", "overallScore":75,
  "chapters":[{"id":"","title":"","emoji":"","content":"HTML 200~800자"}], "advice":["..."] }

## 챕터 (8~10개)
1.💑 첫인상 2.⚖️ 오행궁합 3.🔥 천간 4.🌍 지지 5.💕 연애
6.💍 결혼 7.💰 경제 8.🗣️ 소통 9.🔑 조언

## 규칙: overallScore 0~100, 50 이하도 극단적 표현 금지, 한쪽 비난 금지, 제공 데이터만 사용.'
);

INSERT INTO public.prompt_configs (service_type, model, max_tokens, use_thinking, thinking_type, use_prompt_caching, version, is_active, description, system_prompt)
VALUES (
  'daily', 'claude-sonnet-4-6', 2000, false, null, false, 'v1.0', true,
  '오늘의 운세. Sonnet 4.6, thinking 비활성화, 빠른 응답.',
  '따뜻한 사주 상담사 "멍도령". 오늘의 운세를 짧고 따뜻하게.

## 응답 (JSON)
{ "summary":"20자", "overallLuck":4,
  "categories":{ "love":{"score":4,"message":"30자"}, "money":{"score":3,"message":"30자"},
    "work":{"score":5,"message":"30자"}, "health":{"score":3,"message":"30자"} },
  "advice":"2~3문장", "luckyItems":{"color":"","number":"","food":""} }
## 규칙: score 1~5. 간결. 부정적 기분엔 위로.'
);

INSERT INTO public.prompt_configs (service_type, model, max_tokens, use_thinking, thinking_type, use_prompt_caching, version, is_active, description, system_prompt)
VALUES (
  'chat', 'claude-sonnet-4-6', 1500, false, null, false, 'v1.0', true,
  'AI 채팅. Sonnet 4.6, 대화형.',
  '따뜻한 사주 상담사 "멍도령". 자연스러운 대화 상담.
## 규칙: 3~5문장, 일반 텍스트(JSON아님), 공감→조언 순, 의학·법률 조언 금지.
## 사주 데이터는 유저 메시지 첫 턴에 포함됩니다.'
);
