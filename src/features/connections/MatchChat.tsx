import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2, Timer } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { useConnectionsStore, CHAT_TTL_HOURS, MESSAGE_MAX, type Connection } from '@/features/connections/connectionsStore';
import { inputCls } from '@/features/events/ui';

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

/** Tiempo que le queda a un mensaje: "23 h", "45 min". */
function remaining(iso: string): string {
  const ms = new Date(iso).getTime() + CHAT_TTL_HOURS * 3_600_000 - Date.now();
  if (ms <= 0) return 'por borrarse';
  const min = Math.ceil(ms / 60_000);
  return min >= 60 ? `${Math.floor(min / 60)} h` : `${min} min`;
}

/** Chat temporal del match: todo lo que se escribe se borra a las 24 horas. */
export const MatchChat: React.FC<{ connection: Connection }> = ({ connection }) => {
  const { user } = useAuthStore();
  const loadMessages = useConnectionsStore((s) => s.loadMessages);
  const sendMessage = useConnectionsStore((s) => s.sendMessage);
  const markChatRead = useConnectionsStore((s) => s.markChatRead);
  const list = useConnectionsStore((s) => (connection.conversationId ? s.messages[connection.conversationId] : undefined));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [, tick] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const first = connection.other.name.split(' ')[0];

  useEffect(() => {
    void loadMessages(connection);
    // Los mensajes que caducan desaparecen aunque el chat esté abierto
    const t = setInterval(() => { tick((n) => n + 1); void loadMessages(connection); }, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.conversationId]);

  // Mensajes nuevos de la otra persona mientras el chat está abierto: se marcan como leídos
  useEffect(() => {
    if (connection.unreadCount > 0) void markChatRead(connection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.unreadCount, list?.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [list?.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError('');
    const res = await sendMessage(connection, text);
    setSending(false);
    if (res.success) setText('');
    else setError(res.message || 'No se pudo enviar el mensaje.');
  };

  const cutoff = Date.now() - CHAT_TTL_HOURS * 3_600_000;
  const messages = (list ?? []).filter((m) => new Date(m.createdAt).getTime() > cutoff);

  return (
    <section className="flex-1 min-h-0 flex flex-col gap-3" aria-label={`Chat con ${first}`}>
      <p className="shrink-0 flex items-start gap-2 text-xs text-slate-500 dark:text-haze-400 rounded-2xl bg-haze-100 dark:bg-ink-850 px-3 py-2.5">
        <Timer className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Los mensajes se borran a las {CHAT_TTL_HOURS} h. Si reportas a {first}, moderación puede verlos.</span>
      </p>

      <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-1" aria-live="polite">
        {messages.length === 0 && (
          <li className="text-center text-sm text-slate-500 dark:text-haze-400 py-10">Aún no hay mensajes. ¡Rompe el hielo con {first}!</li>
        )}
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <li key={m.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'ml-auto bg-brand-600 text-white' : 'mr-auto bg-white dark:bg-ink-850 shadow-soft-sm'}`}>
              <p className="whitespace-pre-wrap break-words leading-snug">{m.content}</p>
              <p className={`text-[10px] mt-1 ${mine ? 'text-white/75' : 'text-slate-400'}`}>{hhmm(m.createdAt)} · se borra en {remaining(m.createdAt)}</p>
            </li>
          );
        })}
        <div ref={endRef} />
      </ul>

      <form onSubmit={(e) => void submit(e)} className="shrink-0 flex items-end gap-2">
        <textarea
          rows={1}
          value={text}
          maxLength={MESSAGE_MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(e); } }}
          placeholder={`Escríbele a ${first}`}
          aria-label="Mensaje"
          className={`${inputCls} flex-1 resize-none`}
        />
        <button type="submit" disabled={!text.trim() || sending} aria-label="Enviar mensaje" className="w-12 h-12 shrink-0 rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white flex items-center justify-center transition active:scale-95">
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
      {error && <p role="alert" className="shrink-0 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
    </section>
  );
};
