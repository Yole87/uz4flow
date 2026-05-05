import { supabase } from "@/integrations/supabase/client";

/**
 * Extract the storage path from a public Supabase Storage URL.
 * E.g. "https://xxx.supabase.co/storage/v1/object/public/message-media/org/file.pdf"
 * returns "org/file.pdf"
 */
function extractStoragePath(publicUrl: string, bucket: string): string | null {
  // Pattern: .../object/public/<bucket>/<path>
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.substring(idx + marker.length));
}

/**
 * Download a file from Supabase Storage programmatically,
 * bypassing ad-blocker restrictions on direct navigation.
 *
 * Falls back to window.open if SDK download fails.
 */
export async function downloadMediaFile(mediaUrl: string, fileName?: string): Promise<void> {
  const path = extractStoragePath(mediaUrl, "message-media");

  if (path) {
    try {
      const { data, error } = await supabase.storage
        .from("message-media")
        .download(path);

      if (data && !error) {
        const blobUrl = URL.createObjectURL(data);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName || path.split("/").pop() || "download";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Revoke after a short delay so the browser can finish the download
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        return;
      }
      console.warn("Storage SDK download failed, falling back:", error?.message);
    } catch (err) {
      console.warn("Storage SDK download error, falling back:", err);
    }
  }

  // Fallback: try opening the URL directly
  window.open(mediaUrl, "_blank");
}

/**
 * Open a media file for viewing. Uses programmatic fetch to create
 * a blob URL that opens in a new tab, bypassing ad-blockers.
 */
export async function openMediaFile(mediaUrl: string): Promise<void> {
  const path = extractStoragePath(mediaUrl, "message-media");

  if (path) {
    try {
      const { data, error } = await supabase.storage
        .from("message-media")
        .download(path);

      if (data && !error) {
        const blobUrl = URL.createObjectURL(data);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return;
      }
      console.warn("Storage SDK open failed, falling back:", error?.message);
    } catch (err) {
      console.warn("Storage SDK open error, falling back:", err);
    }
  }

  window.open(mediaUrl, "_blank");
}
