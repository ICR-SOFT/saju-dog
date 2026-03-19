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
