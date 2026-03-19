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
  const { addProfile } = useSajuStore();
  const [isLoading, setIsLoading] = useState(false);

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

      // 프로필 저장
      const profile = await addProfile({
        name: form.name,
        relation: form.relation,
        birth_date: birthDate.toISOString(),
        calendar_type: form.calendarType,
        gender: form.gender,
        use_true_solar: true,
        birth_city: '서울',
        longitude: 126.978,
      });

      // calculated_saju 업데이트
      await supabase
        .from('saju_profiles')
        .update({ calculated_saju: sajuResult })
        .eq('id', profile.id);

      navigate('/');
    } catch (err) {
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
      <h2 className="text-xl font-bold text-dark mb-4 font-serif">프로필 등록</h2>

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
              className="w-full rounded-xl border border-warm-gray-light/50 bg-white px-4 py-2.5 text-dark outline-none focus:border-brown"
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
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    form.gender === g
                      ? 'bg-brown text-cream'
                      : 'bg-cream-dark text-warm-gray'
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
                type="number"
                value={form.birthYear}
                onChange={e => updateField('birthYear', e.target.value)}
                placeholder="년"
                min="1900"
                max="2100"
                required
              />
              <Input
                type="number"
                value={form.birthMonth}
                onChange={e => updateField('birthMonth', e.target.value)}
                placeholder="월"
                min="1"
                max="12"
                required
              />
              <Input
                type="number"
                value={form.birthDay}
                onChange={e => updateField('birthDay', e.target.value)}
                placeholder="일"
                min="1"
                max="31"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-light block mb-1.5">태어난 시간</label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                value={form.birthHour}
                onChange={e => updateField('birthHour', e.target.value)}
                placeholder="시 (0-23)"
                min="0"
                max="23"
              />
              <Input
                type="number"
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
                { value: 'solar', label: '양력' },
                { value: 'lunar', label: '음력' },
              ] as const).map(cal => (
                <button
                  key={cal.value}
                  type="button"
                  onClick={() => updateField('calendarType', cal.value)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    form.calendarType === cal.value
                      ? 'bg-brown text-cream'
                      : 'bg-cream-dark text-warm-gray'
                  }`}
                >
                  {cal.label}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" size="lg" isLoading={isLoading}>
            등록하기
          </Button>
        </form>
      </Card>
    </Layout>
  );
}
