import { useQueryClient } from "@tanstack/react-query";
import { useOrganizationSubscription } from "./useOrganizationSubscription";
import { useState } from "react";
import { toast } from "sonner";
import { cleanStorage as cleanStorageService } from "@/services/storage.service";

interface StorageUsageState {
  usedBytes: number;
  usedMB: number;
  limitMB: number;
  percentage: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
  fileCount: number;
  loading: boolean;
  cleaning: boolean;
  cleanStorage: () => Promise<void>;
  refetch: () => void;
}

export function useStorageUsage(): StorageUsageState {
  const {
    storageUsedBytes,
    storageUsedMB,
    storageLimitMB,
    storagePercentage,
    isNearLimit,
    isAtLimit,
    fileCount,
    loading,
    refetch: refetchStatus,
  } = useOrganizationSubscription();
  
  const queryClient = useQueryClient();
  const [cleaning, setCleaning] = useState(false);

  const handleCleanStorage = async () => {
    setCleaning(true);
    try {
      const data = await cleanStorageService();
      const totalFiles = (data.mediaFilesDeleted || 0) + (data.attachmentsDeleted || 0);
      const before = data.usedBytesBefore ?? 0;
      const after = data.usedBytesAfter ?? 0;
      const freedBytes = Math.max(0, before - after);
      const freedMB = freedBytes / (1024 * 1024);

      if (totalFiles === 0 && freedBytes === 0) {
        toast.info("Nada para limpar — não há arquivos de mídia neste tenant.");
      } else if (freedMB >= 1) {
        toast.success(
          `Limpeza concluída! ${totalFiles} arquivo(s) removido(s) — ${freedMB.toFixed(1)} MB liberados.`
        );
      } else {
        toast.success(
          `Limpeza concluída! ${totalFiles} arquivo(s) removido(s).`
        );
      }
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ["crm-messages"] });
    } catch (err) {
      console.error("Error cleaning storage:", err);
      toast.error("Erro ao limpar armazenamento");
    } finally {
      setCleaning(false);
    }
  };

  return {
    usedBytes: storageUsedBytes ?? 0,
    usedMB: storageUsedMB ?? 0,
    limitMB: storageLimitMB ?? 500,
    percentage: storagePercentage ?? 0,
    isNearLimit: isNearLimit ?? false,
    isAtLimit: isAtLimit ?? false,
    fileCount: fileCount ?? 0,
    loading,
    cleaning,
    cleanStorage: handleCleanStorage,
    refetch: refetchStatus,
  };
}
