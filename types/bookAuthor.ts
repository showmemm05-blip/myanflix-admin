/**
 * A person credited as the writer of books — the books' twin of Actor.
 *
 * `bookCount` is counted from the relation on every read, never stored — so
 * it cannot drift the way a cached counter does when a book is deleted.
 */
export interface BookAuthor {
  id: string;
  name: string;
  imageUrl: string | null;
  bio: string | null;
  bookCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookAuthorFormValues {
  name: string;
  imageUrl?: string;
  bio?: string | null;
}

/** The lightweight shape a book carries as `authorRef`. */
export interface BookAuthorRef {
  id: string;
  name: string;
  imageUrl: string | null;
}
