import type { MetadataRoute } from 'next';

const BASE_URL = 'https://saju-dog.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { url: BASE_URL, changeFrequency: 'daily' as const, priority: 1.0 },
    { url: `${BASE_URL}/login`, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${BASE_URL}/daily`, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${BASE_URL}/compatibility`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${BASE_URL}/chat`, changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${BASE_URL}/groups`, changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${BASE_URL}/shop`, changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${BASE_URL}/archive`, changeFrequency: 'daily' as const, priority: 0.6 },
  ];

  return staticPages.map((page) => ({
    ...page,
    lastModified: new Date(),
  }));
}
