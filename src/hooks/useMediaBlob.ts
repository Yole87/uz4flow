import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Extract the storage path from a Supabase Storage URL.
 * E.g. "https://xxx.supabase.co/storage/v1/object/public/message-media/org/file.pdf"
 * returns "org/file.pdf"
 */
function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.substring(idx + marker.length));
}

/**
 * Hook that converts a Supabase storage URL into a blob URL
 * by downloading the file via the authenticated SDK.
 * This is needed because the message-media bucket is private.
 */
export function useMediaBlob(mediaUrl: string | null | undefined) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mediaUrl) {
      setBlobUrl(null);
      return;
    }

    // Data URLs don't need conversion
    if (mediaUrl.startsWith("data:")) {
      setBlobUrl(mediaUrl);
      return;
    }

    const path = extractStoragePath(mediaUrl, "message-media");
    if (!path) {
      // Not a storage URL, use as-is (external URLs)
      setBlobUrl(mediaUrl);
      return;
    }

    let revoked = false;
    let currentBlobUrl: string | null = null;

    setLoading(true);
    setError(false);

    supabase.storage
      .from("message-media")
      .download(path)
      .then(({ data, error: dlError }) => {
        if (revoked) return;
        if (dlError || !data) {
          console.warn("[useMediaBlob] Download failed:", dlError?.message);
          setError(true);
          setLoading(false);
          return;
        }
        currentBlobUrl = URL.createObjectURL(data);
        setBlobUrl(currentBlobUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!revoked) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      revoked = true;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [mediaUrl]);

  return { blobUrl, loading, error };
}
