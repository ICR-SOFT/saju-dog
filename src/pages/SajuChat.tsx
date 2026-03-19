import { useState, useRef, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { sendChat } from '@/lib/api.ts';
import type { ChatMessage } from '@/types/api.ts';

export function SajuChat() {
  const { profiles } = useSajuStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const profile = profiles[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !profile || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { message } = await sendChat({
        profileId: profile.id,
        message: userMessage,
        history: messages,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '죄송해요, 잠시 문제가 생겼어요. 다시 시도해주세요 🐾',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Layout>
      <h2 className="text-xl font-bold text-dark mb-4 font-serif">사주독에게 물어보기</h2>

      {!profile ? (
        <Card className="text-center py-8">
          <p className="text-warm-gray">프로필을 먼저 등록해주세요</p>
        </Card>
      ) : (
        <div className="flex flex-col" style={{ minHeight: 'calc(100dvh - 220px)' }}>
          {/* 메시지 영역 */}
          <div className="flex-1 space-y-3 mb-4">
            {messages.length === 0 && (
              <Card className="text-center">
                <div className="text-4xl mb-2">🐕</div>
                <p className="text-dark font-medium">안녕하세요, 보호자님!</p>
                <p className="text-sm text-warm-gray mt-1">
                  사주에 대해 궁금한 것을 물어보세요
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-3">
                  {['올해 운이 어때요?', '연애운이 궁금해요', '직장 고민이 있어요'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="text-xs px-3 py-1.5 rounded-full bg-cream-dark text-dark-light hover:bg-brown/10 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <span className="text-xl mr-2 mt-1">🐕</span>}
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-brown text-cream rounded-br-sm'
                    : 'bg-white text-dark border border-cream-dark rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <span className="text-xl mr-2">🐕</span>
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 border border-cream-dark">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-warm-gray-light rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-warm-gray-light rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-warm-gray-light rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                placeholder="사주독에게 물어보세요..."
                className="flex-1 rounded-xl border border-warm-gray-light/50 bg-white px-4 py-2.5 text-dark placeholder:text-warm-gray-light outline-none focus:border-brown text-sm"
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
