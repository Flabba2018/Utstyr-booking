import { useState, useRef } from 'react';
import { Camera, X, Loader } from 'lucide-react';
import { uploadImages } from '../../services/storage.service';

interface ImageUploadProps {
  folder: 'conditions' | 'deviations';
  onUpload: (urls: string[]) => void;
  maxFiles?: number;
}

export function ImageUpload({ folder, onUpload, maxFiles = 3 }: ImageUploadProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<File[]>([]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const remaining = maxFiles - filesRef.current.length;
    const toAdd = selected.slice(0, remaining);

    filesRef.current = [...filesRef.current, ...toAdd];
    const newPreviews = toAdd.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
    setError('');
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    filesRef.current = filesRef.current.filter((_, i) => i !== index);
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (filesRef.current.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const urls = await uploadImages(filesRef.current, folder);
      onUpload(urls);
      // Clear
      previews.forEach((p) => URL.revokeObjectURL(p));
      filesRef.current = [];
      setPreviews([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opplasting feilet');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">Bilder (valgfritt, maks {maxFiles})</label>

      {previews.length > 0 && (
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px',
        }}>
          {previews.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: '72px', height: '72px' }}>
              <img
                src={src}
                alt={`Bilde ${i + 1}`}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                }}
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                style={{
                  position: 'absolute', top: '-6px', right: '-6px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'var(--color-danger)', color: 'white',
                  border: 'none', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', padding: 0,
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        {previews.length < maxFiles && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileRef.current?.click()}
          >
            <Camera size={14} /> Velg bilde
          </button>
        )}
        {previews.length > 0 && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? <><Loader size={14} /> Laster opp...</> : `Last opp (${previews.length})`}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        onChange={handleFiles}
        style={{ display: 'none' }}
      />

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
