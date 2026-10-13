'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * A scannable QR for `value`. Always dark-on-white with a quiet zone, whatever
 * the site theme: phone cameras read low-contrast or inverted codes badly.
 */
export function QrCode({
  value,
  label,
  size = 200,
}: {
  value: string;
  label: string;
  size?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 2, width: size * 2, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div
      className="grid place-items-center rounded-2xl bg-white p-2 shadow-sm"
      style={{ width: size + 16, height: size + 16 }}
    >
      {src ? (
        <img src={src} alt={label} width={size} height={size} />
      ) : (
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-midnight-300 border-t-transparent" />
      )}
    </div>
  );
}
