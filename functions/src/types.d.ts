import type { Permission, Role } from "./auth/permissions";

export interface AdminContext {
  uid: string;
  email: string | null;
  name: string;
  role: Role;
  permissions: readonly Permission[];
}

export interface SessionContext {
  docId: string;
  csrfToken: string;
  reauthAt: number | null;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminContext;
      adminSession?: SessionContext;
      rawBody?: Buffer;
    }
  }
}
