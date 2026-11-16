"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatOneDReader,
  type IScannerControls,
} from "@zxing/browser";
import { Camera, Loader2, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useScannerEngine } from "@/lib/scanner-pref";

type CamStatus = "idle" | "starting" | "scanning" | "error";

/**
 * Rear-camera barcode scanner. Renders whichever engine the user picked in
 * Profile → Barcode scanner (per device), and hands the code to `onDetected`.
 */
export function BarcodeCamera(props: {
  onDetected: (code: string) => void;
  className?: string;
}) {
  const engine = useScannerEngine();
  return engine === "native" ? <NativeCamera {...props} /> : <ZxingCamera {...props} />;
}

/**
 * "Classic" engine: zxing-js. Stops itself on the first successful read.
 * The <video> stays mounted (hidden when idle) so its ref is available the
 * instant scanning starts — otherwise the stream attaches to a detached element
 * and never displays (the black-screen bug on mobile PWAs).
 */
function ZxingCamera({
  onDetected,
  className,
}: {
  onDetected: (code: string) => void;
  className?: string;
}) {
  const [status, setStatus] = useState<CamStatus>("idle");
  const [message, setMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  // Guards against the continuous scanner firing multiple times before we stop.
  const handlingRef = useRef(false);

  const releaseCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    releaseCamera();
    setStatus("idle");
  }, [releaseCamera]);

  // Release the camera when this component unmounts (navigating away, closing).
  useEffect(() => releaseCamera, [releaseCamera]);

  const start = useCallback(async () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    setStatus("starting");
    setMessage("");
    handlingRef.current = false;
    const reader = new BrowserMultiFormatOneDReader();
    try {
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoEl,
        (decoded) => {
          if (!decoded || handlingRef.current) return;
          handlingRef.current = true;
          releaseCamera();
          setStatus("idle");
          onDetected(decoded.getText());
        },
      );
      controlsRef.current = controls;
      setStatus("scanning");
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "SecurityError");
      setStatus("error");
      setMessage(
        denied
          ? "Camera permission was denied. Enter the barcode manually below."
          : "Couldn't access a camera. Enter the barcode manually below.",
      );
    }
  }, [onDetected, releaseCamera]);

  const cameraLive = status === "starting" || status === "scanning";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-black",
          !cameraLive && "hidden",
        )}
      >
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-24 w-4/5 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute right-2 top-2"
          onClick={stop}
        >
          <X className="size-4" />
          Stop
        </Button>
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Starting camera…
          </div>
        )}
      </div>

      {status === "scanning" && (
        <p className="text-center text-sm text-muted-foreground">
          Point the rear camera at a product barcode.
        </p>
      )}

      {status === "error" && message && (
        <p className="text-sm text-destructive">{message}</p>
      )}

      {!cameraLive && (
        <Button type="button" onClick={start}>
          <Camera className="size-4" />
          Start camera
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Enhanced" engine: the browser's BarcodeDetector (Google ML Kit on Android
// Chrome), fed from a high-resolution, continuously focusing rear camera. Falls
// back to the zxing-cpp WebAssembly ponyfill where no native detector exists.
// ---------------------------------------------------------------------------

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };

const WANTED_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "itf"];
const CAMERA_KEY = "scanner-camera";

let detectorPromise: Promise<Detector> | null = null;

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
  // Don't cache a failure: let the next attempt retry the import.
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

