-- 큐 시스템: readings 테이블에 처리 상태/시간/비용 추가

ALTER TABLE public.readings ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

ALTER TABLE public.readings ADD COLUMN processing_started_at TIMESTAMPTZ;
ALTER TABLE public.readings ADD COLUMN processing_completed_at TIMESTAMPTZ;
ALTER TABLE public.readings ADD COLUMN processing_duration_ms INTEGER;

-- API 비용 추적 (input_tokens, output_tokens, cost_usd)
ALTER TABLE public.readings ADD COLUMN api_cost JSONB;

-- 실패 사유
ALTER TABLE public.readings ADD COLUMN failure_reason TEXT;

-- 기존 completed readings의 processing_status를 completed로
UPDATE public.readings SET processing_status = 'completed' WHERE status = 'completed';

-- pending 상태 빠른 조회용 인덱스
CREATE INDEX idx_readings_pending ON public.readings(processing_status)
  WHERE processing_status IN ('pending', 'processing');
