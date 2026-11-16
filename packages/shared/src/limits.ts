/** Input limits that the API enforces and the browser-only demo backend mirrors. */

export const MAX_ORDER_LINES = 40;
export const MAX_ORDER_QTY = 999;
/** Largest ready-stock adjustment (and largest stock level) accepted. */
export const MAX_STOCK = 1_000_000;
export const MAX_IMAGE_LENGTH = 200_000;
/** Product image: empty, an http(s) URL, a site-relative path, or an inline image data URI. */
export const IMAGE_PATTERN = /^(?:|https?:\/\/\S+|\/(?!\/)\S*|data:image\/(?:png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+)$/i;
