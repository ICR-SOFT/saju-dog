import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ANIMAL_MAP: Record<string, string> = {
  '쥐': 'rat', '소': 'ox', '호랑이': 'tiger', '토끼': 'rabbit',
  '용': 'dragon', '뱀': 'snake', '말': 'horse', '양': 'sheep',
  '원숭이': 'monkey', '닭': 'rooster', '개': 'dog', '돼지': 'pig',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const shareId = req.query.shareId as string;
  if (!shareId) return res.status(400).send('Missing shareId');

  const baseUrl = 'https://saju-dog.vercel.app';
  const spaUrl = `${baseUrl}/share/${shareId}`;

  let title = '사주독 — 사주로 보는 나의 이야기';
  let description = '사주독에서 나만의 운세를 확인해보세요';
  let imageUrl = `${baseUrl}/images/og-image.png`;

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );

    const { data } = await supabase
      .from('readings')
      .select('result, service_type, profile_id, secondary_profile_id, metadata, saju_profiles!profile_id(name, calculated_saju)')
      .eq('share_id', shareId)
      .single();

    if (data) {
      const result = data.result as any;
      const profile = data.saju_profiles as any;
      const profileName = profile?.name || '';
      const animal = profile?.calculated_saju?.ddi?.animal;
      const isCompat = data.service_type === 'compatibility' || data.service_type === 'business';

      // 이미지
      if (isCompat) {
        imageUrl = `${baseUrl}/images/zodiac/compatibility.png`;
      } else if (animal && ANIMAL_MAP[animal]) {
        imageUrl = `${baseUrl}/images/zodiac/${ANIMAL_MAP[animal]}.png`;
      }

      // 설명
      if (result?.summary) {
        description = String(result.summary).slice(0, 200);
      }

      // 제목
      if (isCompat) {
        const names: string[] = [];
        if (profileName) names.push(profileName);
        if (data.secondary_profile_id) {
          const { data: sec } = await supabase.from('saju_profiles').select('name').eq('id', data.secondary_profile_id).single();
          if (sec?.name) names.push(sec.name);
        }
        const meta = data.metadata as any;
        if (meta?.allProfileIds) {
          try {
            for (const id of JSON.parse(meta.allProfileIds) as string[]) {
              if (id !== data.profile_id && id !== data.secondary_profile_id) {
                const { data: ep } = await supabase.from('saju_profiles').select('name').eq('id', id).single();
                if (ep?.name && !names.includes(ep.name)) names.push(ep.name);
              }
            }
          } catch {}
        }
        title = names.length > 0 ? `${names.join(' × ')}님의 궁합 — 사주독` : '궁합 — 사주독';
      } else if (profileName) {
        title = `${profileName}님의 사주풀이 — 사주독`;
      }
    }
  } catch {}

  // 항상 OG 태그 + 1.5초 후 리다이렉트
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="512" />
  <meta property="og:image:height" content="512" />
  <meta property="og:url" content="${baseUrl}/api/share/${shareId}" />
  <meta property="og:site_name" content="사주독" />
  <meta property="og:locale" content="ko_KR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <link rel="icon" type="image/png" href="${baseUrl}/favicon.png" />
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #F5F0E8; font-family: -apple-system, sans-serif; }
    .wrap { text-align: center; padding: 2rem; }
    .logo { width: 60px; height: 60px; border-radius: 50%; margin-bottom: 1rem; }
    h1 { font-size: 1.2rem; color: #2C2420; margin: 0.5rem 0; }
    p { font-size: 0.9rem; color: #8B7E75; }
    .spinner { width: 24px; height: 24px; border: 3px solid #E8DFD3; border-top-color: #C67A3C; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 1rem auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="wrap">
    <img src="${baseUrl}/images/logo.png" alt="사주독" class="logo" />
    <h1>🐕 사주독</h1>
    <div class="spinner"></div>
    <p>풀이를 불러오는 중...</p>
  </div>
  <script>setTimeout(function(){ window.location.replace("${spaUrl}"); }, 1500);</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60');
  return res.status(200).send(html);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
