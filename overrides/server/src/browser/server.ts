// "Máy chủ" của bản demo chạy ngay trong trình duyệt. Dùng lại đúng bảng API (contract.ts) và đúng các handler của máy chủ thật,
// chỉ thay phần Express, cookie, kho dữ liệu và phiên bằng localStorage. Dữ liệu không rời khỏi máy người xem.

import { z } from "zod";
import { API_PREFIX, ENDPOINTS, type ApiErrorBody, type EndpointId, type ErrorCode } from "../contract.ts";
import type { Config } from "../config.ts";
import { createSeed, nowIso, STATE_VERSION, type AppState, type Person } from "../domain.ts";
import { HttpError, unauthenticated } from "../errors.ts";
import { aiHandlers } from "../handlers/ai.ts";
import { authHandlers } from "../handlers/auth.ts";
import { boardHandlers } from "../handlers/board.ts";
import { exploreHandlers } from "../handlers/explore.ts";
import { kitHandlers } from "../handlers/kit.ts";
import { meHandlers } from "../handlers/me.ts";
import { moneyHandlers } from "../handlers/money.ts";
import { postHandlers } from "../handlers/posts.ts";
import { schoolHandlers } from "../handlers/school.ts";
import { setupHandlers } from "../handlers/setup.ts";
import { systemHandlers } from "../handlers/system.ts";
import { taskHandlers } from "../handlers/tasks.ts";
import type { AuthKit, Ctx, Handlers } from "../handlers/types.ts";
import { accountsOn, type Account, type Accounts } from "../accounts.ts";
import { seedDemoAccounts } from "../demo-accounts.ts";
import { createSessions, SESSION_COOKIE, SESSION_SECONDS } from "../sessions.ts";
import { cookieJar, readJson, storage } from "./storage.ts";

z.config(z.locales.vi());

const handlers: Handlers = { ...systemHandlers, ...authHandlers, ...meHandlers, ...exploreHandlers, ...boardHandlers, ...moneyHandlers, ...schoolHandlers, ...setupHandlers, ...kitHandlers, ...taskHandlers, ...postHandlers, ...aiHandlers };

const config: Config = {
  port: 0, authMode: "demo", qrSecret: "chi-dung-cho-ban-demo", webOrigin: "", googleClientId: "", googleClientSecret: "", loginAs: {},
  cookieSecure: false, databaseUrl: "", aiMode: "mock", geminiApiKey: "", aiModel: "", demoNow: undefined, aiDailyCap: 0, aiFreeAsks: 0,
};

// --- Kho dữ liệu: đọc lại từ localStorage khi tab khác vừa ghi, nên mọi tab thấy cùng một dữ liệu.
let state: AppState | undefined;
let lastRaw: string | null = null;

function save() {
  lastRaw = JSON.stringify(state);
  storage.set("state", lastRaw);
}

function sync(): AppState {
  const raw = storage.get("state");
  if (state && raw === lastRaw) return state;
  let parsed: AppState | undefined;
  try {
    parsed = raw ? (JSON.parse(raw) as AppState) : undefined;
  } catch {
    parsed = undefined;
  }
  if (parsed && parsed.v === STATE_VERSION) {
    state = parsed;
    lastRaw = raw;
  } else {
    state = createSeed();
    save();
  }
  return state;
}

// --- Tài khoản đăng nhập bằng mật khẩu.
const accountRows = new Map<string, Account>();
let lastAccountsRaw: string | null = null;
const saveAccounts = () => {
  lastAccountsRaw = JSON.stringify([...accountRows.values()]);
  storage.set("accounts", lastAccountsRaw);
};
function syncAccounts() {
  const raw = storage.get("accounts");
  if (raw === lastAccountsRaw) return;
  lastAccountsRaw = raw;
  accountRows.clear();
  for (const a of readJson<Account[]>("accounts", [])) accountRows.set(a.personId, a);
}
const baseAccounts = accountsOn(accountRows, saveAccounts, () => storage.remove("accounts"));
const accounts: Accounts = new Proxy(baseAccounts, {
  get(target, key, receiver) {
    syncAccounts();
    return Reflect.get(target, key, receiver);
  },
});

const sessions = createSessions(() => Date.now());

// Tài khoản mẫu: tạo một lần lúc mở lần đầu (băm mật khẩu mất vài chục mili giây).
let ready: Promise<void> | undefined;
const ensureReady = () => (ready ??= (async () => {
  syncAccounts();
  await seedDemoAccounts(accounts, sync(), false);
})());

// --- Id cho thứ người xem tạo mới: lấy trong "bể" đã dựng sẵn trang lúc build (xem web/src/mock/static-params.ts).
(globalThis as { __campushubPool?: (prefix: string) => string }).__campushubPool = (prefix) => {
  const key = `pool-${prefix}`;
  const n = Number(storage.get(key) ?? 0) + 1;
  storage.set(key, String(n));
  return `${prefix}-n${n}`;
};

