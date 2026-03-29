import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { calculateSaju } from '@/core/calculator.ts';
import { supabase } from '@/lib/supabase.ts';
import type { Gender, CalendarType } from '@/types/saju.ts';

export function EditProfile() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const { profiles, fetchProfiles } = useSajuStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const profile = profiles.find(p => p.id === profileId);

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

  useEffect(() => {
    if (profile) {
      const bd = new Date(profile.birth_date);
      setForm({
        name: profile.name,
        relation: profile.relation,
        birthYear: String(bd.getFullYear()),
        birthMonth: String(bd.getMonth() + 1),
        birthDay: String(bd.getDate()),
        birthHour: String(bd.getHours()),
        birthMinute: String(bd.getMinutes()),
        gender: profile.gender as Gender,
        calendarType: profile.calendar_type as CalendarType,
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) return;
    setIsLoading(true);
    setError('');

    try {
      const birthDate = new Date(
        Number(form.birthYear),
        Number(form.birthMonth) - 1,
        Number(form.birthDay),
        Number(form.birthHour) || 0,
        Number(form.birthMinute) || 0,
      );

      const sajuResult = calculateSaju({
        name: form.name,
        birthDate,
        gender: form.gender,
        calendarType: form.calendarType,
        useTrueSolar: true,
        longitude: 126.978,
      });

      const { error: updateError } = await supabase
        .from('saju_profiles')
        .update({
          name: form.name,
          relation: form.relation,
          birth_date: birthDate.toISOString(),
          calendar_type: form.calendarType,
          gender: form.gender,
          calculated_saju: JSON.parse(JSON.stringify(sajuResult)),
        })
        .eq('id', profileId);

      if (updateError) throw new Error(updateError.message);

      await fetchProfiles();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정에 실패했어요');
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (!profile) {
    return (
      <Layout>
        <Card className="text-center py-12">
          <p className="text-warm-gray">프로필을 찾을 수 없습니다</p>
          <Button onClick={() => navigate('/')} className="mt-3">홈으로</Button>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="text-center mb-5 -mx-4 -mt-4 px-4 pt-6 pb-5 gradient-hero rounded-b-3xl">
        <span className="text-3xl">✏️</span>
        <h2 className="text-xl font-bold text-dark font-serif mt-1">프로필 수정</h2>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="이름" value={form.name} onChange={e => updateField('name', e.target.value)} required />

          <div>
            <label className="text-sm font-medium text-dark-light block mb-1.5">관계</label>
            <select
              className="w-full rounded-xl border border-warm-gray-light/50 bg-cream px-4 py-2.5 text-dark outline-none focus:border-brown text-sm"
              value={form.relation}
              onChange={e => updateField('relation', e.target.value)}
            >
              {['본인', '배우자', '자녀', '부모', '친구', '기타'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-light block mb-1.5">성별</label>
            <div className="flex gap-2">
              {(['male', 'female'] as const).map(g => (
                <button key={g} type="button" onClick={() => updateField('gender', g)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                    form.gender === g ? 'bg-brown text-cream border-brown shadow-md' : 'bg-cream text-warm-gray border-warm-gray-light/20'
                  }`}>
                  {g === 'male' ? '👦 남성' : '👧 여성'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-light block mb-1.5">생년월일</label>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" value={form.birthYear} onChange={e => updateField('birthYear', e.target.value)} placeholder="년" required />
              <Input type="number" value={form.birthMonth} onChange={e => updateField('birthMonth', e.target.value)} placeholder="월" required />
              <Input type="number" value={form.birthDay} onChange={e => updateField('birthDay', e.target.value)} placeholder="일" required />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-light block mb-1.5">태어난 시간</label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" value={form.birthHour} onChange={e => updateField('birthHour', e.target.value)} placeholder="시" />
              <Input type="number" value={form.birthMinute} onChange={e => updateField('birthMinute', e.target.value)} placeholder="분" />
            </div>
          </div>

          {error && <p className="text-sm text-red-500 text-center bg-red-900/20 rounded-xl p-2">{error}</p>}

          <Button type="submit" size="lg" isLoading={isLoading}>저장하기</Button>
        </form>
      </Card>
    </Layout>
  );
}
