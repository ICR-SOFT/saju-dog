import { useState, useRef, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { sendChat } from '@/lib/api.ts';
import type { ChatMessage } from '@/types/api.ts';

const SUGGESTED_QUESTIONS = [
  { text: '올해 운이 어때요?', icon: '🐾' },
  { text: '연애운이 궁금해요', icon: '🐾' },
  { text: '직장 고민이 있어요', icon: '🐾' },
  { text: '재물운은 어떤가요?', icon: '🐾' },
  { text: '건강 조심할 게 있나요?', icon: '🐾' },
];

const MAX_RETRIES = 2;

export function SajuChat() {
  const { profiles, selectedProfileIdx } = useSajuStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [retryData, setRetryData] = useState<{ message: string; history: ChatMessage[] } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const profile = profiles[selectedProfileIdx] || profiles[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const doSend = async (userMessage: string, history: ChatMessage[], attempt = 0) => {
    try {
      const { message } = await sendChat({
        profileId: profile.id,
        message: userMessage,
        history,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      setRetryData(null);
    } catch {
      if (attempt < MAX_RETRIES) {
        // 자동 재시도
        await doSend(userMessage, history, attempt + 1);
        return;
      }
      // 최종 실패
      setRetryData({ message: userMessage, history });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '죄송해요, 잠시 문제가 생겼어요. 아래 버튼으로 다시 시도해주세요 🐾',
      }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !profile || isLoading) return;

    const userMessage = input.trim();
    const currentHistory = [...messages];
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setRetryData(null);

    await doSend(userMessage, currentHistory);
    setIsLoading(false);
  };

  const handleRetry = async () => {
    if (!retryData || isLoading) return;
    setIsLoading(true);
    // 마지막 에러 메시지 제거
    setMessages(prev => prev.slice(0, -1));
    await doSend(retryData.message, retryData.history);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  return (
    <Layout>
      {/* 헤더 */}
      <div className="text-center mb-4 -mx-4 -mt-4 px-4 pt-5 pb-4 gradient-hero rounded-b-3xl">
        <h2 className="text-xl font-bold text-dark font-serif">
          복돌이에게 물어보세요 🐾
        </h2>
        <p className="text-xs text-warm-gray mt-1">사주에 대한 모든 궁금증을 해결해드려요</p>
      </div>

      {!profile ? (
        <Card className="text-center py-8">
          <p className="text-warm-gray">프로필을 먼저 등록해주세요</p>
        </Card>
      ) : (
        <div className="flex flex-col" style={{ minHeight: 'calc(100dvh - 250px)' }}>
          {/* 메시지 영역 */}
          <div className="flex-1 space-y-3 mb-4">
            {messages.length === 0 && (
              <Card className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-brown/10 flex items-center justify-center">
                  <span className="text-3xl animate-float">🐕</span>
                </div>
                <p className="text-dark font-bold font-serif">안녕하세요, 보호자님!</p>
                <p className="text-sm text-warm-gray mt-1 mb-4">
                  사주에 대해 궁금한 것을 물어보세요
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTED_QUESTIONS.map(q => (
                    <button
                      key={q.text}
                      onClick={() => handleSuggestedQuestion(q.text)}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full bg-gradient-to-r from-cream-dark to-brown/5 text-dark-light hover:from-brown/10 hover:to-brown/15 transition-all shadow-sm border border-brown/10"
                    >
                      <span className="text-[10px]">{q.icon}</span>
                      <span>{q.text}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-brown/10 flex items-center justify-center mr-2 mt-1 flex-shrink-0 border border-brown/10">
                    <span className="text-lg">🐕</span>
                  </div>
                )}
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-brown to-brown-dark text-cream rounded-br-sm shadow-md'
                    : 'bg-white text-dark border border-cream-dark rounded-bl-sm card-glow'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* 재시도 버튼 */}
            {retryData && !isLoading && (
              <div className="flex justify-start pl-10">
                <button
                  onClick={handleRetry}
                  className="text-xs text-brown font-medium px-3 py-1.5 rounded-full bg-brown/5 hover:bg-brown/10 transition-colors border border-brown/10"
                >
                  🔄 다시 시도
                </button>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-brown/10 flex items-center justify-center mr-2 flex-shrink-0 border border-brown/10">
                  <span className="text-lg">🐕</span>
                </div>
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 border border-cream-dark shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-brown/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-brown/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-brown/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 입력 영역 */}
          <div className="sticky bottom-16 bg-cream pt-2 pb-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="복돌이에게 물어보세요..."
                className="flex-1 rounded-xl border border-warm-gray-light/50 bg-white px-4 py-2.5 text-dark placeholder:text-warm-gray-light outline-none focus:border-brown focus:ring-1 focus:ring-brown/20 text-sm transition-all"
              />
              <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="md">
                전송
              </Button>
            </div>
            <p className="text-[10px] text-warm-gray-light text-center mt-1">1회 🦴 1개</p>
          </div>
        </div>
      )}
    </Layout>
  );
}
