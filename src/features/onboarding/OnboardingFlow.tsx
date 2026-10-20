import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Instagram,
  Calendar,
  ShieldCheck,
  ChevronLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import {
  useAuthStore,
  calculateAge,
  type ConnectionModeKey,
  type DatingPrefs,
  type SeekingPrefs,
  DEFAULT_SEEKING,
} from '@/features/auth/authStore';
import { SeekingPicker } from '@/components/SeekingPicker';
import { ArrowRightIcon, UserGroupIcon, HeartIcon, CheckIcon } from '@/components/icons';
import { Wordmark, Highlight, MODE_COLOR, spring } from '@/components/brand';
import { PhotoManager } from '@/components/PhotoManager';
import { DEMO_CATALOG, loadCatalog, type Catalog } from '@/lib/catalog';
import { WEEKDAYS, TIME_BLOCKS, blockKey, blocksToSlots, slotsToBlocks } from './availability';

const TOTAL_STEPS = 8;
const GENDERS = [
  { value: 'female', label: 'Mujer' },
  { value: 'male', label: 'Hombre' },
  { value: 'non-binary', label: 'No binario' },
  { value: 'other', label: 'Otro' },
];

const inputCls =
  'w-full h-13 px-4 rounded-lg bg-white/70 dark:bg-white/[0.04] border-2 border-slate-900/10 dark:border-white/10 text-base text-slate-900 dark:text-slate-50 outline-none transition-colors duration-200 hover:border-slate-900/25 dark:hover:border-white/20 focus:border-slate-900 dark:focus:border-slate-50 focus:bg-white dark:focus:bg-white/[0.07] placeholder:text-slate-500 dark:placeholder:text-haze-400';
const textareaCls = inputCls.replace('h-13', 'min-h-28 py-3');
const labelCls = 'block text-sm font-semibold mb-2';
const chip = (on: boolean) =>
  `px-3.5 py-2 rounded-full text-sm font-medium transition-colors duration-150 ${
    on
      ? 'bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900'
      : 'bg-haze-100 dark:bg-ink-800 text-slate-700 dark:text-slate-300 hover:bg-haze-200 dark:hover:bg-ink-700'
  }`;

const StepHeader: React.FC<{ title: React.ReactNode; subtitle: string }> = ({ title, subtitle }) => (
  <div className="space-y-3 pb-1">
    <h2 className="text-4xl sm:text-[2.75rem] font-semibold leading-[1.02] text-balance">{title}</h2>
    <p className="text-base text-slate-500 dark:text-haze-400 max-w-[40ch]">{subtitle}</p>
  </div>
);

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={onClick} aria-pressed={on} className={chip(on)}>
    {children}
  </motion.button>
);

