'use client';

import * as React from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Bot, CheckCircle2, CornerDownLeft, ListTodo, Loader2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useSession } from '@/components/providers/session-provider';
import { isApiMode } from '@/lib/data-mode';
import { Link } from '@/lib/i18n/navigation';
import { canEdit, isInternal } from '@/lib/permissions';
import { generateAiTasksFromInbox } from '@/lib/services/ai-task.actions';
import { cn } from '@/lib/utils';

const MASCOT_SRC = '/images/amina-mascot.png';

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
  failed?: boolean;
  actionHref?: '/admin/tasks';
  actionLabel?: string;
}

let localId = 0;
const nextId = () => `local-${++localId}`;

export function Amina() {
  const t = useTranslations('Amina');
  const locale = useLocale();
  const { session } = useSession();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [generatingTasks, setGeneratingTasks] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const canGenerateTasks = Boolean(
    session && isInternal(session.role) && canEdit(session.role, 'tasks'),
  );

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Anywhere in the CRM can hand Amina a question:
  //   window.dispatchEvent(new CustomEvent('amina:ask', { detail: { prompt } }))
  // The follow-up list on the tasks page uses this to ask for a briefing on a
  // company that has gone quiet. A DOM event rather than a context, so callers
  // need no provider and Amina stays mounted once, in the app shell.
  //
  // The listener calls through a ref: subscribing once with `send` captured
  // directly would freeze the first render's closure, so every prompt would be
  // sent with an empty history and a null threadId.
  const sendRef = React.useRef<(text: string) => void>(() => {});
  React.useEffect(() => {
    function onAsk(event: Event) {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt?.trim();
      if (!prompt) return;
      setOpen(true);
      sendRef.current(prompt);
    }
    window.addEventListener('amina:ask', onAsk);
    return () => window.removeEventListener('amina:ask', onAsk);
  }, []);

  React.useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, generatingTasks]);

  function addMessage(message: Omit<ChatMessage, 'id'>) {
    setMessages((current) => [...current, { id: nextId(), ...message }]);
  }

  // Keep the event listener above pointed at the current closure.
  sendRef.current = (text: string) => void send(text);

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || sending || generatingTasks) return;

    setInput('');
    setSending(true);
    addMessage({ role: 'user', content: text });

    // In api mode the server replays the persisted thread and ignores this;
    // in mock mode (no database) it is the only conversational memory.
    const history = messages
      .filter((m) => !m.failed)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          threadId: threadId ?? undefined,
          locale,
          history,
          mockAudience: session && !isInternal(session.role) ? 'portal' : 'internal',
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const content =
          data.error === 'assistant_not_configured'
            ? t('errorConfiguration')
            : response.status === 429
              ? t('errorRateLimited')
              : t('errorGeneric');
        addMessage({ role: 'assistant', content, failed: true });
        return;
      }

      setThreadId(data.threadId);
      setMessages((current) => [
        ...current,
        {
          id: data.message.id,
          role: 'assistant',
          content: data.message.content,
          citations: data.message.citations,
        },
      ]);
    } catch {
      addMessage({ role: 'assistant', content: t('errorGeneric'), failed: true });
    } finally {
      setSending(false);
    }
  }

  async function generateTodayTasks() {
    if (!canGenerateTasks || sending || generatingTasks) return;

    // The mock mailbox is empty by design (lib/mock-services/emailService.ts):
    // inbox analysis only exists against the production database + Gmail.
    if (!isApiMode) {
      addMessage({ role: 'user', content: t('generateTasks') });
      addMessage({ role: 'assistant', content: t('tasksNeedApiMode') });
      return;
    }

    setGeneratingTasks(true);
    addMessage({ role: 'user', content: t('generateTasks') });
    try {
      const result = await generateAiTasksFromInbox(locale === 'it' ? 'it' : 'en');
      if (!result.ok) {
        if (result.error === 'rate_limited') {
          const hours = Math.max(1, Math.ceil((result.retryAfterSeconds ?? 24 * 3600) / 3600));
          addMessage({ role: 'assistant', content: t('taskLimitReached', { hours }) });
          return;
        }
        // The provider's own allowance, not ours. Say so, and say when to come
        // back — telling someone to retry a spent quota just spends more of it.
        if (result.error === 'ai_quota_exhausted') {
          const seconds = result.retryAfterSeconds;
          addMessage({
            role: 'assistant',
            content: seconds
              ? t('aiQuotaExhausted', { hours: Math.max(1, Math.ceil(seconds / 3600)) })
              : t('aiQuotaExhaustedNoEta'),
          });
          return;
        }
        const content =
          result.error === 'openai_not_configured'
            ? t('errorConfiguration')
            : result.error === 'gmail_not_connected' || result.error === 'gmail_reconnect_required'
              ? t('errorGmail')
              : result.error === 'ai_provider_unavailable'
                ? t('aiProviderUnavailable')
                : result.error === 'ai_invalid_output'
                  ? t('aiInvalidOutput')
                  : t('taskGenerationFailed');
        addMessage({ role: 'assistant', content, failed: true });
        return;
      }

      const titles = result.tasks
        .map((task) => `• ${task.title}`)
        .join('\n');
      addMessage({
        role: 'assistant',
        content: result.tasks.length
          ? `${t('tasksGenerated', { count: result.tasks.length })}\n\n${titles}`
          : t('noTasksGenerated'),
        actionHref: '/admin/tasks',
        actionLabel: t('openTasks'),
      });
    } catch {
      addMessage({ role: 'assistant', content: t('taskGenerationFailed'), failed: true });
    } finally {
      setGeneratingTasks(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('open')}
        className={cn(
          'group fixed bottom-4 right-4 z-40 flex items-center gap-2 transition-all',
          'hover:-translate-y-1 active:translate-y-0',
          open && 'pointer-events-none translate-y-3 opacity-0',
        )}
      >
        <span className="hidden rounded-full border bg-background/95 px-3 py-2 text-sm font-semibold text-foreground shadow-lg backdrop-blur sm:block">
          {t('askMe')}
        </span>
        <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.6rem] border-2 border-primary/20 bg-white shadow-xl ring-4 ring-background/80">
          <Image src={MASCOT_SRC} alt="" width={80} height={80} className="h-[78px] w-[78px] object-contain" />
          <span className="absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label={t('close')}
              className="pointer-events-auto absolute inset-0 bg-brand-navy/45 backdrop-blur-sm sm:bg-brand-navy/15"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={t('name')}
              className="pointer-events-auto absolute bottom-0 right-0 flex h-full w-full flex-col overflow-hidden border bg-popover shadow-2xl sm:bottom-4 sm:right-4 sm:h-[min(720px,calc(100vh-2rem))] sm:max-w-md sm:rounded-2xl"
              initial={{ y: 20, x: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, x: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, x: 20, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <header className="relative flex items-center gap-3 overflow-hidden border-b bg-brand-navy px-4 py-3 text-white">
                <div className="absolute inset-y-0 right-0 w-36 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.26),transparent_70%)]" />
                <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white ring-2 ring-white/20">
                  <Image src={MASCOT_SRC} alt="" width={44} height={44} className="h-11 w-11 object-contain" />
                </span>
                <div className="relative min-w-0">
                  <p className="truncate text-sm font-semibold">{t('name')}</p>
                  <p className="flex items-center gap-1.5 truncate text-2xs text-white/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {t('tagline')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t('close')}
                  className="relative ml-auto rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
                {messages.length === 0 ? (
                  <Welcome
                    canGenerateTasks={canGenerateTasks}
                    generatingTasks={generatingTasks}
                    onPrompt={(prompt) => void send(prompt)}
                    onGenerateTasks={() => void generateTodayTasks()}
                  />
                ) : (
                  messages.map((message) => <Bubble key={message.id} message={message} />)
                )}
                {(sending || generatingTasks) && (
                  <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground" aria-label={t('thinking')}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    {generatingTasks ? t('analyzingInbox') : t('thinking')}
                  </div>
                )}
              </div>

              <div className="border-t bg-background p-3">
                <div className="flex items-end gap-2 rounded-xl border bg-background px-3 py-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={t('placeholder')}
                    disabled={sending || generatingTasks}
                    className="max-h-32 min-h-7 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!input.trim() || sending || generatingTasks}
                    aria-label={t('send')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:brightness-105 disabled:opacity-40"
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

function Welcome({
  canGenerateTasks,
  generatingTasks,
  onPrompt,
  onGenerateTasks,
}: {
  canGenerateTasks: boolean;
  generatingTasks: boolean;
  onPrompt: (prompt: string) => void;
  onGenerateTasks: () => void;
}) {
  const t = useTranslations('Amina');
  const examples = ['example1', 'example2', 'example3'] as const;

  return (
    <div className="py-2">
      <div className="mx-auto mb-3 flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-b from-sky-50 to-white shadow-sm ring-1 ring-primary/10">
        <Image src={MASCOT_SRC} alt="" width={112} height={112} className="h-28 w-28 object-contain" priority />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-foreground">{t('welcomeTitle')}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{t('welcomeBody')}</p>
      </div>

      {canGenerateTasks && (
        <button
          type="button"
          onClick={onGenerateTasks}
          disabled={generatingTasks}
          className="mt-5 flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-left transition-colors hover:bg-primary/10 disabled:opacity-60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {generatingTasks ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListTodo className="h-4 w-4" />}
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">{t('generateTasks')}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{t('generateTasksHint')}</span>
          </span>
        </button>
      )}

      <p className="mt-5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('examplesTitle')}
      </p>
      <div className="mt-2 space-y-2">
        {examples.map((key) => {
          const prompt = t(key);
          return (
            <button
              type="button"
              key={key}
              onClick={() => onPrompt(prompt)}
              className="flex w-full items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              <Bot className="h-4 w-4 shrink-0 text-primary" />
              {prompt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white">
          <Image src={MASCOT_SRC} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
        </span>
      )}
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : message.failed
              ? 'rounded-bl-md border border-destructive/20 bg-destructive/10 text-destructive'
              : 'rounded-bl-md border bg-background text-foreground',
        )}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>

        {message.actionHref && message.actionLabel && (
          <Link
            href={message.actionHref}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {message.actionLabel}
          </Link>
        )}

        {message.citations && message.citations.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-border/50 pt-2">
            {message.citations.map((citation) => (
              <li key={citation.id} className="text-2xs text-muted-foreground">
                {citation.sourceUrl ? (
                  <a href={citation.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
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
