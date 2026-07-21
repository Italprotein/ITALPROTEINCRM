'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles, X, ArrowUp, CornerDownLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

/*
 * Amina — the assistant surface.
 *
 * Mounted once per shell (internal / portal / public). The audience is NOT decided
 * here: the client only sends the message, and /api/assistant resolves the audience
 * from the verified session. Anything this component displays has already been
 * filtered server-side.
 *
 * Follows the components/navigation/global-search.tsx pattern (AnimatePresence
 * overlay + keyboard shortcut) so the two overlays feel like one system.
 * Search is Cmd/Ctrl+K; Amina is Cmd/Ctrl+J.
 */

interface Citation {
  id: string;
  label: string | null;
  targetType: string;
  targetId: string | null;
  sourceUrl: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  /** Set on assistant replies while the model call is still stubbed. */
  stubbed?: boolean;
  failed?: boolean;
}

let localId = 0;
const nextId = () => `local-${++localId}`;

export function Amina() {
  const t = useTranslations('Amina');
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Cmd/Ctrl+J opens Amina (K belongs to global search).
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, threadId: threadId ?? undefined, locale }),
      });

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: res.status === 429 ? t('errorRateLimited') : t('errorGeneric'),
            failed: true,
          },
        ]);
        return;
      }

      const data = await res.json();
      setThreadId(data.threadId);
      setMessages((prev) => [
        ...prev,
        {
          id: data.message.id,
          role: 'assistant',
          content: data.message.content,
          citations: data.message.citations,
          stubbed: data.stubbed,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content: t('errorGeneric'), failed: true },
      ]);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen(true)}
        aria-label={t('open')}
        className={cn(
          'fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-4',
          'text-sm font-medium text-primary-foreground shadow-lg transition-transform',
          'hover:scale-105 active:scale-95',
          open && 'pointer-events-none opacity-0',
        )}
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">{t('name')}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={t('name')}
              className="relative flex h-full w-full max-w-md flex-col border-l bg-popover shadow-2xl"
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 24, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <header className="flex items-center gap-2 border-b px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{t('name')}</p>
                  <p className="truncate text-2xs text-muted-foreground">{t('tagline')}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label={t('close')}
                  className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <Welcome />
                ) : (
                  messages.map((message) => <Bubble key={message.id} message={message} />)
                )}
                {sending && (
                  <div className="flex gap-1.5 px-1 py-2" aria-label={t('thinking')}>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t p-3">
                <div className="flex items-end gap-2 rounded-lg border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={t('placeholder')}
                    className="max-h-32 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => void send()}
                    disabled={!input.trim() || sending}
                    aria-label={t('send')}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 flex items-center gap-1 px-1 text-2xs text-muted-foreground">
                  <CornerDownLeft className="h-3 w-3" />
                  {t('sendHint')}
                  <span className="ml-auto">{t('disclaimer')}</span>
                </p>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Welcome() {
  const t = useTranslations('Amina');
  const examples = ['example1', 'example2', 'example3'] as const;
  return (
    <div className="px-1 py-6">
      <p className="text-sm font-medium text-foreground">{t('welcomeTitle')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('welcomeBody')}</p>
      <p className="mt-4 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('examplesTitle')}
      </p>
      <ul className="mt-2 space-y-1.5">
        {examples.map((key) => (
          <li key={key} className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {t(key)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const t = useTranslations('Amina');
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : message.failed
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-foreground',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        {message.stubbed && (
          <p className="mt-2 inline-flex rounded bg-background/60 px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
            {t('previewBadge')}
          </p>
        )}

        {message.citations && message.citations.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-border/50 pt-2">
            {message.citations.map((citation) => (
              <li key={citation.id} className="text-2xs text-muted-foreground">
                {citation.sourceUrl ? (
                  <a href={citation.sourceUrl} className="underline underline-offset-2">
                    {citation.label ?? citation.targetType}
                  </a>
                ) : (
                  (citation.label ?? citation.targetType)
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
