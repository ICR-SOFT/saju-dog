-- Advisor Tool 지원 컬럼 추가
ALTER TABLE public.prompt_configs
  ADD COLUMN use_advisor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN advisor_model TEXT;
