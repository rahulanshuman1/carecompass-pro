/** Center-crops to a square and resizes to a small JPEG data URL (keeps uploads ~20-30 KB). */
export function photoToDataUrl(file, size = 256, maxChars = 120_000) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Please choose an image file.'));
    if (file.size > 10 * 1024 * 1024) return reject(new Error('That image is too large (max 10 MB).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.width, img.height);
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        let q = 0.85, out = c.toDataURL('image/jpeg', q);
        while (out.length > maxChars && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        resolve(out);
      } catch { reject(new Error('Could not process that image.')); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image. Try a JPEG or PNG.')); };
    img.src = url;
  });
}
