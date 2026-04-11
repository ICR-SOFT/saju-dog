'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import DOMPurify from 'dompurify';
import AppShell from '@/components/layout/AppShell';
import AuthRequired from '@/components/layout/AuthRequired';
import Button from '@/components/ui/Button';
import { useSajuStore } from '@/stores/saju';
import { useCreditStore } from '@/stores/credit';
import {
  getChatSessions,
  createChatSession,
  deleteChatSession,
  getChatMessages,
  sendChatMessage,
  pollChatMessages,
} from '@/lib/api';
import type { ChatSession, ChatMessageRow } from '@/lib/api';

const SUGGESTED_QUESTIONS = [
  '오늘 나에게 좋은 일이 있을까요?',
  '이번 달 재물운은 어때요?',
  '연애운을 알려주세요',
  '올해 주의할 점이 있나요?',
  '직장 운세가 궁금해요',
];

const POLL_INTERVAL = 2000;

type View = 'list' | 'chat';

export default function ChatPage() {
  const { profiles, fetchProfiles } = useSajuStore();
  const { credits, fetchCredits } = useCreditStore();
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [view, setView] = useState<View>('list');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedProfile = profiles[selectedIdx];

  useEffect(() => {
    fetchProfiles();
    fetchCredits();
  }, [fetchProfiles, fetchCredits]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const data = await getChatSessions();
      setSessions(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Open existing session
  const openSession = async (session: ChatSession) => {
    setActiveSession(session);
    setView('chat');
    setMessages([]);
    setError('');
    try {
      const msgs = await getChatMessages(session.id);
      setMessages(msgs);
    } catch {
      // silent
    }
  };

  // Start new session
  const startNewSession = async () => {
    if (!selectedProfile) return;
    try {
      const session = await createChatSession(selectedProfile.id);
      setActiveSession(session);
      setView('chat');
      setMessages([]);
      setSessions((prev) => [session, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '세션 생성 실패');
    }
  };

  // Delete session
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('이 상담 내역을 삭제할까요?')) return;
    try {
      await deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setView('list');
        setActiveSession(null);
      }
    } catch {
      // silent
    }
  };

  const startPolling = useCallback(
    (sessionId: string, afterDate: string) => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setIsPolling(true);

      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts++;
        try {
          const newMsgs = await pollChatMessages(sessionId, afterDate);
          if (newMsgs.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const unique = newMsgs.filter((m) => !existingIds.has(m.id));
              return unique.length > 0 ? [...prev, ...unique] : prev;
            });
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setIsPolling(false);
            loadSessions();
            return;
          }
        } catch {
          // Retry on next interval
        }

        if (attempts >= 30) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setIsPolling(false);
          setError('응답 시간이 초과되었어요. 잠시 후 다시 시도해주세요.');
        }
      }, POLL_INTERVAL);
    },
    [loadSessions],
  );

  const handleSend = useCallback(
    async (text?: string) => {
      const content = text || inputText.trim();
      if (!content || isSending || !activeSession) return;

      setInputText('');
      setIsSending(true);
      setError('');

      try {
        // Optimistic user message
        const tempUserMsg: ChatMessageRow = {
          id: `temp-${Date.now()}`,
          session_id: activeSession.id,
          role: 'user',
          content,
          processing_status: 'completed',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempUserMsg]);

        // Send message
        const sentMsg = await sendChatMessage(activeSession.id, content);
        fetchCredits();

        // Replace temp with real
        setMessages((prev) => prev.map((m) => (m.id === tempUserMsg.id ? sentMsg : m)));

        // Start polling for AI response
        startPolling(activeSession.id, sentMsg.created_at);
      } catch (e) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
        setError(e instanceof Error ? e.message : '전송 실패');
      } finally {
        setIsSending(false);
      }
    },
    [inputText, isSending, activeSession, startPolling, fetchCredits],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Back to list
  const goBack = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
    setIsPolling(false);
    setView('list');
    setActiveSession(null);
    loadSessions();
  };

  // Sanitize assistant HTML content with DOMPurify
  const sanitizeContent = (html: string) =>
    DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h3', 'h4', 'ul', 'ol', 'li', 'span'],
      ALLOWED_ATTR: ['class', 'style'],
    });

  // ===== SESSION LIST VIEW =====
  if (view === 'list') {
    return (
      <AuthRequired>
        <AppShell title="멍도령 상담" showNav>
          <div className="p-4 flex flex-col gap-4 animate-fade-in">
            {/* Profile Selector */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {profiles.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  className={`shrink-0 px-3 py-1.5 text-[10px] font-pixel border-2 border-[var(--pixel-border)] ${
                    idx === selectedIdx
                      ? 'bg-[var(--accent)] text-white border-[var(--accent-hover)]'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                  }`}
                  onClick={() => setSelectedIdx(idx)}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Credit display */}
            <div className="flex items-center justify-between px-1">
              <span className="font-pixel text-[10px] text-[var(--text-muted)]">
                1회 상담 🦴 1개
              </span>
              <span className="font-pixel text-[10px] text-[var(--text-secondary)]">
                보유: 🦴 {credits?.bones ?? 0}개
              </span>
            </div>

            {/* New session button */}
            <Button variant="primary" className="w-full" onClick={startNewSession}>
              + 새 상담 시작하기
            </Button>

            {/* Session list */}
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <span className="text-4xl">🐕</span>
                <p className="font-pixel text-xs text-[var(--text-muted)] text-center">
                  아직 상담 내역이 없어요
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">새 상담을 시작해보세요!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className="pixel-card p-3 w-full text-left flex items-center gap-3"
                    onClick={() => openSession(session)}
                  >
                    <span className="text-xl shrink-0">💬</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-pixel text-xs text-[var(--text-primary)] truncate">
                        {session.title || '새 상담'}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {new Date(session.updated_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors p-1 font-pixel text-xs"
                    >
                      ✕
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        </AppShell>
      </AuthRequired>
    );
  }

  // ===== CHAT VIEW =====
  return (
    <AuthRequired>
      <AppShell title="멍도령 상담" showNav>
        <div className="flex flex-col h-[calc(100dvh-48px-64px)]">
          {/* Header with back button */}
          <div className="p-3 border-b-2 border-[var(--pixel-border)] bg-[var(--bg-secondary)] flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              className="font-pixel text-xs text-[var(--text-secondary)]"
            >
              ←
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-pixel text-[10px] text-[var(--text-primary)] truncate">
                {activeSession?.title || '새 상담'}
              </p>
            </div>
            <span className="font-pixel text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
              🦴 {credits?.bones ?? 0}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && !isPolling && (
              <div className="flex flex-col items-center gap-4 py-8">
                <span className="text-4xl">🐕</span>
                <p className="font-pixel text-xs text-[var(--text-muted)] text-center">
                  사주에 대해 물어보세요
                </p>

                {/* Suggested Questions */}
                <div className="flex flex-col gap-2 w-full">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="pixel-card p-2.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                      onClick={() => handleSend(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 shrink-0 mr-2 flex items-center justify-center border-2 border-[var(--pixel-border)] bg-[var(--bg-secondary)] text-sm">
                    🐕
                  </div>
                )}
                <div
                  className={`max-w-[75%] p-3 text-sm leading-relaxed ${
                    msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <span
                      dangerouslySetInnerHTML={{ __html: sanitizeContent(msg.content) }}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {/* Polling Indicator */}
            {isPolling && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 shrink-0 flex items-center justify-center border-2 border-[var(--pixel-border)] bg-[var(--bg-secondary)] text-sm">
                  🐕
                </div>
                <div className="chat-bubble-ai p-3">
                  <div className="pixel-loading">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-[var(--error)] text-center">{error}</p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t-2 border-[var(--pixel-border)] bg-[var(--bg-primary)]">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요..."
                className="flex-1 px-3 py-2 text-sm border-2 border-[var(--pixel-border)] shadow-[2px_2px_0_var(--pixel-shadow)] outline-none focus:border-[var(--accent)] transition-colors"
                disabled={isSending}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSend()}
                loading={isSending}
                disabled={!inputText.trim() || isSending}
              >
                전송
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthRequired>
  );
}
