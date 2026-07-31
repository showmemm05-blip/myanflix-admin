import { useEffect, useMemo } from "react";

/** A local preview URL for a picked-but-not-yet-uploaded File, revoked automatically once it's no longer needed. */
export function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}
