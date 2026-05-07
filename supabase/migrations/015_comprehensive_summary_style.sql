-- Keep reading summaries user-facing instead of technical remedy notes.
UPDATE public.prompt_configs
SET
  system_prompt = system_prompt || E'\n\n## summary 대표설명 가이드 v1.2\n- summary는 카드/상단에 보이는 대표 설명입니다. 억지로 짧은 표어처럼 만들지 말고, 사용자가 바로 읽고 "내 이야기네"라고 느낄 자연스러운 소개문으로 쓰세요.\n- 한 문장 또는 짧은 두 절 정도로 충분합니다. 길이를 30자 안에 억지로 맞추지 마세요.\n- 성향 또는 현재 흐름 + 부드러운 방향성을 담으세요. 예: "단단한 추진력이 방향을 잡으면 크게 움직이는 흐름", "큰 책임감이 쌓인 만큼 유연한 선택이 중요해지는 시기".\n- "목/화/토/금/수", "용신/희신/기신", "신강/신약", "일간", "대운", "오행", "칼/물/불/나무/흙" 같은 기술어/보정재료를 summary에 쓰지 마세요.\n- "~이 필요", "~가 부족", "~을 보완"처럼 처방 메모 같은 문장으로 끝내지 마세요.\n- 오행 보정 이야기는 챕터 본문에서 쉽게 풀고, summary에는 사람의 성향과 방향만 남기세요.',
  updated_at = NOW()
WHERE is_active = true
  AND service_type NOT IN ('compatibility', 'business', 'chat')
  AND system_prompt NOT LIKE '%## summary 대표설명 가이드 v1.2%';
