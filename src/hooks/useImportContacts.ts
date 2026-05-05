import { useState, useEffect, useCallback } from "react";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export type DedupeStrategy = "skip" | "update" | "create_new";

export interface ColumnMapping {
  // file column index → CRM field key (or "__custom__" / "__ignore__")
  [fileColIndex: number]: string;
}

export interface ImportConfig {
  dedupe_strategy: DedupeStrategy;
  default_stage_id: string | null;
  default_assignee_id: string | null;
  default_tags: string[];
  source: string;
  default_country_code: string;
}

export interface FileData {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: (string | number | null)[][];
}

export interface ImportDraft {
  step: WizardStep;
  fileData: FileData | null;
  mapping: ColumnMapping;
  config: ImportConfig;
}

const DEFAULT_CONFIG: ImportConfig = {
  dedupe_strategy: "skip",
  default_stage_id: null,
  default_assignee_id: null,
  default_tags: [],
  source: "",
  default_country_code: "55",
};

const DEFAULT_DRAFT: ImportDraft = {
  step: 1,
  fileData: null,
  mapping: {},
  config: DEFAULT_CONFIG,
};

export const CRM_FIELDS = [
  { key: "__ignore__", label: "— Não importar —" },
  { key: "name", label: "Nome" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "tags", label: "Tags (separadas por vírgula)" },
  { key: "stage", label: "Estágio (nome)" },
  { key: "notes", label: "Observações" },
  { key: "__custom__", label: "Campo personalizado" },
] as const;

const draftKey = (orgId: string) => `crm-import-draft-${orgId}`;

export function useImportContacts(organizationId: string | undefined) {
  const [draft, setDraft] = useState<ImportDraft>(DEFAULT_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (!organizationId) return;
    try {
      const raw = localStorage.getItem(draftKey(organizationId));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ImportDraft>;
        // Don't restore step 5 (execution should restart fresh)
        const restoredStep = parsed.step && parsed.step < 5 ? parsed.step : 1;
        setDraft({
          step: restoredStep as WizardStep,
          fileData: parsed.fileData ?? null,
          mapping: parsed.mapping ?? {},
          config: { ...DEFAULT_CONFIG, ...(parsed.config ?? {}) },
        });
      }
    } catch {
      // ignore corrupt draft
    }
    setHydrated(true);
  }, [organizationId]);

  // Persist draft
  useEffect(() => {
    if (!organizationId || !hydrated) return;
    try {
      // Don't persist huge file rows beyond 200 to keep localStorage light
      const toSave: ImportDraft = {
        ...draft,
        fileData: draft.fileData
          ? { ...draft.fileData, rows: draft.fileData.rows.slice(0, 200) }
          : null,
      };
      localStorage.setItem(draftKey(organizationId), JSON.stringify(toSave));
    } catch {
      // quota exceeded — silently ignore
    }
  }, [draft, organizationId, hydrated]);

  const setStep = useCallback((step: WizardStep) => {
    setDraft((d) => ({ ...d, step }));
  }, []);

  const setFileData = useCallback((fileData: FileData | null) => {
    setDraft((d) => ({ ...d, fileData, mapping: {} }));
  }, []);

  const setMapping = useCallback((mapping: ColumnMapping) => {
    setDraft((d) => ({ ...d, mapping }));
  }, []);

  const setConfig = useCallback((config: Partial<ImportConfig>) => {
    setDraft((d) => ({ ...d, config: { ...d.config, ...config } }));
  }, []);

  const reset = useCallback(() => {
    if (organizationId) {
      try {
        localStorage.removeItem(draftKey(organizationId));
      } catch {
        // ignore
      }
    }
    setDraft(DEFAULT_DRAFT);
  }, [organizationId]);

  return {
    draft,
    hydrated,
    setStep,
    setFileData,
    setMapping,
    setConfig,
    reset,
  };
}

// ────────────── Helpers ──────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return EMAIL_REGEX.test(value.trim());
}

/**
 * Normalize a phone number to E.164-ish format (digits with + prefix).
 * Returns null if cannot be parsed.
 */
export function parsePhoneE164(
  raw: string | number | null | undefined,
  defaultCountryCode = "55"
): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  const startsWithPlus = str.startsWith("+");
  const digits = str.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (!startsWithPlus) {
    // If it doesn't already start with the country code and is local length, prefix it
    if (digits.length >= 10 && digits.length <= 11) {
      normalized = defaultCountryCode + digits;
    }
  }

  if (normalized.length < 10 || normalized.length > 15) return null;
  return "+" + normalized;
}

/**
 * Auto-detect column mapping based on header names.
 */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  headers.forEach((header, idx) => {
    const h = String(header || "").toLowerCase().trim();
    if (!h) {
      mapping[idx] = "__ignore__";
      return;
    }
    if (/^(nome|name|cliente|contato|contact)$/i.test(h)) {
      mapping[idx] = "name";
    } else if (/(telefone|phone|whats|celular|tel|fone|mobile)/i.test(h)) {
      mapping[idx] = "phone";
    } else if (/(email|e-mail|mail)/i.test(h)) {
      mapping[idx] = "email";
    } else if (/(tag|etiqueta|categoria)/i.test(h)) {
      mapping[idx] = "tags";
    } else if (/(estagio|estágio|stage|etapa|funil|status)/i.test(h)) {
      mapping[idx] = "stage";
    } else if (/(observ|notes|nota|coment)/i.test(h)) {
      mapping[idx] = "notes";
    } else {
      mapping[idx] = "__custom__";
    }
  });
  return mapping;
}

export interface ProcessedRow {
  rowIndex: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  stage: string | null;
  notes: string | null;
  custom_fields: Record<string, string>;
  errors: string[];
}

export function processRow(
  row: (string | number | null)[],
  headers: string[],
  mapping: ColumnMapping,
  rowIndex: number,
  defaultCountryCode: string
): ProcessedRow {
  const result: ProcessedRow = {
    rowIndex,
    name: null,
    phone: null,
    email: null,
    tags: [],
    stage: null,
    notes: null,
    custom_fields: {},
    errors: [],
  };

  Object.entries(mapping).forEach(([idxStr, field]) => {
    const idx = Number(idxStr);
    const raw = row[idx];
    const value = raw === null || raw === undefined ? "" : String(raw).trim();

    if (field === "__ignore__") return;

    if (field === "name") {
      result.name = value || null;
    } else if (field === "phone") {
      const parsed = parsePhoneE164(value, defaultCountryCode);
      if (!parsed && value) {
        result.errors.push(`Telefone inválido: "${value}"`);
      }
      result.phone = parsed;
    } else if (field === "email") {
      if (value && !validateEmail(value)) {
        result.errors.push(`E-mail inválido: "${value}"`);
      } else {
        result.email = value || null;
      }
    } else if (field === "tags") {
      result.tags = value
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (field === "stage") {
      result.stage = value || null;
    } else if (field === "notes") {
      result.notes = value || null;
    } else if (field === "__custom__") {
      const colName = headers[idx] || `col_${idx}`;
      if (value) result.custom_fields[colName] = value;
    }
  });

  if (!result.name || !result.name.trim()) {
    result.errors.push("Nome obrigatório");
  }
  if (!result.phone) {
    result.errors.push("Telefone obrigatório");
  }

  return result;
}
