// Dựng thư mục source/ từ repo CampusHub chính (đọc, không sửa repo chính):
//   1. chép web/ và server/src/ (bỏ Express, PostgreSQL, test);
//   2. chép đè các file trong overrides/ (bản chạy trong trình duyệt);
//   3. áp các sửa nhỏ bằng thay chuỗi. Chuỗi không tìm thấy thì dừng, để biết repo chính đã đổi chỗ đó.
// source/ không đưa vào git: repo này công khai, repo chính thì không.
//
// Dùng: node tools/sync.mjs [đường dẫn repo chính]

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const main = path.resolve(process.argv[2] ?? path.join(root, "..", "campushub"));
const out = path.join(root, "source");
if (!existsSync(path.join(main, "web", "package.json"))) throw new Error(`Không thấy repo CampusHub ở ${main}`);

// Giữ node_modules đã cài để chạy lại nhanh.
const clean = (dir) => {
  for (const entry of existsSync(dir) ? readdirSync(dir) : []) {
    if (entry === "node_modules") continue;
    const full = path.join(dir, entry);
    if (dir === out && entry === "web") clean(full);
    else rmSync(full, { recursive: true, force: true });
  }
};
clean(out);
mkdirSync(out, { recursive: true });

const skipWeb = new Set(["node_modules", ".next", "out", "e2e", "screenshots", ".playwright-mcp", "tsconfig.tsbuildinfo", "next-env.d.ts", "proxy.ts", "AGENTS.md", "CLAUDE.md"]);
cpSync(path.join(main, "web"), path.join(out, "web"), { recursive: true, filter: (src) => !skipWeb.has(path.basename(src)) });
const skipServer = (src) => {
  const rel = path.relative(path.join(main, "server", "src"), src).replaceAll("\\", "/");
  return !(rel === "db" || rel.startsWith("db/") || rel === "index.ts" || rel === "app.ts" || rel.endsWith(".test.ts"));
};
cpSync(path.join(main, "server", "src"), path.join(out, "server", "src"), { recursive: true, filter: skipServer });
cpSync(path.join(root, "overrides"), out, { recursive: true });

const file = (p) => path.join(out, p);
const read = (p) => readFileSync(file(p), "utf8").replaceAll("\r\n", "\n");
const write = (p, text) => writeFileSync(file(p), text);
function patch(p, from, to, all = false) {
  const text = read(p);
  if (!text.includes(from)) throw new Error(`${p}: không thấy đoạn cần sửa:\n${from}`);
  write(p, all ? text.split(from).join(to) : text.replace(from, () => to));
}

// 1. Gọi API: chạy "máy chủ" trong trình duyệt thay cho fetch.
patch("web/src/api/client.ts", 'import type { ApiErrorBody, ErrorCode } from "@contract";', 'import type { ApiErrorBody, ErrorCode } from "@contract";\nimport { mockFetch } from "../../../server/src/browser/server";');
patch("web/src/api/client.ts", "res = await fetch(API + path, {", "res = await mockFetch(API + path, {");
patch("web/src/api/client.ts", '      credentials: "same-origin",\n', "");

// 2. Id cho thứ tạo mới lấy trong "bể" đã dựng sẵn trang (xem web/src/mock/static-params.ts).
const POOLED = '["tin", "buoi", "dot-thu"]';
patch("web/src/lib/actions.ts", "export function uid(prefix: string): string {", `export function uid(prefix: string): string {\n  const pool = (globalThis as { __campushubPool?: (p: string) => string }).__campushubPool;\n  if (pool && ${POOLED}.includes(prefix)) return pool(prefix);`);
patch("server/src/handlers/setup.ts", "    let id = base;\n    for (let i = 2; RESERVED_CLUB_IDS.has(id) || ctx.state.clubs.some((c) => c.id === id); i++) id = `${base}-${i}`;",
  "    void base;\n    const id = (globalThis as unknown as { __campushubPool: (p: string) => string }).__campushubPool(\"clb\");");
patch("server/src/handlers/setup.ts", "let code = `moi-${randomToken(6)}`;\n      while (usedCodes.has(code)) code = `moi-${randomToken(6)}`;",
  "let code = (globalThis as unknown as { __campushubPool: (p: string) => string }).__campushubPool(\"moi\");\n      while (usedCodes.has(code)) code = (globalThis as unknown as { __campushubPool: (p: string) => string }).__campushubPool(\"moi\");");