// --- Bảng đường dẫn dựng từ ENDPOINTS.
type Route = { id: EndpointId; method: string; re: RegExp; names: string[]; auth: string; status?: number; redirect?: boolean };
const routes: Route[] = (Object.keys(ENDPOINTS) as EndpointId[]).map((id) => {
  const meta: { method: string; path: string; auth: string; status?: number; redirect?: true } = ENDPOINTS[id];
  const names: string[] = [];
  const re = new RegExp("^" + meta.path.replace(/:([A-Za-z]+)/g, (_m, n: string) => (names.push(n), "([^/]+)")) + "/?$");
  return { id, method: meta.method, re, names, auth: meta.auth, status: meta.status, redirect: meta.redirect };
});

const errorBody = (code: ErrorCode, message: string, details?: Record<string, unknown>): ApiErrorBody => ({ error: { code, message, details } });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function authenticate(headers: Headers, cookies: Record<string, string>): Person {
  const find = (id: string | undefined | null) => sync().persons.find((p) => p.id === id);
  const demoId = headers.get("x-demo-user");
  if (demoId) {
    const person = find(demoId);
    if (!person) throw unauthenticated(`Không có người dùng ${demoId} trong dữ liệu mẫu.`);
    return person;
  }
  const fromSession = find(sessions.personId(cookies[SESSION_COOKIE]));
  if (fromSession) return fromSession;
  throw unauthenticated("Bạn cần đăng nhập.");
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Thay cho fetch tới máy chủ. Có chút độ trễ để khung xương và chuyển động hiện như khi gọi máy chủ thật. */
export async function mockFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Response> {
  await wait(60 + Math.random() * 120);
  const method = (init.method ?? "GET").toUpperCase();
  const u = new URL(url, "http://demo.local");
  const path = u.pathname.startsWith(API_PREFIX) ? u.pathname.slice(API_PREFIX.length) : u.pathname;
  const route = routes.map((r) => ({ r, m: r.method === method ? r.re.exec(path) : null })).find((x) => x.m);
  if (!route?.m) return json(404, errorBody("NOT_FOUND", "Không có API này."));
  const { r } = route;
  try {
    await ensureReady();
    const cookies = cookieJar.all();
    const headers = new Headers(init.headers);
    const person = r.auth === "user" ? authenticate(headers, cookies) : null;
    const params = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(route.m![i + 1]!)]));
    const now = () => Date.now();
    const auth: AuthKit = {
      cookie: (name) => cookieJar.all()[name],
      setCookie: (name, value, maxAge) => cookieJar.set(name, value, maxAge),
      clearCookie: (name) => cookieJar.set(name, "", 0),
      startSession: (personId) => {
        sessions.end(cookieJar.all()[SESSION_COOKIE]);
        cookieJar.set(SESSION_COOKIE, sessions.start(personId), SESSION_SECONDS);
      },
      endSession: () => {
        sessions.end(cookieJar.all()[SESSION_COOKIE]);
        cookieJar.set(SESSION_COOKIE, "", 0);
      },
      sessions,
      accounts,
      exchangeGoogleCode: async () => {
        throw new Error("Bản demo không có đăng nhập Google.");
      },
    };
    let body: unknown;
    try {
      body = init.body ? JSON.parse(init.body) : undefined;
    } catch {
      return json(400, errorBody("VALIDATION", "Dữ liệu gửi lên không phải JSON hợp lệ."));
    }
    const ctx: Ctx<EndpointId> = {
      get me(): Person {
        if (!person) throw unauthenticated();
        return person;
      },
      params: params as Ctx<EndpointId>["params"],
      query: Object.fromEntries(u.searchParams),
      body,
      get state() {
        return sync();
      },
      update: (fn) => {
        const before = sync();
        const next = fn(before);
        if (next !== before) {
          state = next;
          save();
        }
        return next;
      },
      now,
      nowIso: () => nowIso(now()),
      config,
      resetStore: () => {
        state = createSeed();
        save();
        for (const k of ["pool-clb", "pool-tin", "pool-buoi", "pool-dot-thu", "pool-moi"]) storage.remove(k);
      },
      auth,
    };
    const handler = handlers[r.id] as unknown as (c: Ctx<EndpointId>) => unknown;
    const result = await handler(ctx);
    return json(r.status ?? 200, result);
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, errorBody(err.code, err.message, err.details));
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
      return json(400, errorBody("VALIDATION", issues[0]?.message ?? "Dữ liệu gửi lên không hợp lệ.", { issues }));
    }
    console.error(err);
    return json(500, errorBody("INTERNAL", "Có lỗi xảy ra. Thử lại sau."));
  }
}

// Mọi lệnh gọi /api/v1 trong trang (kể cả script bấm thử gọi fetch trực tiếp) đều đi vào "máy chủ" trong trình duyệt.
if (typeof window !== "undefined") {
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!/\/api\/v1\//.test(url)) return real(input, init);
    return mockFetch(url, { method: init?.method, headers: init?.headers as Record<string, string> | undefined, body: typeof init?.body === "string" ? init.body : undefined });
  };
}
