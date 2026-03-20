import { supabase } from './supabase.ts';

export function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export async function createShareLink(readingId: string): Promise<string> {
  // 이미 share_id가 있으면 재사용
  const { data: existing } = await supabase
    .from('readings')
    .select('share_id')
    .eq('id', readingId)
    .single();

  if (existing?.share_id) {
    return `${window.location.origin}/share/${existing.share_id}`;
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

  return `${window.location.origin}/share/${data.share_id}`;
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
