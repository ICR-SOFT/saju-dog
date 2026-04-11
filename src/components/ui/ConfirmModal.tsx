'use client';

import { useEffect, useRef, useState } from 'react';
import Button from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (question?: string) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  showQuestion?: boolean;
  disabled?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  showQuestion = false,
  disabled = false,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [question, setQuestion] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
      setQuestion('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[100] m-auto p-0 bg-transparent backdrop:bg-black/50"
      onClose={onClose}
    >
      <div className="pixel-border bg-[var(--bg-primary)] p-5 w-[min(320px,85vw)] flex flex-col gap-4">
        <h2 className="font-pixel text-sm text-[var(--text-primary)] text-center">
          {title}
        </h2>

        <p className="text-sm text-[var(--text-secondary)] text-center leading-relaxed">
          {message}
        </p>

        {showQuestion && (
          <div>
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value.slice(0, 80))}
              placeholder="궁금한 점이 있다면 한 줄로 적어주세요 (선택)"
              className="w-full border-2 border-[var(--pixel-border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]"
              maxLength={80}
            />
            {question && (
              <p className="text-[10px] text-[var(--text-muted)] text-right mt-0.5">{question.length}/80</p>
            )}
          </div>
        )}

        {disabled && (
          <p className="text-sm text-[var(--error)] text-center">뼈다귀가 부족합니다</p>
        )}

        <div className="flex gap-3 mt-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            disabled={disabled}
            onClick={() => {
              onConfirm(question.trim() || undefined);
              onClose();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
