import { supabase } from './supabase.ts';

export function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10);
}

async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // 세션 갱신 시도
    const { error } = await supabase.auth.refreshSession();
    if (error) throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
  }
}

export async function createShareLink(readingId: string): Promise<string> {
  await ensureSession();

  // 이미 share_id가 있으면 재사용
  const { data: existing, error: fetchErr } = await supabase
    .from('readings')
    .select('share_id')
    .eq('id', readingId)
    .single();

  if (fetchErr) throw new Error(`조회 실패: ${fetchErr.message}`);

  if (existing?.share_id) {
    return `${window.location.origin}/api/share/${existing.share_id}`;
  }

  // 없으면 새로 생성
  const shareId = generateShareId();
  const { data, error } = await supabase
    .from('readings')
    .update({ share_id: shareId })
    .eq('id', readingId)
    .select('share_id')
    .single();

  if (error) throw new Error(`공유 링크 생성 실패: ${error.message}`);
  if (!data?.share_id) throw new Error('공유 링크가 저장되지 않았습니다');

  return `${window.location.origin}/api/share/${data.share_id}`;
}

export async function getSharedReading(shareId: string) {
  const { data, error } = await supabase
    .from('readings')
    .select('*, saju_profiles!profile_id(name, gender, birth_date, calendar_type, calculated_saju)')
    .eq('share_id', shareId)
    .single();
  if (error) throw error;
  return data;
}
