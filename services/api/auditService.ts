import { apiClient } from "./apiClient";
import type { PaginatedResponse } from "@/types/api";
import type { AuditCatalogue, AuditLogEntry, AuditQuery } from "@/types/audit";

/**
 * The admin's audit-log API — one method per backend route.
 *
 * Every route under `/audit` is gated on `AUDIT.VIEW`. `apiClient` unwraps
 * the `{ success, data }` envelope and drops `undefined` params before
 * building the URL, which matters here: the backend's ValidationPipe rejects
 * unknown query keys, so a query object must only ever carry DTO keys (see
 * `AuditQuery`) and leave the unused ones `undefined`.
 *
 * Nothing here reshapes a response — the row is rendered as the server
 * describes it.
 */
export const auditService = {
  /** Rows newest first, server-paged. */
  list(query: AuditQuery = {}): Promise<PaginatedResponse<AuditLogEntry>> {
    return apiClient.get<PaginatedResponse<AuditLogEntry>>("/audit", {
      params: query,
    });
  },

  /** One row, or a thrown 404 `ApiError`. */
  get(id: string): Promise<AuditLogEntry> {
    return apiClient.get<AuditLogEntry>(`/audit/${id}`);
  },

  /** The action / category / target-type lists the filter bar is built from. */
  catalogue(): Promise<AuditCatalogue> {
    return apiClient.get<AuditCatalogue>("/audit/catalogue");
  },
};
