import type { Metadata } from 'next';
import ToastProvider from '@/components/ui/Toast';
import JsonLd from './jsonld';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '사주독 - 사주 풀이 서비스',
    template: '%s | 사주독',
  },
  description: '멍도령과 함께하는 사주 풀이 서비스. 종합 사주, 궁합, 오늘의 운세, 재물운, 연애운 등 전통 명리학 기반 사주 상담.',
  keywords: ['사주', '사주풀이', '운세', '궁합', '오늘의운세', '무료운세', '사주독', '멍도령', '대운', '재물운', '연애운', '직업운', '사주상담'],
  authors: [{ name: '사주독' }],
  creator: '사주독',
  metadataBase: new URL('https://saju-dog.vercel.app'),
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: '사주독 - 사주 풀이 서비스',
    description: '멍도령과 함께하는 사주 풀이 서비스. 종합 사주, 궁합, 오늘의 운세부터 재물운, 연애운까지!',
    images: [{ url: '/images/og-image-pixel.png', width: 1200, height: 630 }],
    type: 'website',
    siteName: '사주독',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '사주독 - 사주 풀이 서비스',
    description: '멍도령과 함께하는 사주 풀이 서비스',
    images: ['/images/og-image-pixel.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  verification: {},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          href="https://cdn.jsdelivr.net/gh/quiple/galmuri/dist/galmuri.css"
          rel="stylesheet"
        />
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <JsonLd />
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
