-- Correct relationship interpretation and summary style for environments that already ran older prompt migrations.
UPDATE public.prompt_configs
SET
  system_prompt = system_prompt || E'\n\n## 관계 중심 궁합 v1.2\n- 궁합은 사주 요소 나열보다 두 사람/여러 사람의 실제 관계에 집중하세요.\n- 사용자가 역할을 준 경우 그 역할은 호칭 강제가 아니라 해석 맥락입니다. 예: 부모-자녀면 부자/모녀 관계의 정서, 양육, 독립, 대화 리듬을 중심으로 풀이하세요.\n- 이름 앞에 역할을 매번 붙이지 마세요. "배우자인 민수님은 배우자인 지현님은"처럼 어색한 반복은 금지입니다.\n- 역할이 없으면 관계 유형(연인/부부, 친구/동료, 가족, 동업, 상사/부하 등)에 맞춰 주제와 관점을 조절하세요.\n- 가족/부모자녀 관계에서는 연애·결혼 챕터를 만들지 말고 정서적 거리, 대화 방식, 보호와 독립, 서운함 회복법을 중심으로 쓰세요.\n- 동업/사업 관계에서는 역할분담, 의사결정, 돈 얘기, 책임소재, 오래 가는 운영법을 중심으로 쓰세요.\n- 최소 2개 챕터에는 서로에게 바로 해볼 수 있는 말/행동 예시를 넣으세요.',
  updated_at = NOW()
WHERE is_active = true
  AND service_type = 'compatibility'
  AND system_prompt NOT LIKE '%## 관계 중심 궁합 v1.2%';

UPDATE public.prompt_configs
SET
  system_prompt = system_prompt || E'\n\n## summary 대표설명 가이드 v1.2\n- summary는 카드/상단에 보이는 대표 설명입니다. 억지로 짧은 표어처럼 만들지 말고, 사용자가 바로 읽고 "내 이야기네"라고 느낄 자연스러운 소개문으로 쓰세요.\n- 한 문장 또는 짧은 두 절 정도로 충분합니다. 길이를 30자 안에 억지로 맞추지 마세요.\n- 성향 또는 현재 흐름 + 부드러운 방향성을 담으세요. 예: "단단한 추진력이 방향을 잡으면 크게 움직이는 흐름", "큰 책임감이 쌓인 만큼 유연한 선택이 중요해지는 시기".\n- "목/화/토/금/수", "용신/희신/기신", "신강/신약", "일간", "대운", "오행", "칼/물/불/나무/흙" 같은 기술어/보정재료를 summary에 쓰지 마세요.\n- "~이 필요", "~가 부족", "~을 보완"처럼 처방 메모 같은 문장으로 끝내지 마세요.\n- 오행 보정 이야기는 챕터 본문에서 쉽게 풀고, summary에는 사람의 성향과 방향만 남기세요.',
  updated_at = NOW()
WHERE is_active = true
  AND service_type NOT IN ('compatibility', 'business', 'chat')
  AND system_prompt NOT LIKE '%## summary 대표설명 가이드 v1.2%';
