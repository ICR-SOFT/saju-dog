'use client';

import { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import type { SajuChapter, ServiceType } from '@/types/saju';

interface ChapterAccordionProps {
  chapter: SajuChapter;
  defaultOpen?: boolean;
  serviceType?: ServiceType;
  index?: number;
}

const CATEGORY_BY_SERVICE: Partial<Record<ServiceType, string[]>> = {
  comprehensive: ['핵심', '일주', '신살연결', '오행', '재물', '직업', '관계', '건강', '흐름', '개운법'],
  compatibility: ['관계요약', '성향차이', '오행궁합', '소통', '갈등', '생활궁합', '현실조언', '개운법'],
  business: ['관계요약', '역할분담', '강점조합', '의사결정', '갈등관리', '돈/책임', '운영법', '개운법'],
  daeun: ['핵심흐름', '현재대운', '전환점', '상승기', '주의기', '개운법'],
  yearly: ['올해핵심', '상반기', '하반기', '일/돈', '관계', '주의점', '개운법'],
  luckyday: ['핵심', '길일', '피할날', '월별흐름', '준비법', '개운법'],
  love: ['핵심', '연애성향', '인연시기', '관계패턴', '주의점', '개운법'],
  wealth: ['핵심', '돈버는방식', '수입흐름', '투자주의', '타이밍', '개운법'],
  health: ['핵심', '체질흐름', '주의부위', '생활습관', '회복법', '개운법'],
  career: ['핵심', '적성', '강점', '업무방식', '이직타이밍', '개운법'],
  pastlife: ['핵심', '전생상징', '현재영향', '반복패턴', '풀어낼점', '개운법'],
  moving: ['핵심', '이사운', '좋은방위', '피할방위', '시기', '개운법'],
  mbti: ['핵심유형', '에너지', '판단방식', '관계방식', '강점주의', '개운법'],
  pet: ['핵심', '맞는동물', '생활궁합', '주의점', '추천품종', '개운법'],
  travel: ['핵심', '좋은방위', '여행시기', '여행스타일', '주의점', '개운법'],
  food: ['핵심', '식복', '맞는음식', '피할음식', '루틴', '개운법'],
  color: ['핵심', '메인컬러', '보조컬러', '피할색', '활용법', '개운법'],
  study: ['핵심', '학습성향', '집중법', '시험운', '주의점', '개운법'],
  ancestor: ['핵심', '가문기운', '부모월주', '음덕', '물려받은재능', '개운법'],
  child: ['핵심', '자녀기운', '양육궁합', '시기', '주의점', '개운법'],
  secret: ['핵심', '숨은재능', '막힌지점', '발현시기', '활용법', '개운법'],
  timing: ['핵심', '결정타이밍', '황금기', '보류기', '준비법', '개운법'],
};

const TITLE_CATEGORY_PATTERN = /^([가-힣A-Za-z0-9/·& ]{2,12})\s*[:：]\s*(.+)$/;

function inferCategory(chapter: SajuChapter, serviceType?: ServiceType, index = 0) {
  const titleMatch = chapter.title?.match(TITLE_CATEGORY_PATTERN);
  if (titleMatch) return { category: titleMatch[1].trim(), title: titleMatch[2].trim() };

  const labels = serviceType ? CATEGORY_BY_SERVICE[serviceType] : undefined;
  return { category: labels?.[index] || `섹션 ${index + 1}`, title: chapter.title };
}

export default function ChapterAccordion({ chapter, defaultOpen = false, serviceType, index = 0 }: ChapterAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const { category, title } = inferCategory(chapter, serviceType, index);

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
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-pixel text-[10px] text-[var(--accent)] shrink-0">
              {category}
            </span>
            <span className="text-base shrink-0" aria-hidden="true">{chapter.emoji}</span>
            <span className="font-pixel text-xs text-[var(--text-primary)] min-w-0 leading-snug">
              {title}
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
