import { useEffect, useState, useCallback } from "react";
import { useUserOrganization } from "./useUserOrganization";

/**
 * Persiste a última prospecção (searchId, leads e metadata) em localStorage
 * por organização. Mantém um histórico rotativo das últimas 3 buscas para
 * fallback caso o usuário descarte sem querer.
 *
 * Uma busca é considerada "salva" quando o usuário marca explicitamente
 * via `markAsSaved()` (após enviar leads ao CRM, exportar, etc.).
 */

const STORAGE_KEY_PREFIX = "openflow:prospection:last:";
const HISTORY_KEY_PREFIX = "openflow:prospection:history:";
const MAX_HISTORY = 3;

export interface PersistedProspection {
  searchId: string;
  status: any; // SearchStatus shape
  elapsedTime: number;
  savedAt: string | null; // ISO; null = unsaved
  createdAt: string; // ISO
  searchMeta?: {
    keyword?: string;
    location?: string;
    provider?: string;
  };
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("[prospection-persistence] write failed:", err);
  }
}

export function useProspectionPersistence() {
  const { data: org } = useUserOrganization();
  const orgId = org?.id;
  const storageKey = orgId ? `${STORAGE_KEY_PREFIX}${orgId}` : null;
  const historyKey = orgId ? `${HISTORY_KEY_PREFIX}${orgId}` : null;

  const [persisted, setPersisted] = useState<PersistedProspection | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hidratação inicial quando a org for resolvida
  useEffect(() => {
    if (!storageKey) return;
    const data = readJSON<PersistedProspection>(storageKey);
    setPersisted(data);
    setHydrated(true);
  }, [storageKey]);

  /** Salva a busca atual no localStorage. Se for um novo searchId, rotaciona o histórico. */
  const persist = useCallback(
    (data: Omit<PersistedProspection, "createdAt" | "savedAt"> & { savedAt?: string | null }) => {
      if (!storageKey || !historyKey) return;
      const existing = readJSON<PersistedProspection>(storageKey);
      const isSameSearch = existing?.searchId === data.searchId;

      const entry: PersistedProspection = {
        ...data,
        savedAt: data.savedAt ?? existing?.savedAt ?? null,
        createdAt: isSameSearch ? existing!.createdAt : new Date().toISOString(),
      };
      writeJSON(storageKey, entry);
      setPersisted(entry);

      // Histórico rotativo
      if (!isSameSearch) {
        const history = readJSON<PersistedProspection[]>(historyKey) || [];
        const filtered = history.filter((h) => h.searchId !== data.searchId);
        const next = [entry, ...filtered].slice(0, MAX_HISTORY);
        writeJSON(historyKey, next);
      }
    },
    [storageKey, historyKey],
  );

  /** Marca a busca atual como salva (após exportar / enviar ao CRM). */
  const markAsSaved = useCallback(() => {
    if (!storageKey) return;
    const existing = readJSON<PersistedProspection>(storageKey);
    if (!existing) return;
    const updated = { ...existing, savedAt: new Date().toISOString() };
    writeJSON(storageKey, updated);
    setPersisted(updated);
  }, [storageKey]);

  /** Limpa a busca atual (sem mexer no histórico). */
  const clear = useCallback(() => {
    if (!storageKey) return;
    localStorage.removeItem(storageKey);
    setPersisted(null);
  }, [storageKey]);

  const hasUnsavedLeads = !!(
    persisted &&
    !persisted.savedAt &&
    (persisted.status?.leads?.length ?? 0) > 0
  );

  return {
    persisted,
    hydrated,
    hasUnsavedLeads,
    unsavedCount: persisted?.status?.leads?.length ?? 0,
    persist,
    markAsSaved,
    clear,
  };
}
