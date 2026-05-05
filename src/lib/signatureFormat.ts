/**
 * Centraliza a formatação da assinatura do atendente exibida em mensagens enviadas.
 * Usado tanto no preview da UI quanto na referência da edge function.
 */
export type SignatureFormat = "name_only" | "name_role" | "name_role_dept" | "none";

export interface SignatureInput {
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;        // Cargo (ex: "Gerente")
  department?: string | null;  // Departamento (ex: "Comercial")
  format?: SignatureFormat;
  silentMode?: boolean;
  organizationEnabled?: boolean;
}

export function buildAttendantSignature(input: SignatureInput): string | null {
  const {
    firstName,
    lastName,
    role,
    department,
    format = "name_role_dept",
    silentMode = false,
    organizationEnabled = true,
  } = input;

  if (silentMode || !organizationEnabled || format === "none") return null;

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (!fullName) return null;

  switch (format) {
    case "name_only":
      return fullName;
    case "name_role":
      return role ? `${fullName} — ${role}` : fullName;
    case "name_role_dept":
      if (role && department) return `${fullName} — ${role} · ${department}`;
      if (role) return `${fullName} — ${role}`;
      if (department) return `${fullName} — ${department}`;
      return fullName;
    default:
      return fullName;
  }
}

export const SIGNATURE_FORMAT_LABELS: Record<SignatureFormat, string> = {
  name_only: "Apenas nome",
  name_role: "Nome — Cargo",
  name_role_dept: "Nome — Cargo · Departamento",
  none: "Sem assinatura",
};
