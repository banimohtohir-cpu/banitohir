export function resolveMemberPhotoUrl(raw?: string): string {
  const val = String(raw || '').trim();
  if (!val) return '';

  // Safe local compressed JPEG/PNG/WebP data URL
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(val)) {
    return val;
  }

  // Google Drive sharing URL -> direct thumbnail
  const driveMatch = val.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?id=)([A-Za-z0-9_-]{10,80})/i);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w256`;
  }

  // Standard http/https image URL
  if (/^https?:\/\/.+/i.test(val)) {
    return val;
  }

  // Bare Google Drive file ID
  if (/^[A-Za-z0-9_-]{15,80}$/.test(val)) {
    return `https://drive.google.com/thumbnail?id=${val}&sz=w256`;
  }

  return '';
}

export function getMemberInitials(name?: string): string {
  const cleaned = String(name || '')
    .replace(/^(H\.|Hj\.|Dr\.|Ir\.|Prof\.|KH\.|K\.H\.|Drs\.|Dra\.)\s+/gi, '')
    .trim();
  if (!cleaned) return 'BT';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export function compressImageFileToDataUrl(file: File, maxDim = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File harus berupa gambar (JPG, PNG, atau WebP).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak dapat diproses.'));
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas browser tidak tersedia.'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (dataUrl.length > 350000) {
          resolve(canvas.toDataURL('image/jpeg', 0.65));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
