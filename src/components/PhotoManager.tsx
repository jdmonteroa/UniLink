import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, ChevronLeft, ChevronRight, Star, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { MAX_PHOTOS, photoUrl, removeStoredPhotos, uploadProfilePhoto } from '@/lib/photos';

/**
 * Administra las fotos del usuario: subir (con compresión), borrar, reordenar y
 * elegir la principal. Cada cambio se guarda al momento en Supabase.
 */
export const PhotoManager: React.FC = () => {
  const { user, isDemo, savePhotos } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const photos = user.photos;
  const slotsLeft = MAX_PHOTOS - photos.length - uploading;

  const persist = async (next: string[]) => {
    setBusy(true);
    const res = await savePhotos(next);
    setBusy(false);
    if (!res.success) setError(res.message || 'No se pudo guardar.');
    return res.success;
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const files = Array.from(fileList).slice(0, Math.max(0, slotsLeft));
    if (files.length < fileList.length) setError(`Máximo ${MAX_PHOTOS} fotos.`);

    setUploading((n) => n + files.length);
    const uploaded: string[] = [];
    for (const file of files) {
      try {
        const path = isDemo ? URL.createObjectURL(file) : await uploadProfilePhoto(user.id, file);
        uploaded.push(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo subir la foto.');
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = '';
    if (uploaded.length === 0) return;

    // Leemos el estado más reciente por si cambió mientras subía
    const latest = useAuthStore.getState().user?.photos ?? [];
    const ok = await persist([...latest, ...uploaded]);
    if (!ok && !isDemo) await removeStoredPhotos(uploaded); // no dejar archivos huérfanos
  };

  const removeAt = async (index: number) => {
    const target = photos[index];
    const ok = await persist(photos.filter((_, i) => i !== index));
    if (ok && !isDemo) await removeStoredPhotos([target]);
  };

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    [next[index], next[to]] = [next[to], next[index]];
    void persist(next);
  };

  const makeMain = (index: number) => {
    if (index === 0) return;
    const next = [...photos];
    const [picked] = next.splice(index, 1);
    void persist([picked, ...next]);
  };

  const tileBase = 'relative aspect-3/4 rounded-2xl overflow-hidden';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, idx) => (
          <div key={p} className={`${tileBase} group bg-haze-100 dark:bg-ink-800`}>
            <img src={photoUrl(p)} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />

            {idx === 0 ? (
              <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-sun text-slate-900 rounded-full px-2 py-0.5 -rotate-3 shadow-sticker">
                Principal
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makeMain(idx)}
                disabled={busy}
                className="absolute top-1.5 left-1.5 w-7 h-7 flex items-center justify-center rounded-full bg-white/85 text-slate-900 hover:bg-sun transition"
                aria-label="Usar como foto principal"
                title="Usar como principal"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => void removeAt(idx)}
              disabled={busy}
              className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-full bg-white/85 text-slate-900 hover:bg-brand-600 hover:text-white transition"
              aria-label={`Eliminar foto ${idx + 1}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {photos.length > 1 && (
              <div className="absolute bottom-1 inset-x-1 flex justify-between">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={busy || idx === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white/85 text-slate-900 hover:bg-white disabled:opacity-0 transition"
                  aria-label="Mover a la izquierda"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={busy || idx === photos.length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white/85 text-slate-900 hover:bg-white disabled:opacity-0 transition"
                  aria-label="Mover a la derecha"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}

        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} className={`${tileBase} border-2 border-dashed border-slate-900/15 dark:border-white/15 flex flex-col items-center justify-center gap-1 text-slate-500 dark:text-haze-400`}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[10px] font-semibold">Subiendo…</span>
          </div>
        ))}

        {slotsLeft > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={`${tileBase} border-2 border-dashed border-slate-900/15 dark:border-white/15 flex flex-col items-center justify-center gap-1.5 text-slate-600 dark:text-haze-300 hover:border-sun hover:bg-sun/15 hover:text-slate-900 dark:hover:text-slate-50 transition active:scale-[0.97]`}
          >
            <ImagePlus className="w-6 h-6" />
            <span className="text-xs font-semibold">Agregar foto</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <p className="text-xs text-slate-500 dark:text-haze-400">
        {photos.length}/{MAX_PHOTOS} fotos · La primera es tu foto principal. Se comprimen automáticamente.
      </p>

      {error && (
        <p className="text-sm text-rose-700 dark:text-rose-400 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
