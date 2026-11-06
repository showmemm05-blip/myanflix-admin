import { redirect } from "next/navigation";

/**
 * The single-.mp4 upload page is gone (the owner, 3 Nov 2026): every movie
 * now comes in through the folder flow, which is the "Upload Movie" entry.
 * Old links and bookmarks land there.
 */
export default function UploadMovieRedirect() {
  redirect("/movies/upload-external");
}
