import { supabase } from './supabase.ts';

export function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export async function createShareLink(readingId: string): Promise<string> {
  const shareId = generateShareId();
  const { error } = await supabase
    .from('readings')
    .update({ share_id: shareId })
    .eq('id', readingId);
  if (error) throw error;
  return `${window.location.origin}/share/${shareId}`;
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
