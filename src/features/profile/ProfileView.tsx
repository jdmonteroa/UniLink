import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Instagram, Edit3, Check, X, Loader2, PauseCircle, PlayCircle, Clock } from 'lucide-react';
import { useAuthStore, formatSemester, DEFAULT_SEEKING, type ConnectionModeKey, type Seeking } from '@/features/auth/authStore';
import { SeekingPicker } from '@/components/SeekingPicker';
import { InstallCard } from '@/components/InstallCard';
import { AndroidDownloadCard } from '@/components/AndroidDownloadCard';
import { CheckBadgeIcon, BookOpenIcon, UserGroupIcon, HeartIcon } from '@/components/icons';
import { PhotoManager } from '@/components/PhotoManager';
import { Avatar } from '@/components/Avatar';
import { MODE_COLOR, spring } from '@/components/brand';
import { DEMO_CATALOG, loadCatalog, type Interest } from '@/lib/catalog';
import { WEEKDAYS } from '@/features/onboarding/availability';

const card = 'rounded-3xl bg-white dark:bg-ink-850 p-5 shadow-soft-sm space-y-4';
const sectionTitle = 'text-xl font-semibold leading-tight';
const labelCls = 'block mb-1.5 text-sm font-semibold';
const inputCls =
  'w-full px-4 py-3 rounded-lg bg-white/70 dark:bg-white/[0.04] border-2 border-slate-900/10 dark:border-white/10 text-base outline-none focus:border-slate-900 dark:focus:border-slate-50 transition-colors placeholder:text-slate-500 dark:placeholder:text-haze-400';
const textBtn =
  'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-semibold transition';
const chipOn = 'bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900';
const chipOff = 'bg-haze-100 dark:bg-ink-800 text-slate-700 dark:text-slate-300 hover:bg-haze-200 dark:hover:bg-ink-700';

const MODE_ICON = { study: BookOpenIcon, friendship: UserGroupIcon, dating: HeartIcon } as const;

const MODES: { key: ConnectionModeKey; label: string }[] = [
  { key: 'study', label: 'Estudio' },
  { key: 'friendship', label: 'Amistad' },
  { key: 'dating', label: 'Pareja' },
];

const Feedback: React.FC<{ msg: { ok: boolean; text: string } | null }> = ({ msg }) =>
  msg ? (
    <p className={`text-sm font-semibold ${msg.ok ? 'text-azure-700 dark:text-azure-300' : 'text-rose-700 dark:text-rose-400'}`}>
      {msg.text}
    </p>
  ) : null;

