/**
 * A person in a movie's cast.
 *
 * `movieCount` is counted from the join on every read, never stored — so it
 * cannot drift the way a cached counter does when a film is deleted.
 */
export interface Actor {
  id: string;
  name: string;
  imageUrl: string | null;
  movieCount: number;
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
