import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, MapPin, CheckCircle2, ArrowRight, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fileToBase64, type ShopPhoto, type ShopVerification } from "@/lib/verification";
import { submitVerificationFile } from "@/lib/verification/api.functions";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

type Props = {
  verification: ShopVerification;
  onUpdateGps: (lat: number, lng: number) => void;
  onAddPhoto: (photo: ShopPhoto) => void;
  onComplete: () => void;
};

const PHOTO_TYPES: { type: ShopPhoto["type"]; label: string; desc: string; emoji: string }[] = [
  { type: "front", label: "Front entrance", desc: "Clear photo of your shop's front", emoji: "🏪" },
  { type: "board", label: "Shop board / sign", desc: "Name board or signage", emoji: "🪧" },
  { type: "interior", label: "Interior", desc: "Inside view of your shop", emoji: "📷" },
  { type: "selfie", label: "Owner selfie", desc: "Photo of you at the shop", emoji: "🤳" },
];

export function StepShopPhotos({ verification, onUpdateGps, onAddPhoto, onComplete }: Props) {
  const l5 = verification.levels.l5_gps;
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingType = useRef<ShopPhoto["type"] | null>(null);

  const gpsSet = l5.lat !== null && l5.lng !== null;
  const photos = l5.photos;
  const frontUploaded = photos.some((p) => p.type === "front");
  const boardUploaded = photos.some((p) => p.type === "board");
  const canProceed = gpsSet && frontUploaded && boardUploaded;

  async function captureLocation() {
    setLocating(true);
    // Simulate GPS capture (in real app, use Geolocation API)
    await new Promise((r) => setTimeout(r, 1500));
    // Mock coords near Koramangala, Bengaluru
    const lat = 12.9352 + (Math.random() - 0.5) * 0.01;
    const lng = 77.6245 + (Math.random() - 0.5) * 0.01;
    onUpdateGps(lat, lng);
    setLocating(false);
  }

  function handlePhoto(type: ShopPhoto["type"]) {
    pendingType.current = type;
    inputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const type = pendingType.current;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!type || !file) return;

    if (file.size > MAX_FILE_BYTES) {
      toast.error("File exceeds the 10 MB limit");
      return;
    }

    setUploading(type);
    try {
      const dataBase64 = await fileToBase64(file);
      const analysis = await submitVerificationFile({
        data: {
          merchantRef: verification.merchantRef,
          shopId: verification.shopId,
          category: "photo",
          docType: type,
          fileName: file.name,
          mimeType: file.type,
          dataBase64,
          form: { businessType: verification.businessType || undefined },
        },
      });

      if (analysis.decision === "REJECTED") {
        toast.error(analysis.issues[0] ?? `${type} photo was rejected — please retake it.`);
        return;
      }

      onAddPhoto({
        id: analysis.docId,
        type,
        fileName: analysis.fileName,
        uploadedAt: analysis.createdAt,
        filePath: analysis.filePath,
        analysis,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-5">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileSelected}
      />
      <div>
        <h2 className="text-lg font-extrabold">Shop photos & location</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Prove your shop physically exists with GPS and photos.
        </p>
      </div>

      {/* GPS Capture */}
      <section
        className={cn(
          "rounded-2xl border p-4 shadow-card transition-all",
          gpsSet ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-card",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              gpsSet ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary",
            )}
          >
            {gpsSet ? <CheckCircle2 className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold">GPS Location</h3>
            <p className="text-xs text-muted-foreground">
              {gpsSet
                ? `Captured: ${l5.lat!.toFixed(4)}, ${l5.lng!.toFixed(4)}`
                : "Capture your shop's live location"}
            </p>
          </div>
          {!gpsSet && (
            <Button variant="hero" size="sm" disabled={locating} onClick={captureLocation}>
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <MapPin className="mr-1 h-3.5 w-3.5" /> Capture
                </>
              )}
            </Button>
          )}
        </div>

        {gpsSet && (
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <div className="flex h-32 items-center justify-center bg-gradient-hero text-muted-foreground">
              <div className="text-center">
                <MapPin className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-1 text-xs font-medium">
                  {l5.lat!.toFixed(6)}, {l5.lng!.toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Shop Photos */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-bold">
          <Camera className="h-4 w-4 text-primary" /> Shop photos
        </h3>
        <p className="text-xs text-muted-foreground">
          Front entrance and shop board are required. Interior and selfie are optional but
          recommended.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {PHOTO_TYPES.map((pt) => {
            const existing = photos.find((p) => p.type === pt.type);
            const isUploading = uploading === pt.type;
            const isRequired = pt.type === "front" || pt.type === "board";

            return (
              <button
                type="button"
                key={pt.type}
                disabled={isUploading || !!existing}
                onClick={() => handlePhoto(pt.type)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center transition-all",
                  existing
                    ? "border-emerald-300 bg-emerald-50/50"
                    : isUploading
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card hover:border-primary/40 hover:bg-primary/5",
                )}
              >
                {isRequired && !existing && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                    Required
                  </span>
                )}
                {existing ? (
                  <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-6 w-6" />
                    </span>
                    <span className="text-xs font-bold text-emerald-700">{pt.label}</span>
                    <span className="text-[10px] text-emerald-600">Uploaded ✓</span>
                  </>
                ) : isUploading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs font-medium text-primary">Uploading…</span>
                  </>
                ) : (
                  <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl">
                      {pt.emoji}
                    </span>
                    <span className="text-xs font-bold">{pt.label}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ImagePlus className="h-3 w-3" /> Tap to upload
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <Button
        variant="hero"
        size="xl"
        className="w-full"
        disabled={!canProceed}
        onClick={onComplete}
      >
        Continue <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
      {!canProceed && (
        <p className="text-center text-xs text-muted-foreground">
          Capture GPS and upload front entrance + shop board photos to continue
        </p>
      )}
    </div>
  );
}
