import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  FileText, Upload, Search, Trash2, ChevronRight, Clock, CheckCircle, AlertCircle, Loader2
} from "lucide-react";
import {
  useListContracts, useDeleteContract, useGetMe, useLogout,
  getListContractsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate, formatFileSize } from "@/lib/utils";
import AppLayout from "@/components/layout";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  uploaded: { label: "Uploaded", icon: <Clock className="w-3 h-3" />, className: "bg-muted text-muted-foreground" },
  extracting: { label: "Processing", icon: <Loader2 className="w-3 h-3 animate-spin" />, className: "bg-yellow-100 text-yellow-700" },
  extracted: { label: "Extracted", icon: <Clock className="w-3 h-3" />, className: "bg-blue-100 text-blue-700" },
  analyzing: { label: "Analyzing", icon: <Loader2 className="w-3 h-3 animate-spin" />, className: "bg-primary/10 text-primary" },
  analyzed: { label: "Analyzed", icon: <CheckCircle className="w-3 h-3" />, className: "bg-green-100 text-green-700" },
  failed: { label: "Failed", icon: <AlertCircle className="w-3 h-3" />, className: "bg-destructive/10 text-destructive" },
};

export default function ContractsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: contracts, isLoading } = useListContracts();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const deleteContract = useDeleteContract();

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/");
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this contract? This action cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteContract.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = contracts?.filter((c) =>
    c.filename.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
            <p className="text-muted-foreground text-sm mt-1">{contracts?.length ?? 0} contracts total</p>
          </div>
          <Button onClick={() => setLocation("/contracts/upload")} className="gap-2" data-testid="button-upload">
            <Upload className="w-4 h-4" />
            Upload
          </Button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-medium mb-1">{search ? "No contracts match your search" : "No contracts yet"}</p>
              <p className="text-sm text-muted-foreground mb-6">
                {search ? "Try a different search term" : "Upload your first contract to get started"}
              </p>
              {!search && (
                <Button onClick={() => setLocation("/contracts/upload")} data-testid="button-first-upload">
                  Upload a contract
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((contract) => {
                const status = statusConfig[contract.status] ?? statusConfig.uploaded;
                return (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/contracts/${contract.id}`)}
                    data-testid={`contract-row-${contract.id}`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{contract.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(contract.fileSize)} · {formatDate(contract.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium ${status.className}`}>
                        {status.icon}
                        {status.label}
                      </span>
                      <button
                        onClick={(e) => handleDelete(contract.id, e)}
                        disabled={deletingId === contract.id}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        data-testid={`button-delete-${contract.id}`}
                      >
                        {deletingId === contract.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
