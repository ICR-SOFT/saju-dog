import { supabase } from './supabase.ts';

export function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export async function createShareLink(readingId: string): Promise<string> {
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
    .select('*')
    .eq('share_id', shareId)
    .single();
  if (error) throw error;
  return data;
}
