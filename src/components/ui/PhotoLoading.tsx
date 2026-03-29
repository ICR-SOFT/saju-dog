import { useEffect, useState, useRef } from 'react';

const LOADING_IMAGES = [
  '/images/comprehensive.png',
  '/images/compatibility.png',
  '/images/daily.png',
  '/images/chat.png',
  '/images/daeun.png',
  '/images/yearly.png',
  '/images/luckyday.png',
  '/images/love.png',
  '/images/wealth.png',
  '/images/health.png',
  '/images/career.png',
  '/images/business.png',
  '/images/pastlife.png',
  '/images/moving.png',
];

// 이미지 프리로드 캐시 (컴포넌트 밖에서 1회만 실행)
const imageCache: HTMLImageElement[] = [];
if (imageCache.length === 0) {
  for (const src of LOADING_IMAGES) {
    const img = new Image();
    img.src = src;
    imageCache.push(img);
  }
}

export function PhotoLoading() {
  const [indices, setIndices] = useState([0, 1, 2, 3]);
  const [fade, setFade] = useState([true, true, true, true]);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    intervalsRef.current = indices.map((_, slotIndex) => {
      const delay = 300 + slotIndex * 150;
      return setInterval(() => {
        setFade(prev => {
          const next = [...prev];
          next[slotIndex] = false;
          return next;
        });

        setTimeout(() => {
          setIndices(prev => {
            const next = [...prev];
            next[slotIndex] = (next[slotIndex] + 1) % LOADING_IMAGES.length;
            return next;
          });
          setFade(prev => {
            const next = [...prev];
            next[slotIndex] = true;
            return next;
          });
        }, 150);
      }, delay + 400);
    });

    return () => intervalsRef.current.forEach(clearInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Photo booth frame */}
      <div className="bg-cream-dark rounded-2xl p-3 shadow-lg border-2 border-warm-gray-light/20">
        <div className="grid grid-cols-2 gap-2">
          {indices.map((imgIndex, slot) => (
            <div
              key={slot}
              className="w-28 h-28 rounded-xl overflow-hidden bg-cream-dark relative"
            >
              <img
                src={LOADING_IMAGES[imgIndex]}
                alt=""
                className="w-full h-full object-cover transition-opacity duration-150"
                style={{ opacity: fade[slot] ? 1 : 0 }}
              />
              <div className="absolute inset-0 shimmer pointer-events-none" />
            </div>
          ))}
        </div>
      </div>

      {/* Typing dots text */}
      <p className="text-sm text-warm-gray flex items-center gap-1">
        멍도령이 열심히 분석 중
        <span className="typing-dots">
          <span className="dot">.</span>
          <span className="dot">.</span>
          <span className="dot">.</span>
        </span>
      </p>
    </div>
  );
}
