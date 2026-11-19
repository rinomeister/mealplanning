"use client";

import { Camera, Loader2, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCameraScanner } from "@/lib/use-camera-scanner";

/**
 * Inline rear-camera scanner (used inside the meal builder and Products
 * dialogs). The full-screen logging scanner is ScannerScreen; both share
 * useCameraScanner.
 */
export function BarcodeCamera({
  onDetected,
  className,
}: {
  onDetected: (code: string) => void;
  className?: string;
}) {
  const { videoRef, frameRef, status, start, stop, cameras, deviceId, switchCamera } = useCameraScanner(onDetected);
  const live = status === "starting" || status === "scanning";
  const currentLabel = cameras.find((c) => c.deviceId === deviceId)?.label;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className={cn("relative overflow-hidden rounded-[14px] bg-black", !live && "hidden")}>
        <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted autoPlay />
        <canvas ref={frameRef} className="hidden" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-24 w-4/5 rounded-[14px] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        <div className="absolute right-2 top-2 flex gap-2">
          {cameras.length > 1 && (
            <Button type="button" variant="secondary" size="sm" onClick={switchCamera} aria-label="Switch camera">
              <SwitchCamera className="size-4" />
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={stop}>
            <X className="size-4" /> Stop
          </Button>
        </div>
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
            <Loader2 className="mr-2 size-4 animate-spin" /> Starting camera…
          </div>
        )}
      </div>

      {status === "scanning" && (
        <p className="text-center text-sm text-ink-3">
          Hold the barcode 10–20 cm from the camera.
          {cameras.length > 1 && currentLabel && (
            <>
              <br />
              <span className="text-xs">Blurry? Switch lens (now: {currentLabel}).</span>
            </>
          )}
        </p>
      )}
      {(status === "denied" || status === "unavailable") && (
        <p className="text-sm text-bad">
          {status === "denied"
            ? "Camera permission was denied. Enter the barcode manually below."
            : "Couldn't access a camera. Enter the barcode manually below."}
        </p>
      )}
      {!live && (
        <Button type="button" onClick={() => void start()}>
          <Camera className="size-4" /> Start camera
        </Button>
      )}
    </div>
  );
}
