/** Ports, accounts and throwaway secrets for the local UAT stack (never used outside tests). */
export const UAT = {
  qrisPort: 8797,
  plainPort: 8796,
  mockPort: 8798,
  midtransKey: "SB-Mid-server-uat-mock-key-0123456789",
  password: "Uji-WakRo-Sandi-2026!",
  staff: {
    kasir: { username: "kasir1", name: "Jamie Kasir" },
    kasir2: { username: "kasir2", name: "Rina Kasir" },
    dapur: { username: "dapur1", name: "Chef Junaedi" },
    manajer: { username: "owner1", name: "Hendra Owner" },
    pelayan: { username: "pelayan1", name: "Budi Pelayan" },
  },
};