function NativeCamera({
  onDetected,
  className,
}: {
  onDetected: (code: string) => void;
  className?: string;
}) {
  const [status, setStatus] = useState<CamStatus>("idle");
  const [message, setMessage] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every start/stop so a stale detection loop exits on its own.
  const runRef = useRef(0);

  const releaseCamera = useCallback(() => {
    runRef.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    releaseCamera();
    setStatus("idle");
  }, [releaseCamera]);

  useEffect(() => releaseCamera, [releaseCamera]);

  const start = useCallback(
    async (preferredId?: string | null) => {
      const videoEl = videoRef.current;
      if (!videoEl) return;
      releaseCamera();
      const run = runRef.current;
      setStatus("starting");
      setMessage("");

      const wantId = preferredId === undefined ? readCameraPref() : preferredId;
      const base: MediaTrackConstraints = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      };
      let stream: MediaStream;
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: wantId
              ? { ...base, deviceId: { exact: wantId } }
              : { ...base, facingMode: { ideal: "environment" } },
          });
        } catch (err) {
          // A remembered camera may have disappeared; retry with any rear one.
          if (!wantId || (err instanceof DOMException && err.name === "NotAllowedError")) {
            throw err;
          }
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { ...base, facingMode: { ideal: "environment" } },
          });
        }
      } catch (err) {
        if (run !== runRef.current) return;
        const denied =
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError");
        setStatus("error");
        setMessage(
          denied
            ? "Camera permission was denied. Enter the barcode manually below."
            : "Couldn't access a camera. Enter the barcode manually below.",
        );
        return;
      }
      if (run !== runRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      const activeId = track?.getSettings().deviceId ?? null;
      setDeviceId(activeId);
      // Continuous autofocus where the camera supports it — the main reason
      // close-up barcodes stay blurry on many Android phones.
      try {
        await track?.applyConstraints({
          advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
        });
      } catch {
        // Not supported; fine.
      }

      videoEl.srcObject = stream;
      try {
        await videoEl.play();
      } catch {
        // autoPlay + muted usually covers this.
      }

      // Labels (and the full list) are only available after permission.
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (run === runRef.current) {
            setCameras(devices.filter((d) => d.kind === "videoinput"));
          }
        })
        .catch(() => {});

      let detector: Detector;
      try {
        detector = await getDetector();
      } catch {
        if (run !== runRef.current) return;
        releaseCamera();
        setStatus("error");
        setMessage("The scanner failed to load. Check your connection, or enter the barcode below.");
        return;
      }
      if (run !== runRef.current) return;
      setStatus("scanning");

      const tick = async () => {
        if (run !== runRef.current) return;
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
          try {
            const found = await detector.detect(videoEl);
            if (run !== runRef.current) return;
            const hit = found.find((b) => /^\d{6,14}$/.test(b.rawValue.trim()));
            if (hit) {
              releaseCamera();
              setStatus("idle");
              onDetected(hit.rawValue.trim());
              return;
            }
          } catch {
            // A frame that can't be read; keep going.
          }
        }
        timerRef.current = setTimeout(tick, 120);
      };
      void tick();
    },
    [onDetected, releaseCamera],
  );

  function switchCamera() {
    if (cameras.length < 2) return;
    const idx = cameras.findIndex((c) => c.deviceId === deviceId);
    const next = cameras[(idx + 1) % cameras.length];
    writeCameraPref(next.deviceId);
    void start(next.deviceId);
  }

  const cameraLive = status === "starting" || status === "scanning";
  const currentLabel = cameras.find((c) => c.deviceId === deviceId)?.label;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-black",
          !cameraLive && "hidden",
        )}
      >
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-24 w-4/5 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        <div className="absolute right-2 top-2 flex gap-2">
          {cameras.length > 1 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={switchCamera}
              aria-label="Switch camera"
            >
              <SwitchCamera className="size-4" />
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={stop}>
            <X className="size-4" />
            Stop
          </Button>
        </div>
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Starting camera…
          </div>
        )}
      </div>

      {status === "scanning" && (
        <p className="text-center text-sm text-muted-foreground">
          Hold the barcode 10–20 cm from the camera.
          {cameras.length > 1 && (
            <>
              <br />
              <span className="text-xs">
                Blurry? Tap <SwitchCamera className="inline size-3" /> to try another lens
                {currentLabel ? ` (now: ${currentLabel})` : ""}.
              </span>
            </>
          )}
        </p>
      )}

      {status === "error" && message && (
        <p className="text-sm text-destructive">{message}</p>
      )}

      {!cameraLive && (
        <Button type="button" onClick={() => void start()}>
          <Camera className="size-4" />
          Start camera
        </Button>
      )}
    </div>
  );
}
