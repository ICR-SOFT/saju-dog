import { useState } from 'react';
import { Button } from './Button.tsx';
import { Logo } from './Logo.tsx';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  cost: number;
  bones: number;
  onConfirm: (question: string) => void;
  onCancel: () => void;
}

export function ConfirmModal({ isOpen, title, cost, bones, onConfirm, onCancel }: ConfirmModalProps) {
  const [question, setQuestion] = useState('');

  if (!isOpen) return null;

  const canAfford = bones >= cost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />

      {/* 모달 */}
      <div className="relative bg-cream-dark rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4 animate-fade-in border border-warm-gray-light/20">
        <div className="text-center">
          <Logo size="md" className="mx-auto" />
          <h3 className="text-lg font-bold text-dark font-serif mt-2">{title}</h3>
        </div>

        {/* 비용 정보 */}
        <div className="bg-cream-dark rounded-xl p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-warm-gray">비용</span>
            <span className="font-medium text-dark">{cost > 0 ? `🦴 ${cost}개` : '무료'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-warm-gray">보유</span>
            <span className={`font-medium ${canAfford ? 'text-green-600' : 'text-red-500'}`}>
              🦴 {bones}개
            </span>
          </div>
        </div>

        {/* 질문 입력 */}
        <div>
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value.slice(0, 80))}
            placeholder="궁금한 점이 있다면 한 줄로 적어주세요 (선택)"
            className="w-full rounded-xl border border-warm-gray-light/50 bg-cream px-4 py-2.5 text-dark text-sm outline-none focus:border-brown placeholder:text-warm-gray-light"
            maxLength={80}
          />
          {question && (
            <p className="text-[10px] text-warm-gray text-right mt-0.5">{question.length}/80</p>
          )}
        </div>

        {!canAfford && (
          <p className="text-sm text-red-500 text-center">뼈다귀가 부족합니다</p>
        )}

        {/* 버튼 */}
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={onCancel} className="flex-1">
            취소
          </Button>
          <Button
            size="md"
            onClick={() => onConfirm(question.trim())}
            disabled={!canAfford}
            className="flex-1"
          >
            {cost > 0 ? `🦴 ${cost} 풀이받기` : '풀이받기'}
          </Button>
        </div>
      </div>
    </div>
  );
}
