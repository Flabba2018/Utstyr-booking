// =============================================================================
// Service: Bildeopplasting via Supabase Storage
// Brukes for tilstandsrapporter og avvik
// =============================================================================

import { supabase } from '../lib/supabase';

const BUCKET = 'equipment-images';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/** Last opp et bilde til Supabase Storage. Returnerer public URL. */
export async function uploadImage(
  file: File,
  folder: 'conditions' | 'deviations'
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Ugyldig filtype. Bruk JPEG, PNG eller WebP.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Filen er for stor. Maks 10 MB.');
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

/** Last opp flere bilder. Returnerer array av URL-er. */
export async function uploadImages(
  files: File[],
  folder: 'conditions' | 'deviations'
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const url = await uploadImage(file, folder);
    urls.push(url);
  }
  return urls;
}
