import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BUSINESS_TYPE_CONFIG,
  DOC_TYPE_LABELS,
  fileToBase64,
  type DocumentType,
  type DocumentUpload,
  type ShopVerification,
} from "@/lib/verification";
import { submitVerificationFile } from "@/lib/verification/api.functions";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,application/pdf";

type Props = {
  verification: ShopVerification;
  onUpload: (doc: DocumentUpload) => void;
  onComplete: () => void;
};

export function StepDocumentUpload({ verification, onUpload, onComplete }: Props) {
  const bType = verification.businessType;
  if (!bType) return null;

  const config = BUSINESS_TYPE_CONFIG[bType];
  const allDocs = [...config.requiredDocs, ...config.optionalDocs];
  const uploaded = verification.levels.l2_documents.documents;

  const allRequiredUploaded = config.requiredDocs.every((d) =>
    uploaded.some((u) => u.docType === d && u.status !== "rejected"),
  );

  const form = {
    ownerName: verification.levels.l3_kyc.panName || undefined,
    businessType: bType,
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold">Upload documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Based on your {config.label.toLowerCase()} business, we need the following documents.
        </p>
      </div>

      <div className="space-y-3">
        {allDocs.map((docType) => {
          const isRequired = config.requiredDocs.includes(docType);
          const existing = uploaded.find((u) => u.docType === docType);
          return (
            <DocUploadCard
              key={docType}
              docType={docType}
              isRequired={isRequired}
              existing={existing}
              merchantRef={verification.merchantRef}
              shopId={verification.shopId}
              form={form}
              onUpload={onUpload}
            />
          );
        })}
      </div>

      {config.requiredDocs.length === 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-2 text-sm font-bold">No mandatory documents required!</p>
          <p className="text-xs text-muted-foreground">
            You can upload optional documents to increase your trust score.
          </p>
        </div>
      )}

      <Button
        variant="hero"
        size="xl"
        className="w-full"
        disabled={config.requiredDocs.length > 0 && !allRequiredUploaded}
        onClick={onComplete}
      >
        Continue <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

function DocUploadCard({
  docType,
  isRequired,
  existing,
  merchantRef,
  shopId,
  form,
  onUpload,
}: {
  docType: DocumentType;
  isRequired: boolean;
  existing?: DocumentUpload;
  merchantRef: string;
  shopId: string;
  form: { businessName?: string; ownerName?: string; address?: string; businessType?: string };
  onUpload: (doc: DocumentUpload) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const label = DOC_TYPE_LABELS[docType] ?? docType;

  const isDone = existing && (existing.status === "submitted" || existing.status === "verified");
  const isRejected = existing && existing.status === "rejected";

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      toast.error("File exceeds the 10 MB limit");
      return;
    }

    setUploading(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const analysis = await submitVerificationFile({
        data: {
          merchantRef,
          shopId,
          category: "document",
          docType,
          fileName: file.name,
          mimeType: file.type,
          dataBase64,
          form,
        },
      });

      const status: DocumentUpload["status"] =
        analysis.decision === "VERIFIED"
          ? "verified"
          : analysis.decision === "REJECTED"
            ? "rejected"
            : "submitted";

      onUpload({
        id: analysis.docId,
        docType,
        fileName: analysis.fileName,
        status,
        uploadedAt: analysis.createdAt,
        rejectionReason: status === "rejected" ? analysis.issues[0] : undefined,
        filePath: analysis.filePath,
        analysis,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleUpload() {
    inputRef.current?.click();
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-all",
        isDone
          ? "border-emerald-200 bg-emerald-50/50"
          : isRejected
            ? "border-destructive/30 bg-destructive/5"
            : "border-border bg-card shadow-card",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileSelected}
      />
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            isDone
              ? "bg-emerald-100 text-emerald-600"
              : isRejected
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
          )}
        >
          {isDone ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : isRejected ? (
            <XCircle className="h-5 w-5" />
          ) : (
            <FileText className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-sm font-bold">
            {label}
            {isRequired ? (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                Required
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                Optional
              </span>
            )}
          </h4>
          {isDone && existing && (
            <p className="text-xs text-muted-foreground">
              {existing.fileName} · {existing.status === "verified" ? "Verified" : "Under review"}
            </p>
          )}
          {isRejected && existing?.rejectionReason && (
            <p className="text-xs text-destructive">{existing.rejectionReason}</p>
          )}
        </div>
        {!isDone && (
          <Button
            variant={isRejected ? "destructive" : "outline"}
            size="sm"
            disabled={uploading}
            onClick={handleUpload}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="mr-1 h-3.5 w-3.5" />
                {isRejected ? "Re-upload" : "Upload"}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
