// JSON-LD structured data for SEO - content is static/trusted, not user-generated
export default function JsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '사주독',
    alternateName: 'SajuDog',
    description: '멍도령과 함께하는 사주 풀이 서비스. 종합 사주, 궁합, 오늘의 운세, 재물운, 연애운 등.',
    url: 'https://saju-dog.vercel.app',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'KRW',
      description: '오늘의 운세 무료',
    },
    inLanguage: 'ko',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
