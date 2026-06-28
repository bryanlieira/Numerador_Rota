import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Flashlight, FlashlightOff } from 'lucide-react';

interface QRScannerProps {
  onScan: (text: string) => void;
  /** CSS-only hide/show. When false the decode loop is fully paused. */
  visible: boolean;
}

const DECODE_INTERVAL_MS = 100; // ~10fps

// Viewfinder square size as a fraction of the shorter video dimension
const CROP_FRACTION = 0.65;

export default function QRScanner({ onScan, visible }: QRScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDecodeRef = useRef<number>(0);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const cancelRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const stopStream = useCallback(() => {
    cancelRaf();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (!mountedRef.current) return;

    // Pause loop when hidden — stream stays alive, just stop decoding
    if (!visibleRef.current) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const now = performance.now();
    if (now - lastDecodeRef.current < DECODE_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    lastDecodeRef.current = now;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // Crop to viewfinder square to reduce decode cost
    const side = Math.floor(Math.min(vw, vh) * CROP_FRACTION);
    const sx = Math.floor((vw - side) / 2);
    const sy = Math.floor((vh - side) / 2);
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side);
    const imageData = ctx.getImageData(0, 0, side, side);
    const code = jsQR(imageData.data, side, side, { inversionAttempts: 'dontInvert' });
    if (code?.data) {
      setShowHint(false);
      scheduleHint();
      onScanRef.current(code.data);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleHint() {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setShowHint(true);
    }, 5000);
  }

  const startStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities() as any;
        if (caps?.torch) setTorchSupported(true);
      }

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setReconnecting(false);
      setCameraError(null);
      cancelRaf();
      rafRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      if (!mountedRef.current) return;
      const name: string = err?.name ?? '';
      const msg: string = err?.message ?? '';
      setReconnecting(false);
      if (name === 'NotAllowedError' || msg.toLowerCase().includes('denied')) {
        setCameraError('Permissão de câmera negada. Toque na barra de endereço e libere o acesso à câmera.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('Nenhuma câmera encontrada neste dispositivo.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCameraError('A câmera está sendo usada por outro app. Feche-o e tente novamente.');
      } else {
        setCameraError(`Não foi possível acessar a câmera: ${name || msg || 'erro desconhecido'}`);
      }
    }
  }, [tick]);

  // Initial start
  useEffect(() => {
    mountedRef.current = true;
    startStream();
    scheduleHint();
    return () => {
      mountedRef.current = false;
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      stopStream();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Page visibility: stop on hide, restart on show
  useEffect(() => {
    const handleVisibility = () => {
      if (!mountedRef.current) return;
      if (document.visibilityState === 'hidden') {
        stopStream();
      } else {
        const tracks = streamRef.current?.getVideoTracks() ?? [];
        const alive = tracks.some((t) => t.readyState === 'live');
        if (!alive) {
          setReconnecting(true);
          startStream();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startStream, stopStream]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {}
  }, [torchOn]);

  if (cameraError) {
    return (
      <div
        className="w-full h-full bg-gray-900 flex flex-col items-center justify-center px-6 gap-4"
        style={{ display: visible ? undefined : 'none' }}
      >
        <div className="w-14 h-14 rounded-full bg-red-900/50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-red-300 text-center text-base leading-snug font-medium">{cameraError}</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full bg-black overflow-hidden"
      style={{ display: visible ? undefined : 'none' }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Viewfinder — pure CSS centering, no JS measurement */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-56 h-56 relative">
          <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
          <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
          <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
          <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
        </div>
      </div>

      {/* Torch button — bottom-center (avoids bottom-right watermark overlap) */}
      {torchSupported && (
        <div className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none">
          <button
            onClick={toggleTorch}
            className={`pointer-events-auto w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 ${
              torchOn
                ? 'bg-amber-400 text-gray-950'
                : 'bg-gray-900/80 text-gray-300 border border-gray-700'
            }`}
            aria-label={torchOn ? 'Desligar flash' : 'Ligar flash'}
          >
            {torchOn ? <Flashlight className="w-6 h-6" /> : <FlashlightOff className="w-6 h-6" />}
          </button>
        </div>
      )}

      {/* Reconnecting overlay */}
      {reconnecting && (
        <div className="absolute inset-x-0 top-2 flex justify-center pointer-events-none">
          <div className="bg-gray-900/90 border border-gray-700 rounded-xl px-4 py-2 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-300 text-xs font-medium">Reconectando câmera...</span>
          </div>
        </div>
      )}

      {/* "Try backing away" hint */}
      {showHint && !reconnecting && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none pb-20">
          <div className="bg-gray-900/85 border border-gray-700 rounded-xl px-4 py-2 max-w-xs mx-4">
            <p className="text-gray-300 text-xs text-center leading-snug">
              Não está lendo? Tente afastar um pouco o celular
              {torchSupported && !torchOn && ' ou ative o flash'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
