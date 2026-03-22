import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router';
import { Layout } from '@/components/layout/Layout.tsx';
import { Card } from '@/components/ui/Card.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useSajuStore } from '@/stores/saju.ts';
import { useCreditStore } from '@/stores/credit.ts';
import DOMPurify from 'dompurify';
import {
  getChatSessions, createChatSession, deleteChatSession,
  getChatMessages, sendChatMessage, pollChatMessages,
  type ChatSession, type ChatMessageRow,
} from '@/lib/api.ts';
const SUGGESTED_QUESTIONS = [
  { text: '올해 운이 어때요?', icon: '🐾' },
  { text: '연애운이 궁금해요', icon: '💘' },
  { text: '직장 고민이 있어요', icon: '💼' },
  { text: '재물운은 어떤가요?', icon: '💰' },
  { text: '건강 조심할 게 있나요?', icon: '🏥' },
];

const POLL_INTERVAL = 2000;

type View = 'list' | 'chat';

export function SajuChat() {
  const { profiles, selectedProfileIdx } = useSajuStore();
  const { credits, fetchCredits } = useCreditStore();
  const location = useLocation();
  const profile = profiles[selectedProfileIdx] || profiles[0];

  const [view, setView] = useState<View>('list');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [input, setInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 세션 목록 로드
  const loadSessions = useCallback(async () => {
    try {
      const data = await getChatSessions();
      setSessions(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadSessions();
    fetchCredits();
  }, [loadSessions, fetchCredits, location.key]);

  // 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 폴링 정리
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // 세션 열기
  const openSession = async (session: ChatSession) => {
    setActiveSession(session);
    setView('chat');
    setMessages([]);
    setError('');
    try {
      const msgs = await getChatMessages(session.id);
      setMessages(msgs);
    } catch {}
  };

  // 새 상담 시작
  const startNewSession = async () => {
    if (!profile) return;
    try {
      const session = await createChatSession(profile.id);
      setActiveSession(session);
      setView('chat');
      setMessages([]);
      setSessions(prev => [session, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '세션 생성 실패');
    }
  };

  // 세션 삭제
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('이 상담 내역을 삭제할까요?')) return;
    try {
      await deleteChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setView('list');
        setActiveSession(null);
      }
    } catch {}
  };

  // 메시지 전송
  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || !activeSession || isWaiting) return;
    setInput('');
    setError('');
    setIsWaiting(true);

    try {
      // Edge Function: 크레딧 차감 + pending 메시지 생성
      const userMsg = await sendChatMessage(activeSession.id, msg);
      setMessages(prev => [...prev, userMsg]);
      fetchCredits(); // 크레딧 즉시 갱신

      // 워커 응답 폴링
      const sentAt = userMsg.created_at;
      let attempts = 0;
      const maxAttempts = 30;

      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const newMsgs = await pollChatMessages(activeSession.id, sentAt);
          if (newMsgs.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const fresh = newMsgs.filter(m => !existingIds.has(m.id));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
            setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, processing_status: 'completed' } : m));
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setIsWaiting(false);
            loadSessions();
            return;
          }
        } catch {}

        if (attempts >= maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsWaiting(false);
          setError('응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
        }
      }, POLL_INTERVAL);

    } catch (e) {
      setIsWaiting(false);
      setError(e instanceof Error ? e.message : '전송 실패');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 뒤로가기
  const goBack = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setIsWaiting(false);
    setView('list');
    setActiveSession(null);
    loadSessions();
  };

  if (!profile) {
    return (
      <Layout>
        <Card className="text-center py-8">
          <p className="text-warm-gray">프로필을 먼저 등록해주세요</p>
        </Card>
      </Layout>
    );
  }

  // ===== 세션 목록 =====
  if (view === 'list') {
    return (
      <Layout>
        <div className="text-center mb-4 -mx-4 -mt-4 px-4 pt-5 pb-4 gradient-hero rounded-b-3xl">
          <h2 className="text-xl font-bold text-dark font-serif">복돌이 상담 💬</h2>
          <p className="text-xs text-warm-gray mt-1">사주에 대한 모든 궁금증을 해결해드려요</p>
        </div>

        <Button onClick={startNewSession} className="w-full mb-4">
          + 새 상담 시작하기
        </Button>

        {sessions.length === 0 ? (
          <Card className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-brown/10 flex items-center justify-center">
              <span className="text-3xl animate-float">🐕</span>
            </div>
            <p className="text-warm-gray font-medium">아직 상담 내역이 없어요</p>
            <p className="text-warm-gray text-sm mt-1">새 상담을 시작해보세요!</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {sessions.map(session => (
              <Card
                key={session.id}
                padding="sm"
                className="cursor-pointer hover:shadow-md active:scale-[0.99] transition-all border-l-4 border-l-sky-400"
                onClick={() => openSession(session)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cream-dark flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">💬</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-dark text-sm truncate">{session.title}</p>
                    <p className="text-xs text-warm-gray">
                      {new Date(session.updated_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="text-warm-gray-light hover:text-red-400 transition-colors p-1"
                  >
                    ✕
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Layout>
    );
  }

  // ===== 채팅 화면 =====
  return (
    <Layout>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4 -mx-4 -mt-4 px-4 pt-5 pb-4 gradient-hero rounded-b-3xl">
        <button onClick={goBack} className="text-dark text-lg">←</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-dark font-serif truncate">
            {activeSession?.title || '새 상담'}
          </h2>
          <p className="text-[10px] text-warm-gray">1회 🦴 1개 · 보유 {credits?.bones ?? 0}개</p>
        </div>
      </div>

      <div className="flex flex-col" style={{ minHeight: 'calc(100dvh - 250px)' }}>
        {/* 메시지 영역 */}
        <div className="flex-1 space-y-3 mb-4">
          {messages.length === 0 && !isWaiting && (
            <Card className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-brown/10 flex items-center justify-center">
                <img src="/images/logo.png" alt="복돌이" className="w-12 h-12 rounded-full object-cover animate-float" />
              </div>
              <p className="text-dark font-bold font-serif">안녕하세요, 보호자님!</p>
              <p className="text-sm text-warm-gray mt-1 mb-4">사주에 대해 궁금한 것을 물어보세요</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button
                    key={q.text}
                    onClick={() => handleSend(q.text)}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full bg-gradient-to-r from-cream-dark to-brown/5 text-dark-light hover:from-brown/10 hover:to-brown/15 transition-all shadow-sm border border-brown/10"
                  >
                    <span className="text-[10px]">{q.icon}</span>
                    <span>{q.text}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {messages.filter(m => m.processing_status !== 'failed' || m.role === 'assistant').map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-brown/10 flex items-center justify-center mr-2 mt-1 flex-shrink-0 border border-brown/10">
                  <img src="/images/logo.png" alt="복돌이" className="w-full h-full rounded-full object-cover" />
                </div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-brown to-brown-dark text-cream rounded-br-sm shadow-md'
                  : 'bg-white text-dark border border-cream-dark rounded-bl-sm card-glow'
              }`}>
                {msg.role === 'assistant'
                  ? <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content) }} />
                  : msg.content
                }
              </div>
            </div>
          ))}

          {/* 응답 대기 */}
          {isWaiting && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-brown/10 flex items-center justify-center mr-2 flex-shrink-0 border border-brown/10">
                <img src="/images/logo.png" alt="복돌이" className="w-full h-full rounded-full object-cover" />
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

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
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
              disabled={isWaiting}
              className="flex-1 rounded-xl border border-warm-gray-light/50 bg-white px-4 py-2.5 text-dark placeholder:text-warm-gray-light outline-none focus:border-brown focus:ring-1 focus:ring-brown/20 text-sm transition-all disabled:opacity-50"
            />
            <Button onClick={() => handleSend()} disabled={!input.trim() || isWaiting} size="md">
              전송
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
