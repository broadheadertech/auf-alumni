/**
 * Prepares a user-picked image for upload.
 *
 * The profile photo picker accepted only `image/jpeg,image/png` and rejected
 * anything over 5 MB, which is most photos taken on a phone: iPhones save HEIC
 * (greyed out in the picker, so the file could not even be selected) and a
 * modern camera JPEG routinely exceeds 5 MB. Either way the upload appeared to
 * do nothing.
 *
 * So instead of refusing awkward files, we normalise them: decode whatever the
 * browser can read, downscale to a sane avatar size and re-encode as JPEG. That
 * fixes the size limit, strips EXIF (including GPS) as a side effect, and
 * guarantees the stored file is something every browser can actually display —
 * HEIC would upload but render as a broken image.
 */

/** Longest edge of the stored avatar. Plenty for a 200px display at 3x. */
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.9;
/** Sanity cap on the original, so we don't try to decode a 100 MB file. */
const MAX_INPUT_BYTES = 30 * 1024 * 1024;

export type PreparedImage = { blob: Blob; contentType: string };

export class ImagePrepError extends Error {}

export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new ImagePrepError("That file isn't an image — pick a JPG, PNG or HEIC photo.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImagePrepError("That image is over 30 MB — please pick a smaller one.");
  }

  const bitmap = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImagePrepError("Your browser couldn't process that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap) bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new ImagePrepError("Your browser couldn't process that image.");
  return { blob, contentType: "image/jpeg" };
}

/**
 * `createImageBitmap` handles whatever the browser's decoders support — which
 * includes HEIC on Safari but not on Chrome, hence the explicit message rather
 * than a silent failure.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to the <img> path, which sometimes succeeds where
      // createImageBitmap doesn't (and vice versa)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(
          new ImagePrepError(
            file.type === "image/heic" || file.type === "image/heif"
              ? "This browser can't read HEIC photos. On iPhone, Settings → Camera → Formats → Most Compatible, or save the photo as JPG first."
              : "That image couldn't be read — try saving it as a JPG or PNG.",
          ),
        );
      img.src = url;
    });
  } finally {
    // Revoke on the next tick so the decode has definitely finished with it.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
