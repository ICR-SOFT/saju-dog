'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface Banner {
  image: string;
  title: string;
  subtitle: string;
  path: string;
}

const BANNERS: Banner[] = [
  {
    image: '/images/banners/comprehensive.png',
    title: '종합 사주 풀이',
    subtitle: '타고난 운명을 12챕터로 깊이 풀어드려요',
    path: '/reading/:profileId?service=comprehensive',
  },
  {
    image: '/images/banners/compatibility.png',
    title: '궁합 분석',
    subtitle: '두 사람의 인연과 케미를 확인해보세요',
    path: '/compatibility',
  },
  {
    image: '/images/banners/daily.png',
    title: '오늘의 운세',
    subtitle: '매일 무료로 확인하는 오늘의 운세',
    path: '/daily',
  },
  {
    image: '/images/banners/wealth.png',
    title: '재물운 분석',
    subtitle: '돈이 들어오는 시기와 방향을 알려드려요',
    path: '/reading/:profileId?service=wealth',
  },
  {
    image: '/images/banners/group.png',
    title: '그룹 사주',
    subtitle: '팀/모임의 케미를 한 번에 분석해요',
    path: '/groups',
  },
];

interface BannerSliderProps {
  onNavigate: (path: string) => void;
}

export default function BannerSlider({ onNavigate }: BannerSliderProps) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % BANNERS.length);
  }, []);

  // Auto-slide every 4 seconds
  useEffect(() => {
    const timer = setInterval(next, 4000);
    return () => clearInterval(timer);
  }, [next]);

  const banner = BANNERS[current];

  return (
    <section className="mb-4">
      <button
        type="button"
        className="service-card relative w-full overflow-hidden"
        style={{ aspectRatio: '2/1' }}
        onClick={() => onNavigate(banner.path)}
      >
        <Image
          src={banner.image}
          alt={banner.title}
          fill
          className="object-cover transition-opacity duration-500"
          sizes="480px"
          priority={current === 0}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div
          className="absolute bottom-0 left-0 right-0 p-3"
          style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}
        >
          <p className="font-pixel text-sm text-white font-bold">{banner.title}</p>
          <p className="text-[10px] text-white/90 mt-0.5">{banner.subtitle}</p>
        </div>

        {/* Dots indicator */}
        <div className="absolute bottom-1.5 right-3 flex gap-1">
          {BANNERS.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === current ? 'bg-white w-3' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      </button>
    </section>
  );
}
