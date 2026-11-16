/** The one place the shop's identity is defined; receipts, QR sheets, headers and exports read it. */
export const STORE_PROFILE = {
  brand: "WAKRO Digital",
  outlet: "Warung WakRo Baru",
} as const;

export const STORE_TITLE = `${STORE_PROFILE.brand} · ${STORE_PROFILE.outlet}`;
