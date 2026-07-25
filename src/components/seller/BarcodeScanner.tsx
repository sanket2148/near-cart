// Real camera barcode scanning for product onboarding (see
// plan/tasks/decisions.md, 2026-07-25). Uses @zxing/browser rather than the
// native BarcodeDetector API — BarcodeDetector has no Safari/iOS support at
// all, which would silently break this for a large share of real phones;
// ZXing decodes frames itself from a <video> element, so it works the same
// everywhere a camera does. Same "never a hard wall" principle as the real
// GPS pin flow (CreateShopStep.tsx): camera denial/unsupported just falls
// back to typing the barcode in by hand.
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

type ScanStatus = "starting" | "scanning" | "denied";

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [status, setStatus] = useState<ScanStatus>("starting");
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (result && !cancelled) {
          onDetectedRef.current(result.getText());
        }
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("scanning");
      })
      .catch(() => {
        if (!cancelled) setStatus("denied");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Scan a barcode</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {status !== "denied" ? (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">
            Point the camera at the barcode
          </p>
        </div>
      ) : (
        <p className="text-xs text-destructive">
          Couldn't access the camera — check permissions, or type the barcode below.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Or type the barcode"
          className="flex-1"
        />
        <Button
          variant="outline"
          disabled={!manualCode.trim()}
          onClick={() => onDetectedRef.current(manualCode.trim())}
        >
          Use
        </Button>
      </div>
    </div>
  );
}
