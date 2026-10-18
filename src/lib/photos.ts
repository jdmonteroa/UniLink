import { supabase, friendlyError } from '@/lib/supabaseClient';

export const AVATAR_BUCKET = 'avatars';
export const MAX_PHOTOS = 6;
const MAX_INPUT_BYTES = 20 * 1024 * 1024; // lo que aceptamos del celular antes de comprimir
const MAX_SIDE = 1440; // px del lado más largo tras comprimir
const JPEG_QUALITY = 0.85;

/**
 * Convierte lo que guardamos en profile_photos.storage_path en una URL que se
 * puede mostrar. Acepta rutas del bucket ("<uid>/foto.jpg") y URLs completas
 * (perfiles de prueba con Unsplash, o blobs del modo demo).
 */
export function photoUrl(path?: string | null): string {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** true si la ruta vive en nuestro bucket (y por lo tanto se puede borrar). */
export const isStoragePath = (path: string) => !/^(https?:|blob:|data:)/i.test(path);

function randomId(): string {
  // crypto.randomUUID no existe en http:// (ej. probando desde el celular por IP)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function decodeImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      // continúa con <img> (algunos navegadores no soportan el formato vía bitmap)
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen. Usa una foto JPG, PNG o WEBP.'));
    };
    img.src = url;
  });
}

/**
 * Reduce la foto a máx. 1440 px y la convierte a JPEG (~200-500 KB).
 * Así las fotos de celular de 5-10 MB suben rápido y caben en el límite del bucket.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
    throw new Error('El archivo no es una imagen.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('La foto pesa más de 20 MB. Elige una más ligera.');
  }

  const source = await decodeImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no pudo procesar la imagen.');
  ctx.fillStyle = '#ffffff'; // fondo blanco para PNG con transparencia
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  if ('close' in source && typeof source.close === 'function') source.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen.'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

function storageErrorMessage(err: unknown): string {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
  const lower = msg.toLowerCase();
  if (lower.includes('bucket not found'))
    return "No existe el bucket 'avatars' en Supabase. Corre supabase/setup.sql en el SQL Editor.";
  if (lower.includes('row-level security') || lower.includes('unauthorized') || lower.includes('403'))
    return 'Supabase no dejó subir la foto (políticas de Storage). Corre supabase/setup.sql y vuelve a iniciar sesión.';
  if (lower.includes('maximum allowed size') || lower.includes('payload too large'))
    return 'La foto es demasiado pesada para el bucket.';
  if (lower.includes('mime type')) return 'Formato no permitido. Usa JPG, PNG o WEBP.';
  return friendlyError(err, 'No se pudo subir la foto.');
}

/**
 * Comprime y sube una foto a avatars/<userId>/<id>.jpg.
 * Devuelve la ruta dentro del bucket (eso es lo que se guarda en profile_photos).
 */
export async function uploadProfilePhoto(userId: string, file: File): Promise<string> {
  const blob = await compressImage(file);
  const path = `${userId}/${randomId()}.jpg`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(storageErrorMessage(error));
  return path;
}

/** Borra archivos del bucket. Los errores se ignoran (el archivo ya no se usa). */
export async function removeStoredPhotos(paths: string[]): Promise<void> {
  const own = paths.filter(isStoragePath);
  if (own.length === 0) return;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove(own);
  if (error) console.warn('[UniLink] No se pudieron borrar fotos viejas del bucket:', error.message);
}

/** Reemplaza la lista ordenada de fotos del perfil en la tabla profile_photos. */
export async function saveProfilePhotos(userId: string, paths: string[]): Promise<void> {
  const { error: delError } = await supabase.from('profile_photos').delete().eq('profile_id', userId);
  if (delError) throw new Error(friendlyError(delError, 'No se pudieron guardar tus fotos.'));
  if (paths.length === 0) return;

  const rows = paths.slice(0, MAX_PHOTOS).map((storage_path, position) => ({
    profile_id: userId,
    storage_path,
    position,
  }));
  const { error } = await supabase.from('profile_photos').insert(rows);
  if (error) throw new Error(friendlyError(error, 'No se pudieron guardar tus fotos.'));
}
