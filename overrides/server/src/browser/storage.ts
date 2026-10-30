// Chỗ lưu của bản demo: localStorage của trình duyệt (mọi tab cùng đọc), lùi về bộ nhớ khi trình duyệt chặn.
// Không có gì rời khỏi máy người xem.
//
// Dữ liệu CLB, tài khoản và danh sách phiên dùng chung giữa các tab (localStorage): tab này đổi thì tab kia thấy ngay lần hỏi tiếp theo,
// nên bàn giao hai phía chạy được như bản thật. Còn "cookie" đăng nhập thì riêng từng tab (sessionStorage): mở hai tab, mỗi tab đăng nhập
// một người, ví dụ chủ nhiệm cũ và chủ nhiệm mới.

const NS = "campushub-demo:";
const memory = new Map<string, string>();
const tabMemory = new Map<string, string>();

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

/** Như `storage` nhưng riêng từng tab. */
const tabStorage = {
  get(key: string): string | null {
    try {
      return sessionStorage.getItem(NS + key);
    } catch {
      return tabMemory.get(key) ?? null;
    }
  },
  set(key: string, value: string): void {
    tabMemory.set(key, value);
    try {
      sessionStorage.setItem(NS + key, value);
    } catch {
      // Bị chặn: vẫn chạy bằng bộ nhớ của tab này.
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

/** Cookie giả, riêng từng tab: mỗi tên một giá trị. */
export const cookieJar = {
  all(): Record<string, string> {
    const raw = tabStorage.get("cookies");
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  },
  set(name: string, value: string, maxAgeSeconds: number) {
    const jar = cookieJar.all();
    if (maxAgeSeconds <= 0) delete jar[name];
    else jar[name] = value;
    tabStorage.set("cookies", JSON.stringify(jar));
  },
};

/** Trang đầu dùng hàm này thay cho proxy.ts: tab này đã có phiên thì đưa thẳng vào trang của mình. */
export const hasSessionCookie = () => Boolean(cookieJar.all()["ch_session"]);
