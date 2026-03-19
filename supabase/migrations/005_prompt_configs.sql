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

CREATE INDEX idx_prompt_configs_active ON public.prompt_configs(service_type, is_active)
  WHERE is_active = true;

CREATE UNIQUE INDEX idx_prompt_configs_version ON public.prompt_configs(service_type, version);

ALTER TABLE public.prompt_configs ENABLE ROW LEVEL SECURITY;

-- readings 테이블에 FK 추가
ALTER TABLE public.readings
  ADD CONSTRAINT fk_readings_prompt_config
  FOREIGN KEY (prompt_config_id) REFERENCES public.prompt_configs(id);
