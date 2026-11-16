/** Longest edge, in pixels, of an uploaded product photo. */
const IMAGE_MAX_DIMENSION = 640;
/** JPEG quality of an uploaded product photo. */
const IMAGE_JPEG_QUALITY = 0.82;

/**
 * Compresses a photo from the device in the browser (HTML5 canvas) into a small JPEG data URL
 * (~40-80KB), light enough to store offline in IndexedDB.
 */
export function compressImageFile(
  file: File,
  maxDim: number = IMAGE_MAX_DIMENSION,
  quality: number = IMAGE_JPEG_QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const source = reader.result as string;
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(source);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = source;
    };
    reader.readAsDataURL(file);
  });
}
