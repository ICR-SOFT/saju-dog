-- Make readings easier to scan and push the model toward connected interpretation.
UPDATE public.prompt_configs
SET
  system_prompt = system_prompt || E'\n\n## 챕터 구조/분량 가이드 v1.3\n- 이전 프롬프트에 더 많은 챕터 수가 적혀 있어도 이 규칙을 우선하세요.\n- daily/chat을 제외한 풀이의 챕터는 5~8개만 작성하세요. 종합 사주도 8개 안팎으로 압축하세요.\n- 각 title은 반드시 "카테고리: 제목" 형식으로 쓰세요. 예: "일주: 중심축", "신살연결: 날카로움을 쓰는 법", "개운법: 오늘부터 바꿀 것".\n- emoji는 장식일 뿐입니다. 사용자가 섹션 성격을 알 수 있도록 title의 카테고리를 더 중요하게 쓰세요.\n- 각 content는 120~260자 정도로 압축하세요. 한 챕터에서 근거 1~2개와 결론 1개만 선명하게 쓰세요.\n- 같은 근거를 여러 챕터에서 반복하지 마세요.',
  updated_at = NOW()
WHERE is_active = true
  AND service_type NOT IN ('daily', 'chat')
  AND system_prompt NOT LIKE '%## 챕터 구조/분량 가이드 v1.3%';

UPDATE public.prompt_configs
SET
  system_prompt = system_prompt || E'\n\n## 사주 관계성 해석 가이드 v1.3\n- 사주 요소를 단순 나열하지 마세요. "무엇이 있다"가 아니라 "무엇이 무엇과 만나 어떻게 작동한다"를 설명하세요.\n- 신살은 단독으로 풀이하지 마세요. 반드시 위치(년/월/일/시), 일주(일간+일지), 십신, 오행 균형, 대운/세운, 귀인/공망/충합형파해 중 2개 이상과 연결해 해석하세요.\n- 예: 현침살은 "있다"로 끝내지 말고 어느 기둥에 있는지, 일간/식상/관성과 만나 말·글·손기술·비판성으로 살아나는지, 귀인이나 용신이 완화하는지까지 판단하세요.\n- 일주는 최소 1개 챕터에서 반드시 다루세요. 일간의 기본 기질과 일지의 생활/관계 반응이 전체 사주를 어떻게 끌고 가는지 설명하세요.\n- 상쇄/보완 관계를 반드시 넣으세요. 강한 기운이나 신살이 대운, 용신/희신, 귀인, 충합에 의해 증폭되는지 누그러지는지 구분하세요.\n- 겁주는 표현보다 "이 기운을 이렇게 쓰면 장점이 된다"는 식으로 마무리하세요.',
  updated_at = NOW()
WHERE is_active = true
  AND service_type NOT IN ('compatibility', 'business', 'daily', 'chat')
  AND system_prompt NOT LIKE '%## 사주 관계성 해석 가이드 v1.3%';
