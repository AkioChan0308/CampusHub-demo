// Bản chạy trong trình duyệt của server/src/password.ts: scrypt của Node không có ở trình duyệt, nên dùng PBKDF2 (WebCrypto).
// Dạng lưu: pbkdf2$<vòng lặp>$<salt base64url>$<mã băm base64url>. Chỉ là bản demo, không mang sang bản thật.

const ITERATIONS = 100_000;
const KEY_BITS = 256;

const enc = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const dec = (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, KEY_BITS);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(password, salt, ITERATIONS);
  return ["pbkdf2", ITERATIONS, enc(salt), enc(key)].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, salt, key] = stored.split("$");
  if (kind !== "pbkdf2" || !salt || !key) return false;
  const expected = dec(key);
  const actual = await derive(password, dec(salt), Number(n));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

let dummy: Promise<string> | undefined;
export const dummyHash = () => (dummy ??= hashPassword(enc(crypto.getRandomValues(new Uint8Array(24)))));
