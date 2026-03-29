import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { calculateSaju } from '@/core/calculator.ts';
import { supabase } from '@/lib/supabase.ts';
import type { Gender, CalendarType } from '@/types/saju.ts';

export function AddProfile() {
  const navigate = useNavigate();
  void useSajuStore; // fetchProfiles는 아래서 직접 호출
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    relation: '본인',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    birthHour: '',
    birthMinute: '',
    gender: 'male' as Gender,
    calendarType: 'solar' as CalendarType,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 수동 validation
    if (!form.name.trim()) { setError('이름을 입력해주세요'); return; }
    if (!form.birthYear || !form.birthMonth || !form.birthDay) { setError('생년월일을 입력해주세요'); return; }
    const y = Number(form.birthYear), m = Number(form.birthMonth), d = Number(form.birthDay);
    if (y < 1900 || y > 2100) { setError('올바른 연도를 입력해주세요'); return; }
    if (m < 1 || m > 12) { setError('올바른 월을 입력해주세요'); return; }
    if (d < 1 || d > 31) { setError('올바른 일을 입력해주세요'); return; }

    setIsLoading(true);

    try {
      const birthDate = new Date(
        Number(form.birthYear),
        Number(form.birthMonth) - 1,
        Number(form.birthDay),
        Number(form.birthHour) || 0,
        Number(form.birthMinute) || 0,
      );

      // 만세력 계산
      const sajuResult = calculateSaju({
        name: form.name,
        birthDate,
        gender: form.gender,
        calendarType: form.calendarType,
        useTrueSolar: true,
        longitude: 126.978,
      });

      // 세션 확인 후 프로필 저장
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다');
      const user = session.user;

      const { error: insertError } = await supabase
        .from('saju_profiles')
        .insert({
          user_id: user.id,
          name: form.name,
          relation: form.relation,
          birth_date: birthDate.toISOString(),
          calendar_type: form.calendarType,
          gender: form.gender,
          use_true_solar: true,
          birth_city: '서울',
          longitude: 126.978,
          calculated_saju: JSON.parse(JSON.stringify(sajuResult)),
        })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      // 스토어에도 추가 + 새 프로필 선택
      await useSajuStore.getState().fetchProfiles();
      const newProfiles = useSajuStore.getState().profiles;
      useSajuStore.getState().selectProfile(newProfiles.length - 1);

      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '프로필 등록에 실패했어요';
      setError(msg);
      console.error('프로필 추가 실패:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Layout>
      {/* 헤더 */}
      <div className="text-center mb-5 -mx-4 -mt-4 px-4 pt-6 pb-5 gradient-hero rounded-b-3xl">
        <span className="text-3xl">🐾</span>
        <h2 className="text-xl font-bold text-dark font-serif mt-1">새 프로필 등록</h2>
        <p className="text-sm text-warm-gray mt-1">사주 분석을 위한 정보를 입력해주세요</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="이름"
            value={form.name}
            onChange={e => updateField('name', e.target.value)}
            placeholder="이름을 입력하세요"
            required
          />

          <div>
            <label className="text-sm font-medium text-dark-light block mb-1.5">관계</label>
            <select
              className="w-full rounded-xl border border-warm-gray-light/50 bg-cream px-4 py-2.5 text-dark outline-none focus:border-brown focus:ring-1 focus:ring-brown/20 text-sm transition-all"
              value={form.relation}
              onChange={e => updateField('relation', e.target.value)}
            >
              <option value="본인">본인</option>
              <option value="배우자">배우자</option>
              <option value="자녀">자녀</option>
              <option value="부모">부모</option>
              <option value="친구">친구</option>
              <option value="기타">기타</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-light block mb-1.5">성별</label>
            <div className="flex gap-2">
              {(['male', 'female'] as const).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => updateField('gender', g)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                    form.gender === g
                      ? 'bg-brown text-cream border-brown shadow-md'
                      : 'bg-cream text-warm-gray border-warm-gray-light/20 hover:border-brown/30'
                  }`}
                >
                  {g === 'male' ? '👦 남성' : '👧 여성'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-light block mb-1.5">생년월일</label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="text"
                inputMode="numeric"
                value={form.birthYear}
                onChange={e => updateField('birthYear', e.target.value)}
                placeholder="년"
              />
              <Input
                type="text"
                inputMode="numeric"
                value={form.birthMonth}
                onChange={e => updateField('birthMonth', e.target.value)}
                placeholder="월"
              />
              <Input
                type="text"
                inputMode="numeric"
                value={form.birthDay}
                onChange={e => updateField('birthDay', e.target.value)}
                placeholder="일"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-light block mb-1.5">태어난 시간</label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="text" inputMode="numeric"
                value={form.birthHour}
                onChange={e => updateField('birthHour', e.target.value)}
                placeholder="시 (0-23)"
                min="0"
                max="23"
              />
              <Input
                type="text" inputMode="numeric"
                value={form.birthMinute}
                onChange={e => updateField('birthMinute', e.target.value)}
                placeholder="분 (0-59)"
                min="0"
                max="59"
              />
            </div>
            <p className="text-xs text-warm-gray mt-1">모르시면 비워두세요 (정오 기준)</p>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-light block mb-1.5">달력</label>
            <div className="flex gap-2">
              {([
                { value: 'solar', label: '☀️ 양력' },
                { value: 'lunar', label: '🌙 음력' },
              ] as const).map(cal => (
                <button
                  key={cal.value}
                  type="button"
                  onClick={() => updateField('calendarType', cal.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                    form.calendarType === cal.value
                      ? 'bg-brown text-cream border-brown shadow-md'
                      : 'bg-cream text-warm-gray border-warm-gray-light/20 hover:border-brown/30'
                  }`}
                >
                  {cal.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center bg-red-900/20 rounded-xl p-2">{error}</p>
          )}

          <Button type="submit" size="lg" isLoading={isLoading}>
            등록하기
          </Button>
        </form>
      </Card>

      {/* 도움말 카드 */}
      <Card className="mt-4 bg-gradient-to-br from-amber-900/20 to-yellow-900/15 border-amber-500/20" padding="sm">
        <div className="flex items-start gap-2">
          <span className="text-lg">💡</span>
          <div>
            <p className="text-xs font-medium text-dark mb-1">정확한 사주를 위한 팁</p>
            <p className="text-xs text-warm-gray leading-relaxed">
              태어난 시간을 정확히 입력하면 시주까지 반영된 더 정확한 사주풀이를 받을 수 있어요.
              시간을 모르시면 비워두셔도 괜찮아요!
            </p>
          </div>
        </div>
      </Card>
    </Layout>
  );
}
