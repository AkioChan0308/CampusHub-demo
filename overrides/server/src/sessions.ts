// Bản chạy trong trình duyệt của server/src/sessions.ts: phiên lưu trong localStorage để mọi tab dùng chung, như cookie thật.

import { readJson, storage } from "./browser/storage.ts";

export const SESSION_COOKIE = "ch_session";
export const OAUTH_COOKIE = "ch_oauth";
export const SESSION_SECONDS = 30 * 24 * 3600;
export const OAUTH_SECONDS = 10 * 60;

export interface PendingLogin {
  verifier: string;
  next: string;
}

export interface Sessions {
  start(personId: string): string;
  personId(sessionId: string | undefined): string | undefined;
  end(sessionId: string | undefined): void;
  savePending(state: string, login: PendingLogin): void;
  takePending(state: string | undefined): PendingLogin | undefined;
  persisted(): Promise<void>;
}

export const randomToken = (bytes = 32) => {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

type Rows = Record<string, { personId: string; expires: number }>;

export function createSessions(now: () => number = Date.now): Sessions {
  const read = () => readJson<Rows>("sessions", {});
  const write = (rows: Rows) => storage.set("sessions", JSON.stringify(rows));
  return {
    start(personId) {
      const id = randomToken();
      write({ ...read(), [id]: { personId, expires: now() + SESSION_SECONDS * 1000 } });
      return id;
    },
    personId(sessionId) {
      const s = sessionId ? read()[sessionId] : undefined;
      return s && s.expires >= now() ? s.personId : undefined;
    },
    end(sessionId) {
      if (!sessionId) return;
      const rows = read();
      delete rows[sessionId];
      write(rows);
    },
    savePending: () => {},
    takePending: () => undefined,
    persisted: () => Promise.resolve(),
  };
}
