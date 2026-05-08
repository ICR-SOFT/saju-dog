'use client';

import { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import type { SajuChapter } from '@/types/saju';

interface ChapterAccordionProps {
  chapter: SajuChapter;
  defaultOpen?: boolean;
}

export default function ChapterAccordion({ chapter, defaultOpen = false }: ChapterAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [chapter.content, isOpen]);

  // DOMPurify로 XSS 방지 - 허용된 태그/속성만 통과
  const sanitizedContent = DOMPurify.sanitize(chapter.content, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h3', 'h4', 'ul', 'ol', 'li', 'span'],
    ALLOWED_ATTR: ['class', 'style'],
  });

  // 접혀있을 때 미리보기 텍스트 (HTML 태그 제거한 plain text)
  const previewText = chapter.content.replace(/<[^>]*>/g, '').slice(0, 60);

  return (
    <div className="pixel-card overflow-hidden">
      {/* Header - 제목 항상 전체 표시 */}
      <button
        type="button"
        className="w-full flex flex-col p-4 text-left gap-1"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-lg shrink-0">{chapter.emoji}</span>
            <span className="font-pixel text-xs text-[var(--text-primary)]">
              {chapter.title}
            </span>
          </div>
          <span className="font-pixel text-xs text-[var(--text-muted)] shrink-0 ml-2">
            {isOpen ? '▲' : '▼'}
          </span>
        </div>
        {/* 접혀있을 때 미리보기 */}
        {!isOpen && previewText && (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5 line-clamp-2">
            {previewText}...
          </p>
        )}
      </button>

      {/* Content - DOMPurify 필수 적용 (sanitizedContent만 렌더링) */}
      <div
        style={{
          maxHeight: isOpen ? `${contentHeight}px` : '0px',
          opacity: isOpen ? 1 : 0,
        }}
        className="transition-all duration-300 ease-in-out overflow-hidden"
      >
        <div
          ref={contentRef}
          className="chapter-content px-4 pb-4 text-sm text-[var(--text-secondary)] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      </div>
    </div>
  );
}
