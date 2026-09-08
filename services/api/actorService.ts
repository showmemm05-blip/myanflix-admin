import { apiClient } from "./apiClient";
import type { Actor, ActorFormValues } from "@/types/actor";
import type { PaginatedResponse, PaginationParams } from "@/types/api";

export interface ActorQuery extends PaginationParams {
  /** Matches on name — what the cast picker types into. */
  search?: string;
}

export const actorService = {
  getActors(query: ActorQuery = {}, signal?: AbortSignal) {
    return apiClient.get<PaginatedResponse<Actor>>("/actors", {
      params: query,
      signal,
    });
  },

  getActorById(id: string, signal?: AbortSignal) {
    return apiClient.get<Actor>(`/actors/${id}`, { signal });
  },

  createActor(values: ActorFormValues, signal?: AbortSignal) {
    return apiClient.post<Actor>("/actors", values, { signal });
  },

  updateActor(
    id: string,
    values: Partial<ActorFormValues>,
    signal?: AbortSignal,
  ) {
    return apiClient.put<Actor>(`/actors/${id}`, values, { signal });
  },

  deleteActor(id: string) {
    return apiClient.delete<void>(`/actors/${id}`);
  },
};
