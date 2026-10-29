// Chỗ lưu của bản demo: localStorage của trình duyệt (mọi tab cùng đọc), lùi về bộ nhớ khi trình duyệt chặn.
// Không có gì rời khỏi máy người xem.

const NS = "campushub-demo:";
const memory = new Map<string, string>();

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(NS + key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    try {
      localStorage.setItem(NS + key, value);
    } catch {
      // Đầy hoặc bị chặn: vẫn chạy bằng bộ nhớ của tab này.
    }
  },
  remove(key: string): void {
    memory.delete(key);
    try {
      localStorage.removeItem(NS + key);
    } catch {
      // Bỏ qua.
    }
  },
};

export function readJson<T>(key: string, fallback: T): T {
  const raw = storage.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Cookie giả: mỗi tên một giá trị, lưu trong storage để mọi tab dùng chung như cookie thật. */
export const cookieJar = {
  all: () => readJson<Record<string, string>>("cookies", {}),
  set(name: string, value: string, maxAgeSeconds: number) {
    const jar = cookieJar.all();
    if (maxAgeSeconds <= 0) delete jar[name];
    else jar[name] = value;
    storage.set("cookies", JSON.stringify(jar));
  },
};

/** Trang đầu dùng hàm này thay cho proxy.ts: đã có phiên thì đưa thẳng vào trang của mình. */
export const hasSessionCookie = () => Boolean(cookieJar.all()["ch_session"]);
