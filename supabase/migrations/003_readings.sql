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
