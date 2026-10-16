import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Instagram,
  UserX,
  HeartCrack,
  ArrowLeft,
  BookOpen,
  Users,
  Heart,
  MoreVertical,
  Flag,
  Loader2,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';
import { useChatStore, type ReportReason } from '@/features/chat/chatStore';
import { useAuthStore } from '@/features/auth/authStore';
import { formatRelativeTime } from '@/lib/utils';
import { Avatar } from '@/components/Avatar';
import { confirmDialog } from '@/components/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Highlight, MODE_COLOR, spring } from '@/components/brand';
import type { ConnectionMode } from '@/features/theme/themeStore';

const MODE_LABEL = { study: 'Modo Estudio', friendship: 'Modo Amistad', dating: 'Modo Pareja' } as const;

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Acoso o amenazas' },
  { value: 'sexual_content', label: 'Contenido sexual no deseado' },
  { value: 'fake_profile', label: 'Perfil falso' },
  { value: 'spam', label: 'Spam o estafa' },
  { value: 'other', label: 'Otro motivo' },
];

const ModeIcon: React.FC<{ mode: string }> = ({ mode }) => {
  if (mode === 'study') return <BookOpen className="w-3.5 h-3.5 text-azure-600 dark:text-azure-400" />;
  if (mode === 'friendship') return <Users className="w-3.5 h-3.5 text-amber-600 dark:text-sun" />;
  return <Heart className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />;
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

interface ChatViewProps {
  onBackToDiscover?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ onBackToDiscover }) => {
  const { user } = useAuthStore();
  const {
    myId,
    matches,
    activeMatch,
    messages,
    isLoading,
    isLoadingMessages,
    error,
    loadMatches,
    openMatch,
    sendMessage,
    unmatchActive,
    blockActive,
    reportActive,
  } = useChatStore();

  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('harassment');
  const [reportText, setReportText] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, activeMatch?.matchId]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await sendMessage(text);
    setSending(false);
    if (res.success) setInputMessage('');
    else if (res.message) setNotice({ kind: 'error', text: res.message });
  };

  const handleUnmatch = async () => {
    setShowOptions(false);
    const first = activeMatch?.user.name.split(' ')[0] || 'esta persona';
    const ok = await confirmDialog({
      title: `¿Deshacer el match con ${first}?`,
      message: 'La conversación desaparecerá para ambos y no podrán volver a escribirse.',
      confirmLabel: 'Deshacer match',
      tone: 'danger',
      icon: 'heart-crack',
    });
    if (!ok) return;
    const res = await unmatchActive();
    if (!res.success && res.message) setNotice({ kind: 'error', text: res.message });
  };

  const handleBlock = async () => {
    setShowOptions(false);
    const first = activeMatch?.user.name.split(' ')[0] || 'esta persona';
    const ok = await confirmDialog({
      title: `¿Bloquear a ${first}?`,
      message: 'Ya no podrán verse ni escribirse.',
      confirmLabel: 'Bloquear',
      tone: 'danger',
      icon: 'user-x',
    });
    if (!ok) return;
    const res = await blockActive();
    setNotice(res.success ? { kind: 'ok', text: 'Usuario bloqueado.' } : { kind: 'error', text: res.message || 'Error' });
  };

  const handleReport = async () => {
    const res = await reportActive(reportReason, reportText);
    if (!res.success) {
      setNotice({ kind: 'error', text: res.message || 'No se pudo reportar.' });
      return;
    }
    setShowReport(false);
    setReportText('');
    if (alsoBlock) await blockActive();
    setNotice({ kind: 'ok', text: res.message || 'Reporte enviado.' });
  };

  const noticeBanner = (
    <AnimatePresence>
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          role="status"
          className={`mx-4 mt-3 p-3 rounded-xl text-sm flex items-start gap-2 ${
            notice.kind === 'error'
              ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
              : 'bg-mint/40 dark:bg-mint/10 text-azure-900 dark:text-azure-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{notice.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const iconBtn =
    'w-9 h-9 flex items-center justify-center rounded-full text-slate-600 dark:text-haze-300 hover:bg-haze-100 dark:hover:bg-ink-800 hover:text-slate-900 dark:hover:text-slate-50 transition';

  return (
    <div className="max-w-md w-full mx-auto flex-1 min-h-0 flex flex-col">
      {!activeMatch ? (
        /* LISTA DE MATCHES */
        <div className="flex-1 flex flex-col overflow-y-auto space-y-6">
          <div>
            <h2 className="text-4xl font-semibold leading-none">
              Tus <Highlight>matches</Highlight>
            </h2>
            <p className="text-sm text-slate-500 dark:text-haze-400 mt-3">Solo chateas cuando el interés es mutuo.</p>
          </div>
          {noticeBanner}

          {error && <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}

          {isLoading && matches.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-16" role="status" aria-label="Cargando matches">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-mint animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2.5 h-2.5 rounded-full bg-sun animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2.5 h-2.5 rounded-full bg-coral animate-bounce" />
              </div>
            </div>
          ) : matches.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-6 py-12 rounded-3xl border-2 border-dashed border-slate-900/10 dark:border-white/10"
            >
              <span className="w-16 h-16 rounded-full bg-coral text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker">
                <MessageCircle className="w-7 h-7" />
              </span>
              <h3 className="text-2xl font-semibold">Aún no tienes matches</h3>
              <p className="text-sm text-slate-500 dark:text-haze-400 max-w-[30ch]">
                Cuando a alguien le interese tu perfil y a ti el suyo, aparecerá aquí para que puedan chatear.
              </p>
              {onBackToDiscover && (
                <button
                  onClick={onBackToDiscover}
                  className="h-12 px-6 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97]"
                >
                  Ir a Descubrir
                </button>
              )}
            </motion.div>
          ) : (
            <>
              <section className="space-y-3">
                <h3 className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-haze-400">Nuevas conexiones</h3>
                {/* padding para que el anillo y el zoom al pasar el mouse no se recorten */}
                <div className="flex gap-4 overflow-x-auto overflow-y-visible -mx-1 px-1.5 pt-1.5 pb-2">
                  {matches.map((m, i) => (
                    <motion.button
                      key={m.matchId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...spring, delay: i * 0.04 }}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => void openMatch(m)}
                      className="flex flex-col items-center shrink-0"
                    >
                      <div
                        className="relative w-16 h-16 shrink-0 rounded-full p-[3px]"
                        style={{ backgroundColor: MODE_COLOR[m.mode as ConnectionMode] }}
                      >
                        <Avatar src={m.user.avatarUrl} name={m.user.name} className="w-full h-full text-lg ring-2 ring-haze-50 dark:ring-ink-950" />
                        <span className="absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full bg-haze-50 dark:bg-ink-950">
                          <ModeIcon mode={m.mode} />
                        </span>
                      </div>
                      <span className="font-serif text-sm font-semibold mt-1.5 max-w-18 truncate">{m.user.name.split(' ')[0]}</span>
                    </motion.button>
                  ))}
                </div>
              </section>

              <section className="space-y-1 flex-1">
                <h3 className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-haze-400 pb-1">Conversaciones</h3>
                {matches.map((m) => (
                  <button
                    key={m.matchId}
                    onClick={() => void openMatch(m)}
                    className="group w-full text-left -mx-2 px-2 py-3 rounded-2xl hover:bg-white dark:hover:bg-ink-850 transition flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={m.user.avatarUrl} name={m.user.name} className="w-13 h-13 text-base" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-serif text-lg font-semibold leading-tight truncate">{m.user.name}</span>
                          <ModeIcon mode={m.mode} />
                        </div>
                        <p
                          className={`text-sm truncate ${
                            m.unreadCount ? 'font-semibold text-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-haze-400'
                          }`}
                        >
                          {m.lastMessage ? `${m.lastFromMe ? 'Tú: ' : ''}${m.lastMessage}` : '¡Nuevo match! Saluda 👋'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-xs text-slate-400 dark:text-haze-500">{formatRelativeTime(m.lastMessageAt || m.matchedAt)}</span>
                      {m.unreadCount > 0 && (
                        <span className="min-w-5.5 h-5.5 px-1.5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center">
                          {m.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </section>
            </>
          )}
        </div>
      ) : (
        /* CONVERSACIÓN */
        <div className="flex-1 flex flex-col min-h-0 -mx-4 -my-4">
          <div className="px-3 py-2.5 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button onClick={() => void openMatch(null)} aria-label="Volver a la lista" className={iconBtn}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="rounded-full p-[2px] shrink-0" style={{ backgroundColor: MODE_COLOR[activeMatch.mode as ConnectionMode] }}>
                <Avatar src={activeMatch.user.avatarUrl} name={activeMatch.user.name} className="w-10 h-10 text-sm ring-2 ring-haze-50 dark:ring-ink-950" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold leading-tight truncate">{activeMatch.user.name}</h3>
                <p className="text-xs text-slate-500 dark:text-haze-400 truncate">
                  {[activeMatch.user.career, activeMatch.user.campus].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 relative shrink-0">
              {activeMatch.user.instagramHandle && (
                <a
                  href={`https://instagram.com/${activeMatch.user.instagramHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-coral text-slate-900 hover:-rotate-6 transition"
                  title={`@${activeMatch.user.instagramHandle}`}
                  aria-label={`Instagram de ${activeMatch.user.name}`}
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              <button onClick={() => setShowOptions(!showOptions)} aria-label="Opciones" aria-expanded={showOptions} className={iconBtn}>
                <MoreVertical className="w-4.5 h-4.5" />
              </button>
              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -4 }}
                    transition={{ duration: 0.15 }}
                    style={{ transformOrigin: 'top right' }}
                    className="absolute right-0 top-11 w-56 rounded-2xl bg-white dark:bg-ink-800 border border-slate-900/[0.06] dark:border-white/[0.06] shadow-soft-lg p-1.5 z-50 text-sm"
                  >
                    <button onClick={() => void handleUnmatch()} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-haze-100 dark:hover:bg-ink-700 flex items-center gap-2.5">
                      <HeartCrack className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Deshacer match
                    </button>
                    <button
                      onClick={() => {
                        setShowOptions(false);
                        setShowReport(true);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-sun/20 flex items-center gap-2.5"
                    >
                      <Flag className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Reportar
                    </button>
                    <button
                      onClick={() => void handleBlock()}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 flex items-center gap-2.5 text-rose-700 dark:text-rose-400 font-semibold"
                    >
                      <UserX className="w-4 h-4" /> Bloquear
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          {noticeBanner}

          <div className="flex-1 px-4 py-4 overflow-y-auto space-y-2 min-h-0">
            <div className="text-center pb-3">
              <span
                className="inline-block text-xs font-semibold text-slate-900 px-3 py-1 rounded-full -rotate-2 shadow-sticker"
                style={{ backgroundColor: MODE_COLOR[activeMatch.mode as ConnectionMode] }}
              >
                Hicieron match en {MODE_LABEL[activeMatch.mode]}
              </span>
            </div>

            {isLoadingMessages && <Loader2 className="w-5 h-5 animate-spin text-brand-600 mx-auto" />}
            {!isLoadingMessages && messages.length === 0 && (
              <p className="text-center font-serif italic text-lg text-slate-500 dark:text-haze-400 py-8">Escribe el primer mensaje. Sé amable 😊</p>
            )}

            {messages.map((msg) => {
              const isMine = msg.senderId === (myId ?? user?.id);
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap wrap-break-word ${
                      isMine
                        ? 'bg-brand-600 text-white rounded-br-md'
                        : 'bg-white dark:bg-ink-800 text-slate-900 dark:text-slate-50 rounded-bl-md shadow-soft-sm'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <span className={`block text-[10px] mt-1 text-right ${isMine ? 'text-white/70' : 'text-slate-400 dark:text-haze-500'}`}>
                      {timeOf(msg.createdAt)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="px-3 py-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              maxLength={1000}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Escribe a ${activeMatch.user.name.split(' ')[0]}…`}
              aria-label="Mensaje"
              className="flex-1 h-12 px-5 rounded-full bg-white dark:bg-white/[0.05] border-2 border-slate-900/10 dark:border-white/10 text-base outline-none focus:border-slate-900 dark:focus:border-slate-50 transition-colors placeholder:text-slate-500 dark:placeholder:text-haze-400"
            />
            <motion.button
              whileTap={{ scale: 0.88, rotate: -12 }}
              type="submit"
              disabled={!inputMessage.trim() || sending}
              aria-label="Enviar"
              className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-glow-brand disabled:opacity-35 disabled:shadow-none transition-colors"
            >
              {sending ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Send className="w-4.5 h-4.5" />}
            </motion.button>
          </form>
        </div>
      )}

      {/* Modal de reporte */}
      <AnimatePresence>
        {showReport && activeMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowReport(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={spring}
              role="dialog"
              aria-modal="true"
              aria-label={`Reportar a ${activeMatch.user.name.split(' ')[0]}`}
              className="w-full max-w-sm rounded-3xl bg-haze-50 dark:bg-ink-900 dark:ring-1 dark:ring-white/10 text-slate-900 dark:text-slate-50 p-6 space-y-4 shadow-soft-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-semibold">Reportar a {activeMatch.user.name.split(' ')[0]}</h3>
              <div className="space-y-1">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-center gap-2.5 text-sm cursor-pointer px-3 py-2.5 rounded-xl transition ${
                      reportReason === r.value ? 'bg-white dark:bg-ink-800 font-semibold' : 'hover:bg-haze-100 dark:hover:bg-ink-850'
                    }`}
                  >
                    <input type="radio" name="reason" checked={reportReason === r.value} onChange={() => setReportReason(r.value)} />
                    {r.label}
                  </label>
                ))}
              </div>
              <textarea
                rows={3}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Cuéntanos qué pasó (opcional)"
                aria-label="Detalles del reporte"
                className="w-full p-3.5 rounded-xl bg-white/70 dark:bg-white/[0.04] border-2 border-slate-900/10 dark:border-white/10 text-sm outline-none focus:border-slate-900 dark:focus:border-slate-50 transition-colors placeholder:text-slate-500 dark:placeholder:text-haze-400"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
                También bloquear a esta persona
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowReport(false)} className="flex-1 h-12 rounded-full text-sm font-semibold hover:bg-haze-100 dark:hover:bg-ink-800 transition">
                  Cancelar
                </button>
                <button onClick={() => void handleReport()} className="flex-1 h-12 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition active:scale-[0.97]">
                  Enviar reporte
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
