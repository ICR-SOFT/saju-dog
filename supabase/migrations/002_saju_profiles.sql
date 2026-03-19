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
