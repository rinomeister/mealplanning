"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatOneDReader,
  type IScannerControls,
} from "@zxing/browser";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CamStatus = "idle" | "starting" | "scanning" | "error";

/**
 * Reusable rear-camera barcode scanner. Handles getUserMedia + zxing decoding,
 * stops itself on the first successful read, and hands the code to `onDetected`.
 * The <video> stays mounted (hidden when idle) so its ref is available the
 * instant scanning starts — otherwise the stream attaches to a detached element
 * and never displays (the black-screen bug on mobile PWAs).
 */
export function BarcodeCamera({
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
