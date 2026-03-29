import { useState, useEffect } from 'react';

const MESSAGES = [
  '멍도령이 사주를 분석하고 있어요 🔍',
  '오행의 균형을 살펴보는 중... ⚖️',
  '신살과 귀인을 확인하고 있어요 ⭐',
  '대운의 흐름을 읽는 중... 🌊',
  '챕터를 정성스럽게 작성 중이에요 ✍️',
  '거의 다 됐어요! 조금만 기다려주세요 🐕',
  '합충 관계를 꼼꼼히 체크 중... ⚡',
  '멍도령이 열심히 풀이하고 있어요 🔮',
];

export function LoadingMessages() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="text-xs text-warm-gray animate-pulse-warm transition-all">
      {MESSAGES[index]}
    </p>
  );
}
