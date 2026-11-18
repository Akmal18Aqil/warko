/** Ports and throwaway secrets for the local end-to-end environment (never used outside tests). */
export const E2E = {
  apiPort: 8799,
  demoPort: 4174,
  sessionSecret: "e2e-session-secret-only-for-local-tests-0123456789",
  pinPepper: "e2e-pin-pepper-only-for-local-tests-0123456789",
  bootstrapSecret: "e2e-bootstrap-secret-only-for-local-tests-0123456789",
  admin: { username: "admin", name: "Admin Uji", password: "e2e-pemilik-sandi-uji-123" },
};
