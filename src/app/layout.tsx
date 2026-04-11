import type { Metadata } from 'next';
import ToastProvider from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: '사주독 - 사주 풀이',
  description: '멍도령과 함께하는 사주 풀이 서비스',
  icons: {
    icon: '/favicon.ico.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: '사주독 - 사주 풀이',
    description: '멍도령과 함께하는 사주 풀이 서비스',
    images: [{ url: '/images/og-image-pixel.png', width: 1200, height: 630 }],
    type: 'website',
  },
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
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
