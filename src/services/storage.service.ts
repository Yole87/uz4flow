/**
 * Storage Service
 *
 * API client for storage operations.
 */

import { invokeFunction } from "./api";
import { getImpersonatedOrgId } from "@/hooks/useImpersonation";

export interface CleanupResult {
  mediaFilesDeleted: number;
  attachmentsDeleted: number;
  usedBytesBefore?: number;
  usedBytesAfter?: number;
  error?: string;
}

/**
 * Trigger manual storage cleanup on the backend.
 * If the operator is in support mode (impersonating an org), the impersonated
 * org id is forwarded so the cleanup acts on the correct tenant.
 */
export async function cleanStorage(): Promise<CleanupResult> {
  const impersonate_org_id = getImpersonatedOrgId();
  return invokeFunction<CleanupResult>(
    "storage-manual-cleanup",
    impersonate_org_id ? { impersonate_org_id } : {}
  );
}
