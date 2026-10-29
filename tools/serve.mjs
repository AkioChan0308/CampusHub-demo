// Chạy thử bản tĩnh giống GitHub Pages: phục vụ thư mục gốc của repo này ở /CampusHub-demo/ (trang lỗi 404.html như Pages).
// Dùng: node tools/serve.mjs [cổng]

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const port = Number(process.argv[2] ?? 8100);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".woff2": "font/woff2", ".txt": "text/plain", ".ico": "image/x-icon" };
const PREFIX = "/CampusHub-demo";

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const send = (file, status = 200) => {
    res.writeHead(status, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  };
  if (url.startsWith(PREFIX + "/") || url === PREFIX) {
    let file = path.join(root, url.slice(PREFIX.length));
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (existsSync(file) && statSync(file).isFile()) return send(file);
  }
  const notFound = path.join(root, "404.html");
  if (existsSync(notFound)) return send(notFound, 404);
  res.writeHead(404).end("404");
}).listen(port, () => console.log(`http://localhost:${port}${PREFIX}/`));
