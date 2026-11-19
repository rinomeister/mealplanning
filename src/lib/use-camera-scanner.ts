"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatOneDReader, type IScannerControls } from "@zxing/browser";
import { useScannerEngine } from "@/lib/scanner-pref";

export type CameraStatus = "idle" | "starting" | "scanning" | "denied" | "unavailable";

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };

const WANTED_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "itf"];
const CAMERA_KEY = "scanner-camera";

let detectorPromise: Promise<Detector> | null = null;

/** The browser's BarcodeDetector, or the zxing-cpp WebAssembly ponyfill. */
function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    type Ctor = {
      new (opts: { formats: string[] }): Detector;
      getSupportedFormats(): Promise<readonly string[]>;
    };
    const native = (globalThis as { BarcodeDetector?: Ctor }).BarcodeDetector;
    if (native) {
      try {
        const supported = await native.getSupportedFormats();
        const formats = WANTED_FORMATS.filter((f) => supported.includes(f));
        if (formats.includes("ean_13")) return new native({ formats });
      } catch {
        // Fall through to the WebAssembly detector.
      }
    }
    const { BarcodeDetector } = await import("barcode-detector/ponyfill");
    return new BarcodeDetector({
      formats: WANTED_FORMATS as import("barcode-detector/ponyfill").BarcodeFormat[],
    }) as unknown as Detector;
  })();
  detectorPromise.catch(() => {
    detectorPromise = null;
  });
  return detectorPromise;
}

function readCameraPref(): string | null {
  try {
    return localStorage.getItem(CAMERA_KEY);
  } catch {
    return null;
  }
}

function writeCameraPref(id: string) {
  try {
    localStorage.setItem(CAMERA_KEY, id);
  } catch {
    // ignore
  }
}

const isDenied = (err: unknown) =>
  err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");

/**
 * Rear-camera barcode scanning, headless: attach `videoRef` to a <video>, call
 * `start()`, get each code once through `onDetected` (scanning stops on a hit;
 * call `start()` again to scan the next). Uses the engine picked in Me →
 * Barcode scanner. On a hit the last frame is kept in `frameRef`'s canvas so
 * the screen doesn't go black behind the confirm sheet.
 */
export function useCameraScanner(onDetected: (code: string) => void) {
  const engine = useScannerEngine();
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });

  const streamRef = useRef<MediaStream | null>(null);
  const zxingRef = useRef<IScannerControls | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every start/stop so a stale loop or late callback does nothing.
  const runRef = useRef(0);
  const detectedRef = useRef(onDetected);
  useEffect(() => {
    detectedRef.current = onDetected;
  });

  const release = useCallback(() => {
    runRef.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    zxingRef.current?.stop();
    zxingRef.current = null;
    const video = videoRef.current;
    const stream = streamRef.current ?? (video?.srcObject as MediaStream | null);
    stream?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (video) video.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    release();
    setStatus("idle");
  }, [release]);

  useEffect(() => release, [release]);

  /** Freeze the current frame into the canvas, then stop the camera. */
  const hit = useCallback(
    (code: string) => {
      const video = videoRef.current;
      const canvas = frameRef.current;
      if (video && canvas && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
      }
      release();
      setStatus("idle");
      navigator.vibrate?.(30);
      detectedRef.current(code);
    },
    [release],
  );

  const afterStream = useCallback((stream: MediaStream, run: number) => {
    streamRef.current = stream;
    const track = stream.getVideoTracks()[0];
    setDeviceId(track?.getSettings().deviceId ?? null);
    const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
    setTorch({ supported: !!caps.torch, on: false });
    // Continuous autofocus where supported — the main cause of blurry close-ups.
    track?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
    navigator.mediaDevices
      .enumerateDevices()
      .then((d) => {
        if (run === runRef.current) setCameras(d.filter((x) => x.kind === "videoinput"));
      })
      .catch(() => {});
  }, []);

  const start = useCallback(
    async (preferredId?: string | null) => {
      const video = videoRef.current;
      if (!video) return;
      release();
      const run = runRef.current;
      setStatus("starting");
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
      }

      if (engine === "zxing") {
        const reader = new BrowserMultiFormatOneDReader();
        try {
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: "environment" } },
            video,
            (decoded) => {
              if (decoded && run === runRef.current) hit(decoded.getText());
            },
          );
          if (run !== runRef.current) {
            controls.stop();
            return;
          }
          zxingRef.current = controls;
          const stream = video.srcObject as MediaStream | null;
          if (stream) afterStream(stream, run);
          setStatus("scanning");
        } catch (err) {
          if (run === runRef.current) setStatus(isDenied(err) ? "denied" : "unavailable");
        }
        return;
      }

      const wantId = preferredId === undefined ? readCameraPref() : preferredId;
      const base: MediaTrackConstraints = { width: { ideal: 1920 }, height: { ideal: 1080 } };
      let stream: MediaStream;
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: wantId ? { ...base, deviceId: { exact: wantId } } : { ...base, facingMode: { ideal: "environment" } },
          });
        } catch (err) {
          if (!wantId || isDenied(err)) throw err;
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { ...base, facingMode: { ideal: "environment" } },
          });
        }
      } catch (err) {
        if (run === runRef.current) setStatus(isDenied(err) ? "denied" : "unavailable");
        return;
      }
      if (run !== runRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      afterStream(stream, run);
      video.srcObject = stream;
      await video.play().catch(() => {});

      let detector: Detector;
      try {
        detector = await getDetector();
      } catch {
        if (run === runRef.current) {
          release();
          setStatus("unavailable");
        }
        return;
      }
      if (run !== runRef.current) return;
      setStatus("scanning");

      const tick = async () => {
        if (run !== runRef.current) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          try {
            const found = await detector.detect(video);
            if (run !== runRef.current) return;
            const code = found.find((b) => /^\d{6,14}$/.test(b.rawValue.trim()));
            if (code) {
              hit(code.rawValue.trim());
              return;
            }
          } catch {
            // An unreadable frame; keep going.
          }
        }
        timerRef.current = setTimeout(tick, 120);
      };
      void tick();
    },
    [engine, release, hit, afterStream],
  );

  const switchCamera = useCallback(() => {
    if (cameras.length < 2) return;
    const idx = cameras.findIndex((c) => c.deviceId === deviceId);
    const next = cameras[(idx + 1) % cameras.length];
    writeCameraPref(next.deviceId);
    void start(next.deviceId);
  }, [cameras, deviceId, start]);

  const toggleTorch = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torch.supported) return;
    const on = !torch.on;
    track
      .applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      .then(() => setTorch({ supported: true, on }))
      .catch(() => {});
  }, [torch]);

  return {
    videoRef,
    frameRef,
    status,
    start,
    stop,
    cameras,
    deviceId,
    switchCamera,
    torch,
    toggleTorch,
  };
}
