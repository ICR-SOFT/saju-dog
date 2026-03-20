import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const CRAWLERS = /bot|crawl|spider|facebook|twitter|kakao|slack|discord|telegram|whatsapp|line|preview|facebookexternalhit|Twitterbot|LinkedInBot/i;

const ANIMAL_MAP: Record<string, string> = {
  '쥐': 'rat', '소': 'ox', '호랑이': 'tiger', '토끼': 'rabbit',
  '용': 'dragon', '뱀': 'snake', '말': 'horse', '양': 'sheep',
  '원숭이': 'monkey', '닭': 'rooster', '개': 'dog', '돼지': 'pig',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const shareId = req.query.shareId as string;
  if (!shareId) return res.status(400).send('Missing shareId');

  const userAgent = req.headers['user-agent'] || '';
  const isCrawler = CRAWLERS.test(userAgent);

  // 브라우저 → SPA로 리다이렉트
  if (!isCrawler) {
    return res.redirect(302, `/share/${shareId}`);
  }

  // 크롤러 → OG 태그 포함 HTML 반환
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );

    const { data } = await supabase
      .from('readings')
      .select('result, service_type, metadata, saju_profiles!profile_id(name, calculated_saju)')
      .eq('share_id', shareId)
      .single();

    const result = data?.result as any;
    const profile = data?.saju_profiles as any;
    const summary = result?.summary || '사주독에서 나만의 운세를 확인해보세요';
    const profileName = profile?.name || '';
    const animal = profile?.calculated_saju?.ddi?.animal;

    const baseUrl = 'https://saju-dog.vercel.app';

    // 이미지 결정
    let imageUrl = `${baseUrl}/images/og-image.png`;
    if (data?.service_type === 'compatibility' || data?.service_type === 'business') {
      imageUrl = `${baseUrl}/images/zodiac/compatibility.png`;
    } else if (animal && ANIMAL_MAP[animal]) {
      imageUrl = `${baseUrl}/images/zodiac/${ANIMAL_MAP[animal]}.png`;
    }

    // 제목 결정
    let title = '사주독 — 사주로 보는 나의 이야기';
    if (data?.service_type === 'compatibility' || data?.service_type === 'business') {
      title = profileName ? `${profileName}님의 궁합 — 사주독` : '궁합 — 사주독';
    } else if (profileName) {
      title = `${profileName}님의 사주풀이 — 사주독`;
    }

    const description = typeof summary === 'string' ? summary.slice(0, 200) : '사주독에서 나만의 운세를 확인해보세요';

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="512" />
  <meta property="og:image:height" content="512" />
  <meta property="og:url" content="${baseUrl}/api/share/${shareId}" />
  <meta property="og:site_name" content="사주독" />
  <meta property="og:locale" content="ko_KR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <link rel="icon" type="image/png" href="${baseUrl}/favicon.png" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <a href="${baseUrl}/api/share/${shareId}">사주독에서 보기</a>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(html);
  } catch (err) {
    // 에러 시 기본 OG
    const html = `<!DOCTYPE html>
<html lang="ko"><head>
  <meta property="og:title" content="사주독 — 사주로 보는 나의 이야기" />
  <meta property="og:image" content="https://saju-dog.vercel.app/images/og-image.png" />
</head><body><a href="https://saju-dog.vercel.app">사주독</a></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
