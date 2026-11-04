import { vi } from "vitest";

// ID token verification is replaced so tests can exercise MFA / freshness rules precisely.
vi.mock("../src/lib/identity", () => ({
  verifyIdToken: vi.fn(),
  revokeFirebaseTokens: vi.fn().mockResolvedValue(undefined),
}));