export const ProfileView: React.FC = () => {
  const { user, isDemo, updateProfile } = useAuthStore();

  // --- Datos básicos ---
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [instagram, setInstagram] = useState(user?.instagramHandle || '');
  const [pronouns, setPronouns] = useState(user?.pronouns || '');
  const [savingBasics, setSavingBasics] = useState(false);
  const [basicsMsg, setBasicsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // --- Intereses ---
  const [editingInterests, setEditingInterests] = useState(false);
  const [allInterests, setAllInterests] = useState<Interest[] | null>(null);
  const [interestIds, setInterestIds] = useState<string[]>(user?.interestIds || []);
  const [interestsMsg, setInterestsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingInterests, setSavingInterests] = useState(false);

  // --- Modos ---
  const [modesMsg, setModesMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!editingInterests || allInterests) return;
    if (isDemo) {
      setAllInterests(DEMO_CATALOG.interests);
      return;
    }
    loadCatalog(user?.universityId)
      .then((c) => setAllInterests(c.interests))
      .catch((e: Error) => setInterestsMsg({ ok: false, text: e.message }));
  }, [editingInterests, allInterests, isDemo, user?.universityId]);

  const grouped = useMemo(() => {
    const g: Record<string, Interest[]> = {};
    for (const i of allInterests || []) (g[i.category] ||= []).push(i);
    return g;
  }, [allInterests]);

  if (!user) return null;

  const startEdit = () => {
    setBio(user.bio);
    setInstagram(user.instagramHandle);
    setPronouns(user.pronouns || '');
    setBasicsMsg(null);
    setEditing(true);
  };

  const saveBasics = async () => {
    if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) {
      setBasicsMsg({ ok: false, text: 'Usuario de Instagram no válido.' });
      return;
    }
    setSavingBasics(true);
    const res = await updateProfile({ bio, instagramHandle: instagram, pronouns });
    setSavingBasics(false);
    if (res.success) {
      setEditing(false);
      setBasicsMsg({ ok: true, text: '✓ Perfil actualizado' });
    } else setBasicsMsg({ ok: false, text: res.message || 'No se pudo guardar.' });
  };

  const saveInterests = async () => {
    setSavingInterests(true);
    const names = (allInterests || []).filter((i) => interestIds.includes(i.id)).map((i) => i.name);
    const res = await updateProfile({ interestIds, interests: names });
    setSavingInterests(false);
    if (res.success) {
      setEditingInterests(false);
      setInterestsMsg({ ok: true, text: '✓ Intereses actualizados' });
    } else setInterestsMsg({ ok: false, text: res.message || 'No se pudo guardar.' });
  };

  const toggleMode = async (key: ConnectionModeKey) => {
    const next = { ...user.connectionModes, [key]: !user.connectionModes[key] };
    const res = await updateProfile({ connectionModes: next });
    setModesMsg(res.success ? null : { ok: false, text: res.message || 'No se pudo guardar.' });
  };

  const changeSeeking = async (key: ConnectionModeKey, value: Seeking) => {
    const next = { ...(user.seeking ?? DEFAULT_SEEKING), [key]: value };
    const res = await updateProfile({ seeking: next });
    setModesMsg(res.success ? null : { ok: false, text: res.message || 'No se pudo guardar.' });
  };

  const togglePause = async () => {
    const res = await updateProfile({ isPaused: !user.isPaused });
    setModesMsg(res.success ? null : { ok: false, text: res.message || 'No se pudo guardar.' });
  };

  return (
    <div className="max-w-md w-full mx-auto space-y-4 pb-6">
      {/* Encabezado */}
      <section className="pt-2 pb-1 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="relative shrink-0">
            <motion.div
              initial={{ rotate: 0, scale: 0.9 }}
              animate={{ rotate: -4, scale: 1 }}
              transition={spring}
              className="rounded-full p-1 bg-sun"
            >
              <Avatar src={user.avatarUrl} name={user.name} className="w-24 h-24 text-3xl ring-4 ring-haze-50 dark:ring-ink-950" />
            </motion.div>
            {user.isVerified && (
              <span className="absolute bottom-0 right-0 w-8 h-8 flex items-center justify-center rounded-full bg-mint text-slate-900 ring-4 ring-haze-50 dark:ring-ink-950" title="Verificado">
                <CheckBadgeIcon className="w-4 h-4" />
              </span>
            )}
          </div>
          {!editing ? (
            <button onClick={startEdit} className={`${textBtn} border-2 border-slate-900/10 dark:border-white/10 hover:border-slate-900 dark:hover:border-slate-50`}>
              <Edit3 className="w-3.5 h-3.5" /> Editar
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button onClick={() => setEditing(false)} className={`${textBtn} px-0 w-9 justify-center hover:bg-haze-100 dark:hover:bg-ink-800`} aria-label="Cancelar">
                <X className="w-4 h-4" />
              </button>
              <button onClick={() => void saveBasics()} disabled={savingBasics} className={`${textBtn} bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60`}>
                {savingBasics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar
              </button>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-4xl font-semibold leading-none">
            {user.name}
            {user.age ? <span className="font-normal italic">, {user.age}</span> : ''}
          </h2>
          <p className="text-sm text-brand-600 dark:text-brand-400 font-semibold mt-2">
            {[user.career, formatSemester(user.semester)].filter(Boolean).join(' · ')}
          </p>
          <p className="text-sm text-slate-500 dark:text-haze-400">{user.campus}</p>
        </div>

        {!editing && user.instagramHandle && (
          <a
            href={`https://instagram.com/${user.instagramHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-coral text-slate-900 text-sm font-semibold -rotate-2 shadow-sticker hover:rotate-0 transition"
          >
            <Instagram className="w-4 h-4" /> @{user.instagramHandle}
          </a>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className={card}
            >
              <div>
                <label className={`${labelCls} flex justify-between`} htmlFor="pf-bio">
                  <span>Biografía</span>
                  <span className="text-xs font-medium text-slate-500 dark:text-haze-400">{bio.length}/300</span>
                </label>
                <textarea id="pf-bio" rows={3} maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="pf-ig">Instagram</label>
                  <input id="pf-ig" value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/@/g, '').trim())} placeholder="usuario" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="pf-pr">Pronombres</label>
                  <input id="pf-pr" value={pronouns} onChange={(e) => setPronouns(e.target.value)} className={inputCls} />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="bio"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-base text-slate-700 dark:text-slate-300 leading-relaxed"
            >
              {user.bio || <span className="font-serif italic text-slate-500 dark:text-haze-400">Sin biografía aún.</span>}
            </motion.p>
          )}
        </AnimatePresence>
        <Feedback msg={basicsMsg} />
      </section>

      <InstallCard />
      <AndroidDownloadCard />

      {/* Modos */}
      <section className={card}>
        <h3 className={sectionTitle}>Dónde quiero aparecer</h3>
        <p className="text-sm text-slate-500 dark:text-haze-400 -mt-2">
          Solo verás a quien también quiera conocer a alguien como tú.
        </p>
        <div className="space-y-2.5">
          {MODES.map((m) => {
            const on = user.connectionModes[m.key];
            const Icon = MODE_ICON[m.key];
            return (
              <div
                key={m.key}
                className={`rounded-2xl border-2 transition-colors ${
                  on ? 'border-transparent shadow-sticker' : 'border-slate-900/10 dark:border-white/10'
                }`}
                style={on ? { backgroundColor: MODE_COLOR[m.key] } : undefined}
              >
                <button
                  onClick={() => void toggleMode(m.key)}
                  aria-pressed={on}
                  className={`w-full flex items-center justify-between gap-3 p-3.5 text-left ${on ? 'text-slate-900' : ''}`}
                >
                  <span className="flex items-center gap-2.5 font-semibold">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center ${on ? 'bg-white/60' : 'bg-haze-100 dark:bg-ink-800'}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </span>
                    {m.label}
                  </span>
                  <span
                    aria-hidden
                    className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${on ? 'bg-slate-900' : 'bg-slate-900/15 dark:bg-white/15'}`}
                  >
                    <motion.span
                      layout
                      transition={spring}
                      className={`absolute top-1 w-4 h-4 rounded-full ${on ? 'right-1 bg-white' : 'left-1 bg-white dark:bg-haze-300'}`}
                    />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 pb-3.5">
                        <SeekingPicker
                          value={user.seeking?.[m.key] ?? 'everyone'}
                          onChange={(v) => void changeSeeking(m.key, v)}
                          label={`A quién quieres conocer en ${m.label}`}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => void togglePause()}
          className={`w-full flex items-center gap-2.5 p-3 rounded-xl text-sm font-semibold text-left transition ${
            user.isPaused ? 'bg-sun/30 dark:bg-sun/15 text-slate-900 dark:text-slate-50' : 'hover:bg-haze-100 dark:hover:bg-ink-800 text-slate-600 dark:text-haze-300'
          }`}
        >
          {user.isPaused ? <PlayCircle className="w-5 h-5 shrink-0" /> : <PauseCircle className="w-5 h-5 shrink-0" />}
          {user.isPaused ? 'Tu perfil está pausado (nadie te ve). Toca para reactivarlo.' : 'Pausar mi perfil temporalmente'}
        </button>
        <Feedback msg={modesMsg} />
      </section>

      {/* Fotos */}
      <section className={card}>
        <h3 className={sectionTitle}>Mis fotos</h3>
        <PhotoManager />
      </section>

      {/* Intereses */}
      <section className={card}>
        <div className="flex items-center justify-between">
          <h3 className={sectionTitle}>Intereses</h3>
          {!editingInterests ? (
            <button
              onClick={() => {
                setInterestIds(user.interestIds);
                setInterestsMsg(null);
                setEditingInterests(true);
              }}
              className={`${textBtn} text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40`}
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-1">
              <button onClick={() => setEditingInterests(false)} className={`${textBtn} hover:bg-haze-100 dark:hover:bg-ink-800`}>
                Cancelar
              </button>
              <button onClick={() => void saveInterests()} disabled={savingInterests} className={`${textBtn} bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60`}>
                {savingInterests ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        {editingInterests ? (
          allInterests ? (
            <div className="space-y-3">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-haze-400 mb-1.5">{cat}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((i) => {
                      const on = interestIds.includes(i.id);
                      return (
                        <motion.button
                          key={i.id}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => setInterestIds(on ? interestIds.filter((x) => x !== i.id) : [...interestIds, i.id])}
                          aria-pressed={on}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${on ? chipOn : chipOff}`}
                        >
                          {i.name}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500 dark:text-haze-400">{interestIds.length} seleccionados (mínimo 3)</p>
            </div>
          ) : (
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
          )
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {user.interests.map((i) => (
              <span key={i} className={`px-3 py-1.5 rounded-full text-sm font-medium ${chipOff}`}>
                {i}
              </span>
            ))}
          </div>
        )}
        <Feedback msg={interestsMsg} />
      </section>

      {/* Académico */}
      <section className={card}>
        <h3 className={sectionTitle}>Materias que cursas</h3>
        <div className="flex flex-wrap gap-1.5">
          {user.subjects.length ? (
            user.subjects.map((s) => (
              <span key={s} className="px-3 py-1.5 rounded-full text-sm font-medium bg-mint/50 dark:bg-mint/15 text-slate-900 dark:text-azure-200">
                {s}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500 dark:text-haze-400">Sin materias registradas.</span>
          )}
        </div>
        {user.availability.length > 0 && (
          <>
            <h3 className={`${sectionTitle} pt-1 flex items-center gap-2`}>
              <Clock className="w-4.5 h-4.5 text-brand-600 dark:text-brand-400" /> Horario libre
            </h3>
            <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
              {user.availability.map((s) => (
                <li key={`${s.weekday}-${s.start}`} className="flex justify-between border-b border-slate-900/[0.06] dark:border-white/[0.06] pb-1 last:border-0">
                  <span>{WEEKDAYS.find((d) => d.value === s.weekday)?.label || 'Domingo'}</span>
                  <span className="tabular-nums text-slate-500 dark:text-haze-400">{s.start}–{s.end}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
};
