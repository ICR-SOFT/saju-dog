-- Store model/token/cost metadata for chat assistant responses.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS api_cost JSONB;