// 3. Xuất tĩnh: bỏ force-dynamic, thêm danh sách trang có id.
for (const f of ["web/src/app/(school-staff)/school/layout.tsx", "web/src/app/(student)/clubs/new/layout.tsx", "web/src/app/(student)/explore/layout.tsx", "web/src/app/(student)/feed/layout.tsx"]) {
  const text = read(f);
  write(f, text.replace(/^export const dynamic = "force-dynamic";\n/m, ""));
}
const staticParams = (fn) => `\nimport * as demoParams from "@/mock/static-params";\nexport const generateStaticParams = demoParams.${fn};\nexport const dynamicParams = false;\n`;
const addParams = (f, fn) => write(f, read(f) + staticParams(fn));
addParams("web/src/app/(club-admin)/clubs/[clubId]/layout.tsx", "clubIds");
addParams("web/src/app/(club-admin)/clubs/[clubId]/collections/[collectionId]/layout.tsx", "collectionIds");
addParams("web/src/app/(member)/invite/[code]/layout.tsx", "inviteCodes");
addParams("web/src/app/(member)/me/pay/[collectionId]/layout.tsx", "collectionIds");
addParams("web/src/app/(school-staff)/school/clubs/[clubId]/layout.tsx", "clubIds");
addParams("web/src/app/(student)/feed/[postId]/layout.tsx", "postIds");
const plainLayout = (fn) => `import type { ReactNode } from "react";${staticParams(fn)}\nexport default function Layout({ children }: { children: ReactNode }) {\n  return children;\n}\n`;
write("web/src/app/(student)/explore/[clubId]/layout.tsx", plainLayout("clubIds"));
write("web/src/app/(club-admin)/clubs/[clubId]/events/[eventId]/layout.tsx", plainLayout("eventIds"));

// 4. Thay cho proxy.ts, nhãn bản demo và đồng hồ.
write("web/src/app/(landing)/layout.tsx", `import type { ReactNode } from "react";\nimport { LandingRedirect } from "@/mock/LandingRedirect";\n\nexport default function Layout({ children }: { children: ReactNode }) {\n  return <><LandingRedirect />{children}</>;\n}\n`);
patch("web/src/app/layout.tsx", 'import "./globals.css";', 'import { CLOCK_SCRIPT, DemoBadge } from "@/mock/DemoChrome";\nimport "./globals.css";');
patch("web/src/app/layout.tsx", "      <body>", "      <head><script dangerouslySetInnerHTML={{ __html: CLOCK_SCRIPT }} /></head>\n      <body>");
patch("web/src/app/layout.tsx", "          <Toaster />", "          <Toaster />\n          <DemoBadge />");

// 5. Đường dẫn tệp tĩnh có basePath.
patch("web/src/app/(landing)/demo-video.tsx", "src={`/video/${name}.mp4`}", "src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? \"\"}/video/${name}.mp4`}");
patch("web/src/app/(landing)/demo-video.tsx", "poster={`/video/${name}.jpg`}", "poster={`${process.env.NEXT_PUBLIC_BASE_PATH ?? \"\"}/video/${name}.jpg`}");

// 7. Link đầy đủ và trang quay lại sau đăng nhập phải tính cả basePath.
patch("web/src/components/url.ts", "new URL(path, window.location.origin).href", "new URL((process.env.NEXT_PUBLIC_BASE_PATH ?? \"\") + path, window.location.origin).href");
patch("web/src/components/lich/Gate.tsx", "const here = () => window.location.pathname + window.location.search;", "const here = () => (window.location.pathname.replace(process.env.NEXT_PUBLIC_BASE_PATH ?? \"\", \"\") || \"/\") + window.location.search;");

// 8. Tour: usePathname có dấu "/" cuối (trailingSlash) nên so với đường dẫn mong muốn phải bỏ dấu đó, không thì tour tự chuyển trang một lần rồi kẹt.
patch("web/src/components/lich/Tour.tsx", "if (pathname !== desired &&", "if (pathname.replace(/\\/$/, \"\") !== desired &&");
// 9. Đăng xuất: client.clear() chạy sau khi trang đăng nhập đã bắt đầu tải /health và /me nên làm chúng kẹt "Đang tải". Chỉ xóa dữ liệu không còn ai xem.
patch("web/src/components/lich/Gate.tsx", "  client.clear();\n}", "  client.removeQueries({ predicate: (q) => q.getObserversCount() === 0 });\n}");

// 10. Điện thoại: trang ban điều hành là bố cục máy tính (rộng hơn màn), khung chú thích của tour nằm ngoài màn và nút "Tiếp theo" không bấm được,
// chỉ còn màn đen. Màn hẹp thì không mở tour.
patch("web/src/components/lich/Tour.tsx", "if (personId && role && role !== \"member\" && !hasSeenTour(storage(), personId)) startTour();", "if (personId && role && role !== \"member\" && !hasSeenTour(storage(), personId) && (window.visualViewport?.width ?? window.innerWidth) >= 700) startTour();");
patch("web/src/components/lich/Tour.tsx", "if (!open || steps.length === 0) return null;", "if (!open || steps.length === 0 || (window.visualViewport?.width ?? window.innerWidth) < 700) return null;");

// 6. Gói: zod cho mã máy chủ (cài ở source/, nơi cả web/ và server/ cùng tìm thấy).
const serverPkg = JSON.parse(readFileSync(path.join(main, "server", "package.json"), "utf8"));
write("package.json", JSON.stringify({ name: "campushub-demo-source", private: true, dependencies: { zod: serverPkg.dependencies.zod } }, null, 2) + "\n");

console.log("Đã dựng source/ từ", main);
