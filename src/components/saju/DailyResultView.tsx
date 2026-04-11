'use client';

import DOMPurify from 'dompurify';
import Recommendations from './Recommendations';

interface DailyCategory {
  score: number;
  message: string;
}

interface DailyResultData {
  summary?: string;
  overallLuck?: number;
  overallScore?: number;
  categories?: {
    love?: DailyCategory;
    money?: DailyCategory;
    work?: DailyCategory;
    health?: DailyCategory;
  };
  advice?: string | string[];
  luckyItems?: { color?: string; number?: string; direction?: string; food?: string };
}

const CATEGORY_INFO = [
  { key: 'love', label: '연애', color: 'var(--fire)' },
  { key: 'money', label: '금전', color: 'var(--gold)' },
  { key: 'work', label: '직장', color: 'var(--water)' },
  { key: 'health', label: '건강', color: 'var(--wood)' },
] as const;

function StarScore({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <span className="font-pixel text-sm tracking-wider">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < score ? 'text-[var(--gold)]' : 'text-[var(--pixel-shadow)]'}>★</span>
      ))}
    </span>
  );
}

// DOMPurify sanitization for XSS prevention - only allows safe formatting tags
function sanitize(html: string) {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['strong', 'em', 'br'] });
}

export default function DailyResultView({ result }: { result: DailyResultData }) {
  const overallScore = result.overallLuck || result.overallScore || 0;
  const cats = result.categories;

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 + 점수 */}
      <div className="pixel-border-accent p-4 bg-[var(--accent-light)] text-center">
        {result.summary && (
          <p className="text-sm text-[var(--text-primary)] font-bold mb-2">
            {result.summary.replace(/<[^>]*>/g, '')}
          </p>
        )}
        <StarScore score={overallScore} />
      </div>

      {/* 카테고리별 점수 */}
      {cats && (
        <div className="grid grid-cols-2 gap-2">
          {CATEGORY_INFO.map(({ key, label, color }) => {
            const cat = cats[key as keyof typeof cats];
            if (!cat) return null;
            const score = typeof cat === 'object' ? cat.score : cat;
            const message = typeof cat === 'object' ? cat.message : '';
            return (
              <div key={key} className="pixel-card p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[10px]" style={{ color }}>{label}</span>
                  <StarScore score={score} />
                </div>
                {message && (
                  <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{message}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 조언 - DOMPurify로 XSS 방지 (안전한 태그만 허용) */}
      {result.advice && (
        <div className="pixel-card p-4">
          <h3 className="font-pixel text-xs text-[var(--text-secondary)] mb-2">오늘의 조언</h3>
          {Array.isArray(result.advice) ? (
            <ul className="flex flex-col gap-1.5">
              {result.advice.map((item: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="text-[var(--accent)] shrink-0">▸</span>
                  <span dangerouslySetInnerHTML={{ __html: sanitize(item) }} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitize(String(result.advice)) }} />
          )}
        </div>
      )}

      {/* 행운 아이템 */}
      {result.luckyItems && <Recommendations luckyItems={result.luckyItems} />}
    </div>
  );
}
