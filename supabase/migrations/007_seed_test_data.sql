-- 테스트 유저는 Supabase Auth에서 직접 생성 후,
-- 아래 SQL로 프로필 데이터를 추가합니다.
-- test@saju-dog.com / test1234

-- 유저 데이터 (auth.users 생성 후 실행)
-- INSERT INTO public.users (id, nickname) VALUES ('<auth-user-id>', '테스트보호자');

-- 크레딧 99개
-- INSERT INTO public.credits (user_id, bones, treats) VALUES ('<auth-user-id>', 99, 10);

-- 샘플 프로필
-- INSERT INTO public.saju_profiles (user_id, name, relation, birth_date, calendar_type, gender)
-- VALUES ('<auth-user-id>', '라태웅', '본인', '1995-05-07T09:17:00+09:00', 'solar', 'male');
