import { useState } from 'react';
import DOMPurify from 'dompurify';
import type { SajuChapter } from '@/types/saju.ts';
import { Card } from '../ui/Card.tsx';

interface ChapterAccordionProps {
  chapters: SajuChapter[];
}

export function ChapterAccordion({ chapters }: ChapterAccordionProps) {
  const safeChapters = Array.isArray(chapters) ? chapters : [];
  // Set으로 여러 개 동시 오픈
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    return safeChapters[0] ? new Set([safeChapters[0].id]) : new Set();
  });

  if (safeChapters.length === 0) return null;

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {safeChapters.map(chapter => {
        const isOpen = openIds.has(chapter.id);
        return (
          <Card key={chapter.id} padding="sm" className="overflow-hidden">
            <button
              onClick={() => toggle(chapter.id)}
              className="w-full flex items-center justify-between py-2 px-1 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{chapter.emoji}</span>
                <span className="font-medium text-dark text-sm">{chapter.title}</span>
              </div>
              <span className={`text-warm-gray transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>
            {isOpen && (
              <div
                className="px-1 pb-2 text-sm text-dark-light leading-relaxed"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(chapter.content) }}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}
