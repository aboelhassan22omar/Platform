'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/**
 * Reads QR codes from the camera (the back camera on a phone). Works in every
 * modern browser, including Safari on iPhone, because decoding happens in
 * JavaScript rather than relying on the BarcodeDetector API.
 *
 * The same code is reported again only after `repeatAfterMs`, so holding a
 * card in front of the camera does not fire a stream of scans.
 */
export function QrScanner({
  onCode,
  repeatAfterMs = 4000,
}: {
  onCode: (text: string) => void;
  repeatAfterMs?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastRef = useRef<{ text: string; at: number } | null>(null);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;

    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (stopped || !video || !canvas) return;
      if (video.readyState >= 2 && video.videoWidth) {
        // Decode a downscaled frame: fast enough on older phones.
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height, {
            inversionAttempts: 'dontInvert',
          });
          const now = Date.now();
          if (
            code?.data &&
            !(
              lastRef.current &&
              lastRef.current.text === code.data &&
              now - lastRef.current.at < repeatAfterMs
            )
          ) {
            lastRef.current = { text: code.data, at: now };
            onCodeRef.current(code.data);
          }
        }
      }
      timer = window.setTimeout(scan, 200);
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((media) => {
        if (stopped) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        void video.play().catch(() => undefined);
        scan();
      })
      .catch(() =>
        setError('مقدرناش نفتح الكاميرا. اسمح للمتصفح يستخدم الكاميرا من علامة القفل جنب العنوان.'),
      );
    if (!navigator.mediaDevices)
      setError('المتصفح ده مش بيدعم الكاميرا. افتح الصفحة من Chrome أو Safari.');

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [repeatAfterMs]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      {/* Aiming frame */}
      <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="h-3/5 w-3/5 max-w-64 rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      {error && (
        <p
          role="alert"
          className="absolute inset-x-3 bottom-3 rounded-xl bg-red-600/90 p-3 text-sm font-bold text-white"
        >
          {error}
        </p>
      )}
    </div>
  );
}
