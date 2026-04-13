import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, FileText, X, CheckCircle, AlertCircle } from "lucide-react";
import { useUploadContract, useAnalyzeContract, useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatFileSize } from "@/lib/utils";
import AppLayout from "@/components/layout";

const MAX_SIZE = 10 * 1024 * 1024;

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "analyzing" | "done">("idle");

  const { data: user } = useGetMe();
  const logout = useLogout();
  const uploadContract = useUploadContract();
  const analyzeContract = useAnalyzeContract();

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/");
  }

  function validateFile(file: File): string | null {
    if (file.type !== "application/pdf") return "Only PDF files are allowed";
    if (file.size > MAX_SIZE) return `File must be under 10MB (current: ${formatFileSize(file.size)})`;
    return null;
  }

  function handleFileSelect(file: File) {
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
      return;
    }
    setFileError(null);
    setSelectedFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  function clearFile() {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAnalyze() {
    if (!selectedFile) return;

    setStage("uploading");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const contract = await uploadContract.mutateAsync({ data: formData as unknown as { file: Blob } });
      queryClient.invalidateQueries();

      setStage("analyzing");
      const analysis = await analyzeContract.mutateAsync({ id: contract.id });
      queryClient.invalidateQueries();

      setStage("done");
      toast({ title: "Analysis complete!", description: "Your contract has been analyzed." });
      setTimeout(() => setLocation(`/contracts/${contract.id}`), 1000);
    } catch (err) {
      setStage("idle");
      const errorMsg = err instanceof Error ? err.message : "Upload or analysis failed";
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    }
  }

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Upload Contract</h1>
          <p className="text-muted-foreground text-sm">Upload a PDF and we'll analyze it instantly with AI</p>
        </div>

        {/* Dropzone */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
            dragOver ? "border-primary bg-primary/5" : selectedFile ? "border-primary/50 bg-primary/3" : "border-border hover:border-primary/50 hover:bg-muted/30"
          } ${stage !== "idle" ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => stage === "idle" && fileInputRef.current?.click()}
          data-testid="dropzone"
        >
          {selectedFile ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
                <FileText className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatFileSize(selectedFile.size)}</p>
              </div>
              {stage === "idle" && (
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
                <p className="font-medium text-sm">Drop your PDF here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse files</p>
              </div>
              <p className="text-xs text-muted-foreground">PDF only · Max 10MB</p>
            </div>
          )}
        </div>

        {/* Hidden file input — anchored with useRef so it persists on mobile */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleInputChange}
          data-testid="input-file"
        />

        {/* File error */}
        {fileError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-destructive" data-testid="text-file-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {fileError}
          </div>
        )}

        {/* Status messages */}
        {stage === "uploading" && (
          <div className="mt-4 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3" data-testid="status-uploading">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium">Uploading contract...</p>
              <p className="text-xs text-muted-foreground">Extracting text from your PDF</p>
            </div>
          </div>
        )}
        {stage === "analyzing" && (
          <div className="mt-4 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3" data-testid="status-analyzing">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium">Analyzing with AI...</p>
              <p className="text-xs text-muted-foreground">This may take 10-30 seconds</p>
            </div>
          </div>
        )}
        {stage === "done" && (
          <div className="mt-4 flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3" data-testid="status-done">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-700">Analysis complete!</p>
              <p className="text-xs text-muted-foreground">Redirecting to results...</p>
            </div>
          </div>
        )}

        {/* Analyze button */}
        <Button
          size="lg"
          className="w-full mt-6 gap-2"
          disabled={!selectedFile || stage !== "idle"}
          onClick={handleAnalyze}
          data-testid="button-analyze"
        >
          {stage !== "idle" ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {stage === "uploading" ? "Uploading..." : stage === "analyzing" ? "Analyzing..." : "Redirecting..."}</>
          ) : (
            <><FileText className="w-4 h-4" /> Analyze contract</>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Your contract is processed securely and never shared.
        </p>
      </div>
    </AppLayout>
  );
}
