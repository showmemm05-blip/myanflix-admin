import { apiClient } from "./apiClient";
import type { RelationshipNetwork } from "@/types/user-relationship";

/**
 * Read-only view of how customer accounts connect to each other through the
 * phone numbers they share — see `types/user-relationship.ts` for why the link
 * key is withdrawal account numbers + profile phones and never deposits.
 *
 * Backend gates this behind USER_MANAGE, the same permission as the Users
 * page, so the admin surface is Super Admin only.
 */
export const userRelationshipService = {
  /**
   * Walks the phone/user closure outward from `phone` (BFS on the backend,
   * capped so a hub number can't return the entire customer base).
   *
   * A phone that matches nothing is NOT an error: the backend answers 200 with
   * empty `users`/`phones`/`edges`, which the page renders as its distinct
   * "no results" state rather than an error state.
   */
  getRelationshipNetwork(phone: string): Promise<RelationshipNetwork> {
    return apiClient.get<RelationshipNetwork>("/users/relationships", { params: { phone } });
  },
};
