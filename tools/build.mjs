// Dựng bản tương tác: node tools/sync.mjs, rồi node tools/build.mjs. Kết quả nằm ở app/ (đưa vào git để GitHub Pages phục vụ).

import { execSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const web = path.join(root, "source", "web");
if (!existsSync(web)) throw new Error("Chưa có source/. Chạy node tools/sync.mjs trước.");

execSync("npx next build", { cwd: web, stdio: "inherit" });
rmSync(path.join(root, "app"), { recursive: true, force: true });
cpSync(path.join(web, "out"), path.join(root, "app"), { recursive: true });

// Next xuất file tải trước từng đoạn trang (__next.<đoạn>/<tên>.txt) thành thư mục khi dựng trên Windows, nhưng trình duyệt hỏi tên
// phẳng (__next.<đoạn>.<tên>.txt). Chép thêm bản phẳng để không có yêu cầu nào trả 404.
function flatten(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("__next.")) {
      const copy = (sub, prefix) => {
        for (const f of readdirSync(sub, { withFileTypes: true })) {
          if (f.isDirectory()) copy(path.join(sub, f.name), `${prefix}.${f.name}`);
          else cpSync(path.join(sub, f.name), path.join(dir, `${prefix}.${f.name}`));
        }
      };
      copy(full, entry.name);
    } else flatten(full);
  }
}
flatten(path.join(root, "app"));
console.log("Đã chép bản dựng vào app/");
