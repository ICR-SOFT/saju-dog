import { useState } from 'react';
import DOMPurify from 'dompurify';
import type { SajuChapter } from '@/types/saju.ts';
import { Card } from '../ui/Card.tsx';

interface ChapterAccordionProps {
  chapters: SajuChapter[];
}

export function ChapterAccordion({ chapters }: ChapterAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(chapters[0]?.id ?? null);

  return (
    <div className="space-y-2">
      {chapters.map(chapter => {
        const isOpen = openId === chapter.id;
        return (
          <Card key={chapter.id} padding="sm" className="overflow-hidden">
            <button
              onClick={() => setOpenId(isOpen ? null : chapter.id)}
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
