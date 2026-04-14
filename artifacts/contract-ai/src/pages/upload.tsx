import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Loader2, Upload, FileText, Image, X,
  CheckCircle, AlertCircle, Sparkles,
} from "lucide-react";
import { useUploadContract, useAnalyzeContract, useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatFileSize } from "@/lib/utils";
import AppLayout from "@/components/layout";

const MAX_SIZE = 10 * 1024 * 1024;

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/jpg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/tiff": "TIFF",
};

const ACCEPT_ATTR = Object.keys(ACCEPTED_TYPES).join(",");

type Stage = "idle" | "uploading" | "ready" | "analyzing" | "done";

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [uploadedContractId, setUploadedContractId] = useState<string | null>(null);

  const { data: user } = useGetMe();
  const logout = useLogout();
  const uploadContract = useUploadContract();
  const analyzeContract = useAnalyzeContract();

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/");
  }

  const isFreePlan = user?.plan === "free";

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES[file.type]) {
      return "Only PDF or image files (JPEG, PNG, WebP) are supported";
    }
    if (file.size > MAX_SIZE) {
      return `File must be under 10MB (current: ${formatFileSize(file.size)})`;
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
      return;
    }

    setFileError(null);
    setSelectedFile(file);
    setUploadedContractId(null);
    setStage("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const contract = await uploadContract.mutateAsync({
        data: formData as unknown as { file: Blob },
      });

      queryClient.invalidateQueries();

      if (contract.status === "failed") {
        setStage("idle");
        toast({
          title: "Text extraction failed",
          description: "Could not read text from this file. Ensure it is not password-protected or corrupted.",
          variant: "destructive",
        });
        return;
      }

      setUploadedContractId(contract.id);
      setStage("ready");
    } catch (err) {
      setStage("idle");
      const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
      console.error("[Upload] Error:", msg, err);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
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
    setFileError(null);
    setUploadedContractId(null);
    setStage("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAnalyze() {
    if (!uploadedContractId || stage !== "ready") return;

    const planLimits: Record<string, number> = { free: 3, pro: 50, premium: 999 };
    const limit = planLimits[user?.plan ?? "free"] ?? 3;
    const used = user?.contractsUsed ?? 0;
    if (used >= limit) {
      toast({
        title: "Plan limit reached",
        description: `Your ${user?.plan ?? "free"} plan allows ${limit} contracts. Please upgrade.`,
        variant: "destructive",
      });
      return;
    }

    setStage("analyzing");
    try {
      await analyzeContract.mutateAsync({ id: uploadedContractId });
      queryClient.invalidateQueries();

      setStage("done");
      toast({ title: "Analysis complete!", description: "Your contract has been analyzed." });
      setTimeout(() => setLocation(`/contracts/${uploadedContractId}`), 900);
    } catch (err) {
      setStage("ready");
      const msg = err instanceof Error ? err.message : "Analysis failed. Please try again.";
      console.error("[Analyze] Error:", msg, err);
      toast({ title: "Analysis failed", description: msg, variant: "destructive" });
    }
  }

  const isImage = selectedFile ? selectedFile.type.startsWith("image/") : false;
  const isBusy = stage === "uploading" || stage === "analyzing" || stage === "done";
  const analyzeEnabled = stage === "ready" && !!uploadedContractId;

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
              : selectedFile
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
          {selectedFile ? (
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
                <p className="font-medium text-sm">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {ACCEPTED_TYPES[selectedFile.type] ?? "File"} · {formatFileSize(selectedFile.size)}
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

        {stage === "uploading" && (
          <div className="mt-4 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3" data-testid="status-uploading">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium">Uploading and extracting text…</p>
              <p className="text-xs text-muted-foreground">Running OCR on your {isImage ? "image" : "PDF"}</p>
            </div>
          </div>
        )}

        {stage === "ready" && (
          <div className="mt-4 flex items-center gap-3 bg-green-500/8 border border-green-500/20 rounded-lg px-4 py-3" data-testid="status-ready">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-700">Upload complete — text extracted</p>
              <p className="text-xs text-muted-foreground">Click Analyze below to run the AI review</p>
            </div>
          </div>
        )}

        {stage === "analyzing" && (
          <div className="mt-4 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3" data-testid="status-analyzing">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium">Analyzing with AI…</p>
              <p className="text-xs text-muted-foreground">This typically takes 10–30 seconds</p>
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="mt-4 flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3" data-testid="status-done">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-700">Analysis complete!</p>
              <p className="text-xs text-muted-foreground">Redirecting to results…</p>
            </div>
          </div>
        )}

        {/* Analyze button — only active once file is uploaded and server confirms ready */}
        <Button
          size="lg"
          className={`w-full mt-6 gap-2 transition-opacity duration-300 ${analyzeEnabled ? "opacity-100" : "opacity-40"}`}
          disabled={!analyzeEnabled}
          onClick={handleAnalyze}
          data-testid="button-analyze"
        >
          {stage === "analyzing" || stage === "done" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {stage === "analyzing" ? "Analyzing…" : "Redirecting…"}
            </>
          ) : stage === "uploading" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {analyzeEnabled ? "Analyze contract" : "Select a file to get started"}
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