export const OnboardingFlow: React.FC = () => {
  const { user, isDemo, completeOnboarding, logout } = useAuthStore();

  // Catálogo (campus, carreras, materias, intereses) desde Supabase
  const [catalog, setCatalog] = useState<Catalog | null>(isDemo ? DEMO_CATALOG : null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    setCatalogError(null);
    loadCatalog(user?.universityId)
      .then((c) => !cancelled && setCatalog(c))
      .catch((err: Error) => !cancelled && setCatalogError(err.message));
    return () => {
      cancelled = true;
    };
  }, [isDemo, user?.universityId, catalogAttempt]);

  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dir, setDir] = useState(1);

  // Formulario (se precarga con lo que ya exista en el perfil)
  const [fullName, setFullName] = useState(user?.name || '');
  const [birthDate, setBirthDate] = useState(user?.birthDate || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [pronouns, setPronouns] = useState(user?.pronouns || '');
  const [instagramHandle, setInstagramHandle] = useState(user?.instagramHandle || '');
  const [campusId, setCampusId] = useState(user?.campusId || '');
  const [careerId, setCareerId] = useState(user?.careerId || '');
  const [semester, setSemester] = useState<number>(user?.semester || 1);
  const [subjectIds, setSubjectIds] = useState<string[]>(user?.subjectIds || []);
  const [interestIds, setInterestIds] = useState<string[]>(user?.interestIds || []);
  const [blocks, setBlocks] = useState<Set<string>>(() => slotsToBlocks(user?.availability || []));
  const [bio, setBio] = useState(user?.bio || '');
  const [modes, setModes] = useState<Record<ConnectionModeKey, boolean>>(
    user?.connectionModes || { friendship: true, dating: false }
  );
  const [prefs, setPrefs] = useState<DatingPrefs>(user?.datingPrefs || { genders: [], minAge: 18, maxAge: null });
  const [seeking, setSeeking] = useState<SeekingPrefs>(user?.seeking || DEFAULT_SEEKING);
  const [acceptedRules, setAcceptedRules] = useState(false);

  const age = calculateAge(birthDate);
  const careerSubjects = useMemo(
    () => (catalog?.subjects || []).filter((s) => s.careerId === careerId),
    [catalog, careerId]
  );
  const interestsByCategory = useMemo(() => {
    const groups: Record<string, { id: string; name: string }[]> = {};
    for (const i of catalog?.interests || []) (groups[i.category] ||= []).push(i);
    return groups;
  }, [catalog]);

  // Si solo hay un campus, se selecciona solo
  useEffect(() => {
    if (catalog && !campusId && catalog.campuses.length === 1) setCampusId(catalog.campuses[0].id);
  }, [catalog, campusId]);

  // Al subir/quitar fotos, el aviso de "sube una foto" ya no aplica
  const photoCount = user?.photos.length ?? 0;
  useEffect(() => {
    setStepError(null);
  }, [photoCount]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const validate = (s: number): string | null => {
    switch (s) {
      case 1:
        if (fullName.trim().length < 3) return 'Escribe tu nombre completo.';
        if (!birthDate || age === undefined) return 'Indica tu fecha de nacimiento.';
        if (age < 18) return 'Debes tener 18 años o más para usar UniLink.';
        if (age > 99) return 'Revisa tu fecha de nacimiento.';
        if (!gender) return 'Selecciona tu género.';
        if (instagramHandle && !/^[A-Za-z0-9._]{1,30}$/.test(instagramHandle)) return 'El usuario de Instagram solo puede tener letras, números, puntos y guiones bajos.';
        return null;
      case 2:
        if (!campusId) return 'Selecciona tu campus.';
        if (!careerId) return 'Selecciona tu carrera.';
        return null;
      case 3:
        if (careerSubjects.length > 0 && subjectIds.length === 0) return 'Elige al menos una materia que estés cursando.';
        return null;
      case 4:
        if (interestIds.length < 3) return `Elige al menos 3 intereses (llevas ${interestIds.length}).`;
        return null;
      case 6:
        if (!user || user.photos.length === 0) return 'Sube al menos una foto para continuar.';
        return null;
      case 7:
        if (!Object.values(modes).some(Boolean)) return 'Activa al menos un modo de conexión.';
        if (modes.dating && prefs.maxAge !== null && prefs.maxAge < (prefs.minAge ?? 18)) return 'La edad máxima debe ser mayor que la mínima.';
        return null;
      case 8:
        if (!acceptedRules) return 'Debes aceptar el código de conducta.';
        return null;
      default:
        return null;
    }
  };

  const handleFinish = async () => {
    if (!catalog) return;
    setSaving(true);
    const res = await completeOnboarding({
      name: fullName.trim(),
      birthDate,
      gender,
      pronouns,
      instagramHandle,
      bio,
      campusId,
      campus: catalog.campuses.find((c) => c.id === campusId)?.name || '',
      careerId,
      career: catalog.careers.find((c) => c.id === careerId)?.name || '',
      semester,
      subjectIds,
      subjects: careerSubjects.filter((s) => subjectIds.includes(s.id)).map((s) => s.name),
      interestIds,
      interests: (catalog.interests || []).filter((i) => interestIds.includes(i.id)).map((i) => i.name),
      availability: blocksToSlots(blocks),
      connectionModes: modes,
      datingPrefs: prefs,
      seeking,
    });
    setSaving(false);
    // Si salió bien, el guardia de rutas manda solo a Descubrir.
    if (!res.success) setStepError(res.message || 'No se pudo guardar.');
  };

  const handleNext = () => {
    const err = validate(step);
    setStepError(err);
    if (err) return;
    setDir(1);
    if (step < TOTAL_STEPS) setStep(step + 1);
    else void handleFinish();
  };

  const handleBack = () => {
    setStepError(null);
    setDir(-1);
    if (step > 1) setStep(step - 1);
  };

  if (!user) return null;

  // ---- Estados de carga del catálogo ----
  if (!catalog) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-haze-50 dark:bg-ink-950 text-slate-900 dark:text-slate-50">
        {catalogError ? (
          <div className="max-w-sm text-center space-y-5">
            <span className="w-14 h-14 mx-auto rounded-full bg-sun text-slate-900 flex items-center justify-center -rotate-6 shadow-sticker">
              <AlertCircle className="w-6 h-6" />
            </span>
            <p className="text-base">{catalogError}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setCatalogAttempt((n) => n + 1)}
                className="h-12 px-5 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold flex items-center gap-1.5 transition active:scale-[0.97]"
              >
                <RefreshCw className="w-4 h-4" /> Reintentar
              </button>
              <button
                onClick={() => void logout()}
                className="h-12 px-5 rounded-full text-sm font-semibold flex items-center gap-1.5 hover:bg-haze-100 dark:hover:bg-ink-800 transition"
              >
                <LogOut className="w-4 h-4" /> Salir
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5" role="status">
            <Wordmark className="text-5xl animate-pulse" />
            <span className="sr-only">Cargando…</span>
          </div>
        )}
      </div>
    );
  }

  const catalogEmpty = catalog.careers.length === 0 || catalog.interests.length === 0;
  const isLast = step === TOTAL_STEPS;

  return (
    <div className="min-h-screen bg-haze-50 dark:bg-ink-950 text-slate-900 dark:text-slate-50 flex flex-col transition-colors duration-500 overflow-x-hidden">
      {/* Encabezado con progreso */}
      <header className="max-w-md w-full mx-auto px-5 pt-5 space-y-4">
        <div className="flex items-center justify-between h-10">
          <div className="flex items-center gap-2">
            <AnimatePresence initial={false}>
              {step > 1 && (
                <motion.button
                  initial={{ opacity: 0, x: -8, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 40 }}
                  exit={{ opacity: 0, x: -8, width: 0 }}
                  onClick={handleBack}
                  aria-label="Paso anterior"
                  className="h-10 flex items-center justify-center rounded-full border-2 border-slate-900/10 dark:border-white/10 hover:border-slate-900 dark:hover:border-slate-50 transition-colors"
                >
                  <ChevronLeft className="w-4.5 h-4.5" />
                </motion.button>
              )}
            </AnimatePresence>
            <Wordmark className="text-2xl" />
          </div>
          <span className="text-sm font-semibold tabular-nums text-slate-500 dark:text-haze-400">
            <span className="text-slate-900 dark:text-slate-50">{step}</span> / {TOTAL_STEPS}
          </span>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full bg-slate-900/[0.08] dark:bg-white/[0.08] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-brand-600 dark:bg-brand-400"
                initial={false}
                animate={{ width: i < step ? '100%' : '0%' }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-md w-full mx-auto px-5 py-8 flex-1 flex flex-col">
        {catalogEmpty && (
          <p className="mb-5 text-sm p-3.5 rounded-lg bg-sun/25 dark:bg-sun/10 text-amber-900 dark:text-amber-200">
            Tu base de datos no tiene carreras o intereses todavía. Corre <code className="font-mono text-[0.85em]">supabase/setup.sql</code> en el SQL Editor.
          </p>
        )}

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -32 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {/* PASO 1: Sobre ti */}
            {step === 1 && (
              <>
                <StepHeader title={<>Cuéntanos <Highlight>sobre ti</Highlight></>} subtitle="Tu información básica" />
                <div>
                  <label className={labelCls} htmlFor="ob-name">Nombre completo</label>
                  <input id="ob-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={`${inputCls} font-serif text-lg`} autoComplete="name" />
                </div>
                <div>
                  <label className={`${labelCls} flex items-center justify-between`} htmlFor="ob-birth">
                    <span>Fecha de nacimiento</span>
                    <AnimatePresence>
                      {age !== undefined && (
                        <motion.span
                          initial={{ scale: 0, rotate: -12 }}
                          animate={{ scale: 1, rotate: 3 }}
                          exit={{ scale: 0 }}
                          className="px-2.5 py-0.5 rounded-full bg-sun text-slate-900 text-xs font-bold"
                        >
                          {age} años
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </label>
                  <div className="relative">
                    <input
                      id="ob-birth"
                      type="date"
                      value={birthDate}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className={inputCls}
                    />
                    <Calendar className="w-4 h-4 text-slate-500 dark:text-haze-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls} htmlFor="ob-gender">Género</label>
                    <select id="ob-gender" value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
                      <option value="">Selecciona…</option>
                      {GENDERS.map((g) => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="ob-pronouns">Pronombres <span className="font-normal text-slate-500 dark:text-haze-400">(opcional)</span></label>
                    <input id="ob-pronouns" value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="Ella / Él / Elle" className={inputCls} />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-coral/25 dark:bg-coral/10 space-y-2.5">
                  <label className="text-sm font-semibold flex items-center gap-2" htmlFor="ob-ig">
                    <span className="w-7 h-7 rounded-full bg-coral text-slate-900 flex items-center justify-center -rotate-6">
                      <Instagram className="w-4 h-4" />
                    </span>
                    Instagram <span className="font-normal text-slate-500 dark:text-haze-400">(opcional)</span>
                  </label>
                  <div className="flex items-center w-full h-12 px-4 rounded-lg bg-white dark:bg-white/[0.05] border-2 border-transparent focus-within:border-slate-900 dark:focus-within:border-slate-50 transition-colors">
                    <span className="text-slate-500 dark:text-haze-400 font-semibold mr-1">@</span>
                    <input
                      id="ob-ig"
                      value={instagramHandle}
                      onChange={(e) => setInstagramHandle(e.target.value.replace(/@/g, '').trim())}
                      placeholder="usuario"
                      className="w-full bg-transparent text-base outline-none placeholder:text-slate-500 dark:placeholder:text-haze-400"
                    />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-haze-400">Solo lo verán tus matches.</p>
                </div>
              </>
            )}

            {/* PASO 2: Carrera */}
            {step === 2 && (
              <>
                <StepHeader title={<>¿Qué <Highlight>estudias</Highlight>?</>} subtitle="Para conectarte con tu campus y tu facultad" />
                <div>
                  <label className={labelCls} htmlFor="ob-campus">Campus</label>
                  <select id="ob-campus" value={campusId} onChange={(e) => setCampusId(e.target.value)} className={inputCls}>
                    <option value="">Selecciona…</option>
                    {catalog.campuses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="ob-career">Carrera</label>
                  <select
                    id="ob-career"
                    value={careerId}
                    onChange={(e) => {
                      setCareerId(e.target.value);
                      setSubjectIds([]);
                    }}
                    className={inputCls}
                  >
                    <option value="">Selecciona…</option>
                    {catalog.careers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="ob-sem">Semestre actual</label>
                  <select id="ob-sem" value={semester} onChange={(e) => setSemester(Number(e.target.value))} className={inputCls}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}.° semestre</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* PASO 3: Materias */}
            {step === 3 && (
              <>
                <StepHeader title={<>Tus <Highlight>materias</Highlight></>} subtitle="Las que cursas este semestre, para que te encuentren compañeros que llevan lo mismo" />
                {careerSubjects.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-haze-400">Aún no hay materias registradas para tu carrera. Puedes continuar.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {careerSubjects.map((s) => (
                      <Chip key={s.id} on={subjectIds.includes(s.id)} onClick={() => setSubjectIds(toggle(subjectIds, s.id))}>
                        {s.name}
                      </Chip>
                    ))}
                  </div>
                )}
                <p className="text-sm text-slate-500 dark:text-haze-400">{subjectIds.length} seleccionadas</p>
              </>
            )}

            {/* PASO 4: Intereses (afinidades) */}
            {step === 4 && (
              <>
                <StepHeader title={<>¿Qué te <Highlight>late</Highlight>?</>} subtitle="Elige al menos 3. Podrás cambiarlos después en tu perfil." />
                <div className="space-y-5">
                  {Object.entries(interestsByCategory).map(([category, items]) => (
                    <div key={category} className="space-y-2">
                      <h3 className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-haze-400">{category}</h3>
                      <div className="flex flex-wrap gap-2">
                        {items.map((i) => (
                          <Chip key={i.id} on={interestIds.includes(i.id)} onClick={() => setInterestIds(toggle(interestIds, i.id))}>
                            {i.name}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm font-semibold">
                  <span className={interestIds.length >= 3 ? 'text-azure-700 dark:text-azure-300' : 'text-slate-500 dark:text-haze-400'}>
                    {interestIds.length} seleccionados
                  </span>{' '}
                  <span className="font-normal text-slate-500 dark:text-haze-400">(mínimo 3)</span>
                </p>
              </>
            )}

            {/* PASO 5: Horario libre */}
            {step === 5 && (
              <>
                <StepHeader
                  title={<>¿Cuándo estás <Highlight>libre</Highlight>?</>}
                  subtitle="Toca los bloques en los que sueles tener tiempo. Es opcional, pero ayuda a encontrar a quien coincide contigo."
                />
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs border-separate border-spacing-1">
                    <thead>
                      <tr>
                        <th />
                        {WEEKDAYS.map((d) => (
                          <th key={d.value} className="font-semibold text-slate-500 dark:text-haze-400 pb-1">{d.short}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TIME_BLOCKS.map((b, bi) => (
                        <tr key={b.label}>
                          <th className="text-left font-semibold pr-1.5 whitespace-nowrap">
                            {b.label}
                            <span className="block font-normal text-[10px] text-slate-500 dark:text-haze-400 tabular-nums">{b.start}–{b.end}</span>
                          </th>
                          {WEEKDAYS.map((d) => {
                            const key = blockKey(d.value, bi);
                            const on = blocks.has(key);
                            return (
                              <td key={key}>
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.85 }}
                                  aria-pressed={on}
                                  aria-label={`${d.label} ${b.label}`}
                                  onClick={() =>
                                    setBlocks((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(key)) next.delete(key);
                                      else next.add(key);
                                      return next;
                                    })
                                  }
                                  className={`w-full h-10 rounded-lg transition-colors flex items-center justify-center ${
                                    on ? 'bg-mint text-slate-900' : 'bg-slate-900/[0.06] dark:bg-white/[0.06] hover:bg-slate-900/[0.12] dark:hover:bg-white/[0.12]'
                                  }`}
                                >
                                  {on && <CheckIcon className="w-4 h-4" strokeWidth={2.5} />}
                                </motion.button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* PASO 6: Fotos y bio */}
            {step === 6 && (
              <>
                <StepHeader title={<>Tu <Highlight>mejor</Highlight> ángulo</>} subtitle="Sube 1 o 2 fotos desde tu galería o cámara" />
                <PhotoManager />
                <div>
                  <label className={`${labelCls} flex justify-between`} htmlFor="ob-bio">
                    <span>Biografía corta</span>
                    <span className="text-xs font-medium text-slate-500 dark:text-haze-400 tabular-nums">{bio.length}/300</span>
                  </label>
                  <textarea
                    id="ob-bio"
                    rows={3}
                    maxLength={300}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Algo sobre ti, lo que te apasiona o lo que buscas en el campus…"
                    className={textareaCls}
                  />
                </div>
              </>
            )}

            {/* PASO 7: Modos */}
            {step === 7 && (
              <>
                <StepHeader
                  title={<>¿Qué <Highlight>buscas</Highlight>?</>}
                  subtitle="Activa los modos en los que quieres aparecer y elige a quién quieres conocer en cada uno."
                />
                <div className="space-y-3">
                  {(
                    [
                      { key: 'friendship', title: 'Amistades', desc: 'Encuentra compañeros por carrera, materias y lo que les gusta hacer', Icon: UserGroupIcon },
                      { key: 'dating', title: 'Modo Pareja', desc: 'Citas seguras entre estudiantes verificados', Icon: HeartIcon },
                    ] as const
                  ).map(({ key, title, desc, Icon }) => {
                    const on = modes[key];
                    return (
                      <div
                        key={key}
                        className={`rounded-2xl transition-all duration-200 border-2 ${
                          on ? 'border-transparent shadow-sticker' : 'border-slate-900/10 dark:border-white/10 hover:border-slate-900/25 dark:hover:border-white/25'
                        }`}
                        style={on ? { backgroundColor: MODE_COLOR[key] } : undefined}
                      >
                        <label className="p-4 cursor-pointer flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                                on ? 'bg-white/60 text-slate-900' : 'bg-haze-100 dark:bg-ink-800'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </span>
                            <div className={on ? 'text-slate-900' : ''}>
                              <span className="block font-serif text-lg font-semibold leading-tight">{title}</span>
                              <span className={`block text-sm ${on ? 'text-slate-800' : 'text-slate-500 dark:text-haze-400'}`}>{desc}</span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) => setModes({ ...modes, [key]: e.target.checked })}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 ${
                              on ? 'bg-slate-900' : 'bg-slate-900/15 dark:bg-white/15'
                            }`}
                          >
                            <motion.span
                              layout
                              transition={spring}
                              className={`absolute top-1 w-4 h-4 rounded-full ${on ? 'right-1 bg-white' : 'left-1 bg-white dark:bg-haze-300'}`}
                            />
                          </span>
                        </label>

                        <AnimatePresence initial={false}>
                          {on && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.22 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4">
                                <SeekingPicker
                                  value={seeking[key]}
                                  onChange={(v) => setSeeking({ ...seeking, [key]: v })}
                                  label={`A quién quieres conocer en ${title}`}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-slate-500 dark:text-haze-400">
                  Solo verás a quien también quiera conocer a alguien como tú. Puedes cambiarlo cuando quieras en tu perfil.
                </p>

                <AnimatePresence initial={false}>
                  {modes.dating && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 rounded-2xl bg-coral/20 dark:bg-coral/10 space-y-4">
                        <p className="font-serif text-lg font-semibold">Edad en Modo Pareja</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls} htmlFor="ob-min">Edad mínima</label>
                            <input
                              id="ob-min"
                              type="number"
                              min={18}
                              max={99}
                              value={prefs.minAge ?? 18}
                              onChange={(e) => setPrefs({ ...prefs, minAge: Math.max(18, Number(e.target.value) || 18) })}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls} htmlFor="ob-max">Edad máxima</label>
                            <input
                              id="ob-max"
                              type="number"
                              min={18}
                              max={99}
                              placeholder="Sin límite"
                              value={prefs.maxAge ?? ''}
                              onChange={(e) => setPrefs({ ...prefs, maxAge: e.target.value ? Number(e.target.value) : null })}
                              className={inputCls}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {/* PASO 8: Código de conducta */}
            {step === 8 && (
              <>
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: -6 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  className="w-16 h-16 rounded-full bg-mint text-slate-900 flex items-center justify-center shadow-sticker"
                >
                  <ShieldCheck className="w-8 h-8" />
                </motion.span>
                <StepHeader title={<>Una comunidad <Highlight>segura</Highlight></>} subtitle="UniLink es un espacio respetuoso para tu universidad" />
                <ul className="space-y-2.5">
                  {[
                    'Trato a todas las personas con respeto.',
                    'Cero tolerancia al acoso, la discriminación o el lenguaje ofensivo.',
                    'Solo puedo chatear cuando hay match mutuo.',
                    'Mi perfil es auténtico y usa fotos mías.',
                  ].map((rule) => (
                    <li key={rule} className="flex items-start gap-3 text-base">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-mint text-slate-900 flex items-center justify-center shrink-0">
                        <CheckIcon className="w-3 h-3" strokeWidth={3} />
                      </span>
                      {rule}
                    </li>
                  ))}
                </ul>
                <label
                  className={`flex items-center gap-3 p-4 rounded-2xl text-sm font-semibold cursor-pointer border-2 transition-colors ${
                    acceptedRules ? 'border-slate-900 dark:border-slate-50' : 'border-slate-900/10 dark:border-white/10 hover:border-slate-900/25'
                  }`}
                >
                  <input type="checkbox" checked={acceptedRules} onChange={(e) => setAcceptedRules(e.target.checked)} className="w-5 h-5 shrink-0" />
                  Acepto el código de conducta y el aviso de privacidad
                </label>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-auto pt-8 space-y-3">
          <AnimatePresence>
            {stepError && (
              <motion.p
                initial={{ opacity: 0, y: 6, x: 0 }}
                animate={{ opacity: 1, y: 0, x: [0, -6, 6, -3, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                role="alert"
                className="text-sm text-rose-900 dark:text-rose-200 flex items-start gap-2 p-3.5 rounded-lg bg-rose-100 dark:bg-rose-950/50"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{stepError}</span>
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={handleNext}
            disabled={saving}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97, y: 0 }}
            transition={spring}
            className="group w-full h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-base font-semibold flex items-center justify-center gap-2 shadow-glow-brand transition-colors disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Guardando tu perfil…
              </>
            ) : (
              <>
                <span>{isLast ? 'Terminar y empezar a descubrir' : 'Continuar'}</span>
                <ArrowRightIcon className="w-4.5 h-4.5 transition-transform duration-200 group-hover:translate-x-1" />
              </>
            )}
          </motion.button>
        </div>
      </main>

      <footer className="max-w-md w-full mx-auto px-5 pb-5 flex justify-between gap-3 text-xs text-slate-500 dark:text-haze-400">
        <span className="truncate">{user.email}</span>
        <button onClick={() => void logout()} className="shrink-0 underline underline-offset-4 hover:text-slate-900 dark:hover:text-slate-50">
          Cerrar sesión
        </button>
      </footer>
    </div>
  );
};
