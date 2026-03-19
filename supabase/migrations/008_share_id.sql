-- Add share_id column for public sharing of readings
ALTER TABLE public.readings ADD COLUMN share_id TEXT UNIQUE;

-- Partial index for fast lookups (only rows with share_id)
CREATE INDEX idx_readings_share ON public.readings(share_id) WHERE share_id IS NOT NULL;

-- Public read policy for shared readings (no auth required)
CREATE POLICY "share_public" ON public.readings FOR SELECT USING (share_id IS NOT NULL);
