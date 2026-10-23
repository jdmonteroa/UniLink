import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Heart, CalendarDays, Clock, CalendarCheck, ChevronRight, AlertCircle, MessageCircle } from 'lucide-react';
import { useConnectionsStore, attentionCount, type Connection } from '@/features/connections/connectionsStore';
import { MatchDetail } from '@/features/connections/MatchDetail';
import type { ConnectionModeKey } from '@/features/auth/authStore';
import { Avatar } from '@/components/Avatar';
import { Highlight, MODE_COLOR } from '@/components/brand';
import { Spinner, formatWhen } from '@/features/events/ui';

const TABS: { id: ConnectionModeKey; label: string; Icon: typeof Users }[] = [
  { id: 'friendship', label: 'Amistades', Icon: Users },
  { id: 'dating', label: 'Pareja', Icon: Heart },
];

const Dot: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-block w-2.5 h-2.5 rounded-full bg-brand-600 ring-2 ring-haze-50 dark:ring-ink-950 ${className}`} role="img" aria-label="Pendiente" />
);

/** Una línea que resume en qué va el match. */
function statusLine(c: Connection): { text: string; Icon: typeof Clock; strong: boolean } {
  const m = c.meetup;
  const first = c.other.name.split(' ')[0];
  if (m?.status === 'pending' && !m.proposedByMe) return { text: `${first} te propuso quedar: ${m.place} · ${formatWhen(m.when)}`, Icon: CalendarDays, strong: true };
  if (m?.status === 'pending') return { text: `Esperando respuesta · ${m.place} · ${formatWhen(m.when)}`, Icon: Clock, strong: false };
  if (m?.status === 'accepted' && new Date(m.when).getTime() > Date.now()) return { text: `Encuentro confirmado · ${m.place} · ${formatWhen(m.when)}`, Icon: CalendarCheck, strong: c.needsAttention };
  if (m?.status === 'declined') return { text: m.proposedByMe ? `${first} rechazó tu propuesta` : 'Rechazaste la propuesta', Icon: CalendarDays, strong: c.needsAttention };
  if (m?.status === 'cancelled') return { text: 'El encuentro se canceló', Icon: CalendarDays, strong: c.needsAttention };
  return { text: '¡Nuevo match! Propón un encuentro', Icon: CalendarDays, strong: false };
}

const Row: React.FC<{ c: Connection; onOpen: () => void }> = ({ c, onOpen }) => {
  const s = statusLine(c);
  const first = c.other.name.split(' ')[0];
  const unread = c.unreadCount > 0;
  return (
    <button onClick={onOpen} className="group w-full text-left p-3 rounded-2xl bg-white dark:bg-ink-850 shadow-soft-sm hover:-translate-y-0.5 active:scale-[0.99] transition flex items-center gap-3.5">
      <span className="relative shrink-0">
        <span className="block rounded-full p-[2.5px]" style={{ backgroundColor: MODE_COLOR[c.mode] }}>
          <Avatar src={c.other.avatarUrl} name={c.other.name} className="w-14 h-14 text-lg ring-2 ring-white dark:ring-ink-850" />
        </span>
        {c.needsAttention && <Dot className="absolute -top-0.5 -right-0.5 !ring-white dark:!ring-ink-850" />}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block font-serif text-lg font-semibold leading-tight truncate">{c.other.name}</span>
        <span className="block text-xs text-slate-500 dark:text-haze-400 truncate">{c.other.career || c.other.campus}</span>
        <span className={`flex items-start gap-1.5 text-sm leading-snug ${s.strong ? 'font-semibold text-slate-900 dark:text-slate-50' : 'text-slate-600 dark:text-haze-300'}`}>
          <s.Icon className="w-3.5 h-3.5 shrink-0 mt-[3px]" />
          <span className="line-clamp-2">{s.text}</span>
        </span>
        {c.lastMessage && (
          <span className={`flex items-start gap-1.5 text-sm leading-snug ${unread ? 'font-semibold text-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-haze-400'}`}>
            <MessageCircle className="w-3.5 h-3.5 shrink-0 mt-[3px]" />
            <span className="line-clamp-1">{c.lastSenderId === c.other.id ? `${first}: ` : 'Tú: '}{c.lastMessage}</span>
          </span>
        )}
      </span>
      {unread && <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-[11px] leading-5 text-center font-bold shrink-0" aria-label={`${c.unreadCount} mensajes sin leer`}>{c.unreadCount}</span>}
      <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
    </button>
  );
};

export const ConnectionsView: React.FC<{ onBackToDiscover?: () => void }> = ({ onBackToDiscover }) => {
  const { connections, isLoading, error, openMatchId, loadConnections, setOpenMatchId } = useConnectionsStore();
  const [tab, setTab] = useState<ConnectionModeKey | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  // Llegar desde "¡Hay match!": abre ese match directamente
  useEffect(() => {
    if (!openMatchId) return;
    const found = connections.find((c) => c.matchId === openMatchId);
    if (found) {
      setTab(found.mode);
      setActiveId(found.matchId);
      setOpenMatchId(null);
    }
  }, [openMatchId, connections, setOpenMatchId]);

  const currentTab: ConnectionModeKey =
    tab ?? (attentionCount(connections, 'friendship') === 0 && attentionCount(connections, 'dating') > 0 ? 'dating' : 'friendship');
  const active = connections.find((c) => c.matchId === activeId) ?? null;

  const groups = useMemo(() => {
    const list = connections.filter((c) => c.mode === currentTab);
    const isUpcoming = (c: Connection) => c.meetup?.status === 'accepted' && new Date(c.meetup.when).getTime() > Date.now();
    const forMe = list.filter((c) => c.meetup?.status === 'pending' && !c.meetup.proposedByMe);
    const upcoming = list.filter((c) => isUpcoming(c)).sort((a, b) => +new Date(a.meetup!.when) - +new Date(b.meetup!.when));
    const waiting = list.filter((c) => c.meetup?.status === 'pending' && c.meetup.proposedByMe);
    const used = new Set([...forMe, ...upcoming, ...waiting].map((c) => c.matchId));
    return { total: list.length, forMe, upcoming, waiting, rest: list.filter((c) => !used.has(c.matchId)) };
  }, [connections, currentTab]);

  if (active) return <MatchDetail key={active.matchId} connection={active} onBack={() => setActiveId(null)} />;

  const section = (title: string, items: Connection[]) =>
    items.length > 0 && (
      <section className="space-y-2.5" key={title}>
        <h3 className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-haze-400">{title}</h3>
        {items.map((c) => <Row key={c.matchId} c={c} onOpen={() => setActiveId(c.matchId)} />)}
      </section>
    );

  return (
    <div className="max-w-md w-full mx-auto space-y-5 pb-6">
      <div>
        <h2 className="text-4xl font-semibold leading-none">Tus <Highlight>matches</Highlight></h2>
        <p className="text-sm text-slate-500 dark:text-haze-400 mt-3">Escríbanse (los mensajes se borran a las 24 horas) o propón un lugar y una hora en la escuela para conocerse en persona.</p>
      </div>

      <div className="grid grid-cols-2 p-1 rounded-full bg-haze-100 dark:bg-ink-850 shadow-soft-sm" role="tablist" aria-label="Tipo de match">
        {TABS.map(({ id, label, Icon }) => {
          const on = currentTab === id;
          const n = attentionCount(connections, id);
          return (
            <button key={id} role="tab" aria-selected={on} onClick={() => setTab(id)} className={`relative h-10 rounded-full text-sm font-semibold transition-colors ${on ? 'text-slate-900' : 'text-slate-500 dark:text-haze-400 hover:text-slate-900 dark:hover:text-slate-50'}`}>
              {on && <motion.span layoutId="connections-tab" className="absolute inset-0 rounded-full shadow-sticker" style={{ backgroundColor: MODE_COLOR[id] }} transition={{ type: 'spring', stiffness: 380, damping: 26 }} />}
              <span className="relative flex items-center justify-center gap-1.5">
                <Icon className="w-4 h-4" /> {label}
                {n > 0 && <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-brand-600 text-white text-[10px] leading-[18px] font-bold">{n}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="flex gap-2 text-sm text-rose-700 dark:text-rose-400"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</p>
      )}

      {isLoading && connections.length === 0 ? (
        <Spinner />
      ) : groups.total === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center gap-4 px-6 py-12 rounded-3xl border-2 border-dashed border-slate-900/10 dark:border-white/10">
          <span className="w-16 h-16 rounded-full text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker" style={{ backgroundColor: MODE_COLOR[currentTab] }}>
            {currentTab === 'dating' ? <Heart className="w-7 h-7" /> : <Users className="w-7 h-7" />}
          </span>
          <h3 className="text-2xl font-semibold">{currentTab === 'dating' ? 'Aún no tienes matches de pareja' : 'Aún no tienes matches de amistad'}</h3>
          <p className="text-sm text-slate-500 dark:text-haze-400 max-w-[30ch]">Cuando a alguien le interese tu perfil y a ti el suyo, aparecerá aquí para que se escriban y propongan verse.</p>
          {onBackToDiscover && <button onClick={onBackToDiscover} className="h-12 px-6 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-glow-brand transition hover:-translate-y-0.5 active:scale-[0.97]">Ir a Descubrir</button>}
        </motion.div>
      ) : (
        <>
          {section('Esperan tu respuesta', groups.forMe)}
          {section('Próximos encuentros', groups.upcoming)}
          {section('Esperando respuesta', groups.waiting)}
          {section(groups.forMe.length + groups.upcoming.length + groups.waiting.length > 0 ? 'Sin plan todavía' : 'Tus matches', groups.rest)}
        </>
      )}
    </div>
  );
};
