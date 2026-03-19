import { useEffect, useState } from 'react';

const LOADING_IMAGES = [
  '/images/comprehensive.png',
  '/images/compatibility.png',
  '/images/daily.png',
  '/images/chat.png',
];

export function PhotoLoading() {
  // Each slot cycles through images at different offsets
  const [indices, setIndices] = useState([0, 1, 2, 3]);
  const [fade, setFade] = useState([true, true, true, true]);

  useEffect(() => {
    const intervals = indices.map((_, slotIndex) => {
      const delay = 300 + slotIndex * 150; // staggered timing
      return setInterval(() => {
        // Trigger fade-out
        setFade(prev => {
          const next = [...prev];
          next[slotIndex] = false;
          return next;
        });

        // After fade-out, change image and fade-in
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

    return () => intervals.forEach(clearInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Photo booth frame */}
      <div className="bg-white rounded-2xl p-3 shadow-lg border-2 border-cream-dark">
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
        복돌이가 열심히 분석 중
        <span className="typing-dots">
          <span className="dot">.</span>
          <span className="dot">.</span>
          <span className="dot">.</span>
        </span>
      </p>
    </div>
  );
}
