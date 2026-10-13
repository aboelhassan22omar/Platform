'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useRoomContext } from '@livekit/components-react';

const STORAGE_KEY = 'live-preferred-devices';

type DeviceKind = 'videoinput' | 'audioinput' | 'audiooutput';
export type PreferredDevices = Partial<Record<DeviceKind, string>>;

/** The teacher's last chosen camera / mic / speaker, used when the next live connects. */
export function readPreferredDevices(): PreferredDevices {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as PreferredDevices;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function rememberDevice(kind: DeviceKind, deviceId: string) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readPreferredDevices(), [kind]: deviceId }),
    );
  } catch {
    // A blocked storage only means the choice is not remembered next time.
  }
}

const FALLBACK_NAME: Record<DeviceKind, string> = {
  videoinput: 'كاميرا',
  audioinput: 'مايك',
  audiooutput: 'سماعة',
};

/** Browser labels like "Default - Microphone (Realtek…)" or "USB Camera (046d:0825)". */
const deviceName = (device: MediaDeviceInfo, index: number, kind: DeviceKind) => {
  const label = device.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim();
  if (device.deviceId === 'default') return `الافتراضي — ${label.replace(/^Default\s*-\s*/i, '')}`;
  return label || `${FALLBACK_NAME[kind]} ${index + 1}`;
};

/** Devices of one kind, refreshed whenever one is plugged in or removed. */
function useDevices(kind: DeviceKind) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return;
    let cancelled = false;
    const refresh = () =>
      media
        .enumerateDevices()
        .then((all) => {
          if (!cancelled)
            setDevices(all.filter((device) => device.kind === kind && device.deviceId));
        })
        .catch(() => undefined);
    void refresh();
    media.addEventListener('devicechange', refresh);
    return () => {
      cancelled = true;
      media.removeEventListener('devicechange', refresh);
    };
  }, [kind]);
  return devices;
}

function DeviceSelect({
  kind,
  label,
  onError,
}: {
  kind: DeviceKind;
  label: string;
  onError: (message: string) => void;
}) {
  const room = useRoomContext();
  const devices = useDevices(kind);
  const [activeDeviceId, setActiveDeviceId] = useState(
    () => room.getActiveDevice(kind) ?? readPreferredDevices()[kind] ?? 'default',
  );
  const [switching, setSwitching] = useState(false);

  if (!devices.length) {
    return (
      <div>
        <p className="text-xs font-bold text-white/70">{label}</p>
        <p className="mt-1 text-xs text-white/50">مفيش أجهزة ظاهرة. اتأكد إنها متوصلة.</p>
      </div>
    );
  }

  return (
    <label className="block">
      <span className="text-xs font-bold text-white/70">{label}</span>
      <select
        value={
          devices.some((device) => device.deviceId === activeDeviceId)
            ? activeDeviceId
            : devices[0].deviceId
        }
        disabled={switching}
        onChange={async (event) => {
          const deviceId = event.target.value;
          setSwitching(true);
          try {
            // Swaps the published track in place: students keep watching.
            const switched = await room.switchActiveDevice(kind, deviceId, true);
            if (switched === false) throw new Error('not switched');
            setActiveDeviceId(deviceId);
            rememberDevice(kind, deviceId);
          } catch {
            onError('مقدرناش نحوّل للجهاز ده. اتأكد إنه متوصل ومش مستخدم في برنامج تاني.');
          } finally {
            setSwitching(false);
          }
        }}
        className="mt-1 block min-h-11 w-full rounded-xl border border-white/15 bg-[#0b0f14] px-3 text-sm text-white focus:border-gold-400 focus:outline-none disabled:opacity-60"
      >
        {devices.map((device, index) => (
          <option key={device.deviceId || index} value={device.deviceId}>
            {deviceName(device, index, kind)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Lets the teacher pick which camera, microphone and speaker the live uses
 * (built-in or an external USB camera / mic), switching without leaving.
 */
export function DeviceSettings({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [canPickSpeaker, setCanPickSpeaker] = useState(false);

  useEffect(() => {
    // Choosing an output device needs setSinkId (Chrome, Edge; not Safari).
    setCanPickSpeaker('setSinkId' in HTMLMediaElement.prototype);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.15 }}
      role="dialog"
      aria-label="اختيار الكاميرا والمايك"
      className="absolute bottom-full left-1/2 z-40 mb-2 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 space-y-3 rounded-2xl border border-white/15 bg-[#151b24] p-4 text-start shadow-2xl"
    >
      <div className="flex items-center justify-between">
        <p className="font-bold text-white">الكاميرا والمايك</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10"
        >
          ×
        </button>
      </div>
      <DeviceSelect kind="videoinput" label="الكاميرا" onError={setError} />
      <DeviceSelect kind="audioinput" label="المايك" onError={setError} />
      {canPickSpeaker && <DeviceSelect kind="audiooutput" label="السماعة" onError={setError} />}
      {error && (
        <p role="alert" className="text-xs font-semibold text-red-300">
          {error}
        </p>
      )}
      <p className="text-[11px] leading-relaxed text-white/50">
        التبديل بيحصل فورًا من غير ما تخرج من اللايف، واختيارك بيتحفظ للايف الجاي. لو وصّلت كاميرا
        أو مايك جديد هيظهر هنا على طول.
      </p>
    </motion.div>
  );
}
