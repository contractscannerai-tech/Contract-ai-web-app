import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Loader2, Upload, FileText, Image, X,
  CheckCircle, AlertCircle, Sparkles, ShieldCheck,
} from "lucide-react";
import { useAnalyzeContract, useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatFileSize } from "@/lib/utils";
import AppLayout from "@/components/layout";
import type { Contract } from "@workspace/api-client-react";

const MAX_SIZE = 10 * 1024 * 1024;
const COMPRESS_THRESHOLD = 2 * 1024 * 1024;
const API_BASE = "/api/contracts/upload";

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/jpg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/tiff": "TIFF",
};

const ACCEPT_ATTR = Object.keys(ACCEPTED_TYPES).join(",");

type Stage = "idle" | "compressing" | "uploading" | "ready" | "analyzing" | "done";

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= COMPRESS_THRESHOLD) return file;

  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const MAX_DIM = 3000;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          const ext = file.name.replace(/\.[^.]+$/, "");
          resolve(new File([blob], `${ext}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.82,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<Contract> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as Contract);
        } catch {
          reject(new Error("Server returned an unexpected response format."));
        }
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string };
          if (body.message) msg = body.message;
        } catch { /* use default msg */ }
        reject(new Error(msg));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error — check your connection and try again.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload was cancelled.")));

    xhr.open("POST", API_BASE);
    xhr.send(formData);
  });
}

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayFile, setDisplayFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedContractId, setUploadedContractId] = useState<string | null>(null);
  const [analysisFailed, setAnalysisFailed] = useState(false);

  const { data: user } = useGetMe();
  const logout = useLogout();
  const analyzeContract = useAnalyzeContract();

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/", { replace: true });
  }

  const isFreePlan = user?.plan === "free";

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES[file.type]) {
      return "Only PDF or image files (JPEG, PNG, WebP) are supported.";
    }
    if (file.size > MAX_SIZE) {
      return `File must be under 10MB (current: ${formatFileSize(file.size)}).`;
    }
    if (file.type.startsWith("image/") && isFreePlan) {
      return "Photo scanning requires a Pro or Premium plan. Please upgrade or upload a PDF instead.";
    }
    return null;
  }

  async function startUpload(file: File) {
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
      setDisplayFile(null);
      return;
    }

    setFileError(null);
    setDisplayFile(file);
    setUploadedContractId(null);
    setAnalysisFailed(false);
    setUploadProgress(0);

    let fileToUpload = file;

    if (file.type.startsWith("image/") && file.size > COMPRESS_THRESHOLD) {
      setStage("compressing");
      try {
        fileToUpload = await compressImage(file);
        if (fileToUpload !== file) {
          console.info(`[Upload] Compressed ${formatFileSize(file.size)} → ${formatFileSize(fileToUpload.size)}`);
        }
      } catch {
        fileToUpload = file;
      }
    }

    setSelectedFile(fileToUpload);
    setStage("uploading");

    try {
      const contract = await uploadWithProgress(fileToUpload, setUploadProgress);
      setUploadProgress(100);
      queryClient.invalidateQueries();

      if (contract.status === "failed") {
        setStage("idle");
        toast({
          title: "Text extraction failed",
          description: "Could not read text from this file. Ensure it is not password-protected or corrupted. You have not been charged for this attempt.",
          variant: "destructive",
        });
        return;
      }

      setUploadedContractId(contract.id);
      setStage("ready");
    } catch (err) {
      setStage("idle");
      const msg = err instanceof Error ? err.message : "Upload failed — please try again.";
      console.error("[Upload] Error:", msg, err);
      toast({
        title: "Upload failed",
        description: `${msg} You have not been charged for this attempt.`,
        variant: "destructive",
      });
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void startUpload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void startUpload(file);
  }

  function clearFile() {
    setSelectedFile(null);
    setDisplayFile(null);
    setFileError(null);
    setUploadedContractId(null);
    setUploadProgress(0);
    setAnalysisFailed(false);
    setStage("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAnalyze() {
    if (!uploadedContractId || stage !== "ready") return;

    setAnalysisFailed(false);
    setStage("analyzing");
    try {
      await analyzeContract.mutateAsync({ id: uploadedContractId });
      queryClient.invalidateQueries();

      setStage("done");
      toast({ title: "Analysis complete!", description: "Your contract report is ready." });
      setTimeout(() => setLocation(`/contracts/${uploadedContractId}`), 900);
    } catch (err) {
      setStage("ready");
      setAnalysisFailed(true);
      const msg = err instanceof Error ? err.message : "Analysis failed — please try again.";
      console.error("[Analyze] Error:", msg, err);
      toast({
        title: "Analysis failed",
        description: msg,
        variant: "destructive",
      });
    }
  }

  const isImage = (displayFile ?? selectedFile)?.type.startsWith("image/") ?? false;
  const isBusy = stage === "compressing" || stage === "uploading" || stage === "analyzing" || stage === "done";
  const analyzeEnabled = stage === "ready" && !!uploadedContractId;
  const shownFile = displayFile ?? selectedFile;

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Upload Contract</h1>
          <p className="text-muted-foreground text-sm">
            Drop a PDF or photo — we'll extract the text automatically, then analyze it with AI when you're ready.
          </p>
        </div>

        {user && user.plan === "free" && (
          <div className="mb-6 flex items-start gap-3 bg-yellow-500/8 border border-yellow-500/20 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-700">
                Free plan: {user.contractsUsed}/{user.contractsLimit} contracts used
              </p>
              <button
                onClick={() => setLocation("/pricing")}
                className="text-xs text-yellow-700 underline underline-offset-2 mt-0.5"
              >
                Upgrade for more
              </button>
            </div>
          </div>
        )}

        {/* Dropzone */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
            dragOver
              ? "border-primary bg-primary/5"
              : shownFile
              ? stage === "ready"
                ? "border-green-500/60 bg-green-500/4"
                : "border-primary/50 bg-primary/3"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          } ${isBusy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
          onDragOver={(e) => { e.preventDefault(); if (!isBusy) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isBusy && fileInputRef.current?.click()}
          data-testid="dropzone"
        >
          {shownFile ? (
            <div className="flex flex-col items-center gap-3">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                stage === "ready" ? "bg-green-500/15" : "bg-primary/10"
              }`}>
                {stage === "ready"
                  ? <CheckCircle className="w-7 h-7 text-green-600" />
                  : isImage
                  ? <Image className="w-7 h-7 text-primary" />
                  : <FileText className="w-7 h-7 text-primary" />}
              </div>
              <div>
                <p className="font-medium text-sm">{shownFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {ACCEPTED_TYPES[shownFile.type] ?? "File"} · {formatFileSize(shownFile.size)}
                  {stage === "ready" && (
                    <span className="text-green-600 font-medium"> · Ready to analyze</span>
                  )}
                </p>
              </div>
              {!isBusy && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearFile(); }}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                  data-testid="button-clear-file"
                >
                  <X className="w-3 h-3" /> Remove file
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center">
                <Upload className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Drop your contract here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse files</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {isFreePlan
                  ? "PDF only on Free plan · Max 10MB"
                  : "PDF or image (JPEG, PNG, WebP) · Max 10MB"}
              </p>
              {isFreePlan && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLocation("/pricing"); }}
                  className="text-xs text-primary underline underline-offset-2"
                >
                  Upgrade to scan photos
                </button>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={handleInputChange}
          data-testid="input-file"
        />

        {fileError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-destructive" data-testid="text-file-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {fileError}
          </div>
        )}

        {/* Status panels */}
        {stage === "compressing" && (
          <div className="mt-4 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Compressing image…</p>
              <p className="text-xs text-muted-foreground">Optimising for faster upload</p>
            </div>
          </div>
        )}

        {stage === "uploading" && (
          <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3" data-testid="status-uploading">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {isImage ? "Running OCR scan…" : "Extracting digital text…"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isImage
                    ? `Sending image to OCR engine · ${uploadProgress}%`
                    : `Parsing PDF directly — no OCR needed · ${uploadProgress}%`}
                </p>
              </div>
            </div>
            <div className="w-full bg-primary/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {stage === "ready" && (
          <div className="mt-4 flex items-center gap-3 bg-green-500/8 border border-green-500/20 rounded-lg px-4 py-3" data-testid="status-ready">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-700">
                {isImage ? "OCR scan complete" : "Digital text extracted"} — ready for AI analysis
              </p>
              <p className="text-xs text-muted-foreground">Click Analyze below to run the AI review</p>
            </div>
          </div>
        )}

        {stage === "analyzing" && (
          <div className="mt-4 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3" data-testid="status-analyzing">
            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Analyzing with AI…</p>
              <p className="text-xs text-muted-foreground">This typically takes 10–30 seconds</p>
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="mt-4 flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3" data-testid="status-done">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-700">Analysis complete!</p>
              <p className="text-xs text-muted-foreground">Redirecting to your report…</p>
            </div>
          </div>
        )}

        {analysisFailed && stage === "ready" && (
          <div className="mt-4 flex items-start gap-3 bg-muted/60 border border-border rounded-lg px-4 py-3">
            <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Analysis failed. <strong className="text-foreground">You have not been charged for this attempt.</strong> Your file is still uploaded — you can try analyzing again below.
            </p>
          </div>
        )}

        {/* Analyze button — locked until server confirms upload + OCR ready */}
        <Button
          size="lg"
          className={`w-full mt-6 gap-2 transition-all duration-300 ${analyzeEnabled ? "opacity-100" : "opacity-40"}`}
          disabled={!analyzeEnabled}
          onClick={handleAnalyze}
          data-testid="button-analyze"
        >
          {stage === "analyzing" || stage === "done" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {stage === "analyzing" ? "Analyzing…" : "Redirecting…"}
            </>
          ) : stage === "compressing" || stage === "uploading" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {analyzeEnabled
                ? analysisFailed
                  ? "Retry analysis"
                  : "Analyze contract"
                : "Select a file to get started"}
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Your contract is processed securely and never shared with third parties.
        </p>
      </div>
    </AppLayout>
  );
}
