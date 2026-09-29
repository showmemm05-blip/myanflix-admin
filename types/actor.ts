/**
 * A person in a movie's cast.
 *
 * `movieCount` (standalone films only — episodes are excluded) and
 * `seriesCount` (distinct shows the actor is on, via the show cast or any
 * episode) are counted from the joins on every read, never stored — so they
 * cannot drift the way a cached counter does when a film is deleted.
 */
export interface Actor {
  id: string;
  name: string;
  imageUrl: string | null;
  movieCount: number;
  seriesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActorFormValues {
  name: string;
  imageUrl?: string;
}

/** The lightweight shape a movie's cast list carries. */
export interface ActorRef {
  id: string;
  name: string;
  imageUrl: string | null;
}
