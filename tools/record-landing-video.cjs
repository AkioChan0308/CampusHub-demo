// Quay hai video demo cho trang đầu (Hiệu duyệt ngày 05/10/2026), bắt đầu từ trang đăng nhập:
//   - member: điện thoại; đăng nhập, nhận lời mời, quét mã điểm danh, đóng quỹ, xem Của tôi;
//   - club-admin: laptop; đăng nhập, chiếu mã QR điểm danh, đối soát sao kê, duyệt chi, bàn giao.
// Quay bằng chính web đang chạy với dữ liệu mẫu, không dựng cảnh. Giao diện đổi thì chạy lại script này.
//
// Cần: web (npm run dev, cổng 3000) và máy chủ (npm start, chế độ demo, cổng 4000) đang chạy; ffmpeg
// (có trong PATH, hoặc đặt FFMPEG tới file chạy). Script đặt lại dữ liệu mẫu trước mỗi video.
// Chạy trong web/: `node e2e/record-demo-videos.cjs` (cả hai) hoặc `node e2e/record-demo-videos.cjs member`.
//
// Ra: public/video/<tên>.mp4, ảnh đầu video public/video/<tên>.jpg, và src/app/(landing)/video-steps.json (giây bắt đầu từng bước,
// trang đầu dùng để hiện bước đang chạy và cho bấm nhảy tới bước đó).
//
// Trong lúc quay, web được báo là đang chạy bản thật (GET /health trả authMode "google"), để video không có phần chỉ có ở
// bản demo (trang chọn vai, nút đổi vai). Tên tài khoản và mật khẩu dưới đây là của tài khoản mẫu, chỉ dùng trên máy.

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const MAIN_WEB = process.env.MAIN_WEB || path.join(__dirname, "..", "..", "campushub", "web");
const { BASE, launch } = require(path.join(MAIN_WEB, "e2e", "common.cjs"));

const FFMPEG = process.env.FFMPEG || "ffmpeg";
// Bản của repo demo: ghi vào overrides/web/ (sync.mjs chép đè lên mã nguồn), không đụng repo CampusHub chính.
const ROOT = path.join(__dirname, "..", "overrides", "web");
const OUT_DIR = path.join(ROOT, "public", "video");
const STEPS_FILE = path.join(ROOT, "src", "app", "(landing)", "video-steps.json");
const MAIN_STEPS_FILE = path.join(MAIN_WEB, "src", "app", "(landing)", "video-steps.json");
const CLOCK_START = process.env.DEMO_NOW || "2026-10-03T09:00:00+07:00";
const CLUB = "cau-long-san-nha";

/** Tài khoản mẫu của bản demo (web/src/lib/demo-accounts.ts; máy chủ tạo lại mỗi lần đặt lại dữ liệu mẫu):
 *  Lý Hoàng Nam (thành viên mới được mời), Phạm Quốc Bảo (chủ nhiệm). */
const MEMBER = { personId: "a022", username: "hoangnam", password: "CauLong#2026" };
const PRESIDENT = { personId: "a001", username: "quocbao", password: "CauLong#2026" };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Dừng thêm ở màn kết quả của mỗi bước (Hiệu: video chậm hơn khoảng 5 giây, 5 bước mỗi video). */
const HOLD = 800;
/** Video ban điều hành dừng lâu hơn một chút: màn chiếu QR làm mới danh sách mỗi 3 giây nên độ dài dao động nhiều hơn. */
const BOARD_HOLD = 1100;

/** Gọi API bằng phiên của trang (cookie của context đó). */
const api = (page, method, p, body) => page.evaluate(async ([method, p, body]) => {
  const r = await fetch("/api/v1" + p, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${JSON.stringify(data)}`);
  return data;
}, [method, p, body]);

/**
 * Con trỏ vẽ thêm trên trang, vì ảnh chụp màn hình không có con trỏ chuột. Laptop: mũi tên, bấm thì có vòng nhỏ.
 * Điện thoại: chấm tròn hiện lúc chạm. Chỉ có trong video, không phải giao diện CampusHub.
 */
const pointerScript = (touch) => `(() => {
  const css = "nextjs-portal{display:none!important}";
  const setup = () => {
    if (document.getElementById("__vid-ptr")) return;
    const st = document.createElement("style"); st.textContent = css; document.documentElement.appendChild(st);
    const c = document.createElement("div"); c.id = "__vid-ptr";
    c.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;" + (${touch}
      ? "width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;background:rgba(29,71,163,.22);border:2px solid rgba(29,71,163,.55);opacity:0;transition:opacity 160ms"
      : "width:24px;height:24px");
    if (!${touch}) c.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 2.5l15 9.2-6.9 1.3-3.6 6.3z" fill="#161A22" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    let p = [-60, -60];
    try { p = JSON.parse(sessionStorage.getItem("__vid-ptr") || "[-60,-60]"); } catch {}
    const put = (x, y) => { c.style.transform = "translate(" + x + "px," + y + "px)"; };
    put(p[0], p[1]);
    addEventListener("mousemove", (e) => { put(e.clientX, e.clientY); try { sessionStorage.setItem("__vid-ptr", JSON.stringify([e.clientX, e.clientY])); } catch {} }, true);
    addEventListener("mousedown", (e) => {
      if (${touch}) { c.style.opacity = "1"; return; }
      const r = document.createElement("div");
      r.style.cssText = "position:fixed;z-index:2147483646;pointer-events:none;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:2px solid rgba(29,71,163,.6);left:" + e.clientX + "px;top:" + e.clientY + "px;transition:transform 300ms ease-out,opacity 300ms ease-out";
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.6)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 350);
    }, true);
    addEventListener("mouseup", () => { if (${touch}) setTimeout(() => { c.style.opacity = "0"; }, 220); }, true);
  };
  if (document.documentElement) setup(); else addEventListener("DOMContentLoaded", setup);
})();`;

/** Ghi màn hình bằng Chrome (Page.startScreencast): mỗi lần trang đổi hình là một ảnh kèm giờ chụp. */
async function startRecording(page, maxWidth, maxHeight) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", (f) => {
    frames.push({ t: f.metadata.timestamp, data: f.data });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth, maxHeight, everyNthFrame: 1 });
  const marks = {};
  return {
    mark: (key) => { marks[key] = Date.now() / 1000; },
    stop: async () => {
      await cdp.send("Page.stopScreencast");
      return { frames, marks, end: Date.now() / 1000 };
    },
  };
}

/** Ghép ảnh thành MP4 (H.264, 30 hình/giây) và ảnh đầu video; trả về số giây bắt đầu từng bước. */
function encode(name, rec, outWidth) {
  const { frames, marks, end } = rec;
  if (frames.length < 2) throw new Error(`${name}: không quay được hình nào`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `campushub-${name}-`));
  const t0 = frames[0].t;
  const lines = ["ffconcat version 1.0"];
  frames.forEach((f, i) => {
    const file = `f${String(i).padStart(6, "0")}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(f.data, "base64"));
    const next = i + 1 < frames.length ? frames[i + 1].t : end;
    lines.push(`file '${file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file 'f${String(frames.length - 1).padStart(6, "0")}.jpg'`);
  fs.writeFileSync(path.join(dir, "list.txt"), lines.join("\n"));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const mp4 = path.join(OUT_DIR, `${name}.mp4`);
  execFileSync(FFMPEG, [
    "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"),
    "-vf", `fps=30,scale=${outWidth}:-2:flags=lanczos,format=yuv420p`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-movflags", "+faststart", "-an", mp4,
  ]);
  // Ảnh đầu video = hình đầu tiên, để lúc video bắt đầu chạy không bị đổi hình.
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", mp4, "-frames:v", "1", "-q:v", "3", path.join(OUT_DIR, `${name}.jpg`)]);
  fs.rmSync(dir, { recursive: true, force: true });
  const steps = Object.fromEntries(Object.entries(marks).map(([k, t]) => [k, Math.max(0, +(t - t0).toFixed(2))]));
  const kb = Math.round(fs.statSync(mp4).size / 1024);
  console.log(`${name}: ${(end - t0).toFixed(1)} giây, ${frames.length} ảnh, ${kb} KB`);
  return { duration: +(end - t0).toFixed(2), steps };
}

/** Đặt lại dữ liệu mẫu; máy chủ tạo lại các tài khoản mẫu (ngoài video). */
async function prepare(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await api(page, "POST", "/demo/reset");
  await ctx.close();
}

/** Một trình duyệt phụ (không quay) đăng nhập bằng vai có sẵn, để làm phần của người khác trong video. */
async function helper(browser, personId) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await api(page, "POST", "/auth/dev-login", { personId });
  return { page, close: () => ctx.close() };
}

/** Trang quay: báo web đang chạy bản thật và vẽ con trỏ. */
async function recordingPage(browser, opts, touch) {
  const ctx = await browser.newContext({ ...opts, locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh" });
  await ctx.route("**/api/v1/health", (r) => r.fulfill({ json: { ok: true, authMode: "google", googleLogin: true } }));
  await ctx.addInitScript((start) => {
    const D = Date, offset = start - D.now();
    class ShiftedDate extends D {
      constructor(...args) { if (args.length === 0) super(D.now() + offset); else super(...args); }
      static now() { return D.now() + offset; }
    }
    window.Date = ShiftedDate;
  }, Date.parse(CLOCK_START));
  await ctx.addInitScript(pointerScript(touch));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("LỖI TRÊN TRANG:", e.message));
  return page;
}

/** Cuộn tới chỗ, đưa con trỏ tới giữa phần tử rồi bấm, chậm như người thật. */
function actor(page, touch) {
  async function point(locator) {
    await locator.waitFor({ state: "visible", timeout: 15000 });
    const inView = await locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 72 && r.bottom <= innerHeight - 72;
    });
    if (!inView) {
      await locator.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
      await wait(650);
    }
    const b = await locator.boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y, { steps: touch ? 1 : 22 });
    await wait(touch ? 120 : 180);
  }
  async function tap(locator) {
    await point(locator);
    await page.mouse.down();
    await wait(90);
    await page.mouse.up();
  }
  async function type(locator, text) {
    await tap(locator);
    await wait(150);
    await page.keyboard.type(text, { delay: 55 });
  }
  async function scrollBy(dy) {
    await page.evaluate((dy) => scrollBy({ top: dy, behavior: "smooth" }), dy);
    await wait(700);
  }
  return { point, tap, type, scrollBy };
}

async function login(page, a, who) {
  await a.type(page.getByLabel("Tên tài khoản hoặc email"), who.username);
  await wait(200);
  await a.type(page.getByLabel("Mật khẩu", { exact: true }), who.password);
  await wait(350);
  await a.tap(page.getByRole("button", { name: "Đăng nhập", exact: true }));
}

async function recordMember(browser) {
  await prepare(browser);
  const page = await recordingPage(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }, true);
  const a = actor(page, true);
  await page.goto(`${BASE}/login?next=${encodeURIComponent("/invite/moi-a022")}`);
  await page.getByLabel("Tên tài khoản hoặc email").waitFor();
  await wait(600);
  const rec = await startRecording(page, 780, 1688);

  rec.mark("login");
  await wait(900 + HOLD);
  await login(page, a, MEMBER);

  await page.waitForURL("**/invite/moi-a022");
  rec.mark("invite");
  await page.getByRole("button", { name: "Tham gia CLB" }).waitFor();
  await wait(1400);
  await a.tap(page.locator("#consent-keep"));
  await wait(350);
  await a.tap(page.locator("#consent-age"));
  await wait(450);
  await a.tap(page.getByRole("button", { name: "Tham gia CLB" }));
  await page.waitForURL("**/me");
  await page.getByRole("heading", { name: "Dữ liệu của tôi" }).waitFor();
  await wait(1300 + HOLD);

  // Quét mã ở buổi sinh hoạt: chủ nhiệm (trình duyệt phụ) mở điểm danh, điện thoại mở link trong mã QR.
  const board = await helper(browser, PRESIDENT.personId);
  await api(board.page, "POST", `/clubs/${CLUB}/events/tuan-5/open`);
  const qr = await api(board.page, "GET", `/clubs/${CLUB}/events/tuan-5/qr`);
  rec.mark("check-in");
  await page.goto(BASE + qr.checkinPath);
  await page.waitForURL("**/me/attendance**", { timeout: 15000 });
  await page.getByText("Đã điểm danh").first().waitFor();
  await wait(2200 + HOLD);

  rec.mark("pay");
  await a.tap(page.locator(".l-tabs a", { hasText: "Quỹ" }));
  await page.waitForURL("**/me/pay/**");
  await page.locator(".l-qr svg").waitFor();
  await wait(1600);
  await a.tap(page.getByRole("button", { name: "Mình đã chuyển khoản" }));
  await page.getByText(/chờ thủ quỹ xác nhận/i).first().waitFor();
  await wait(1800 + HOLD);

  rec.mark("me");
  await a.tap(page.locator(".l-tabs a", { hasText: "Của tôi" }));
  await page.waitForURL("**/me");
  await page.getByRole("heading", { name: "Dữ liệu của tôi" }).waitFor();
  await wait(1200);
  await a.scrollBy(320);
  await wait(1600 + HOLD);

  const result = await rec.stop();
  await board.close();
  await page.context().close();
  return encode("member", result, 600);
}

async function recordBoard(browser) {
  await prepare(browser);
  const page = await recordingPage(browser, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 }, false);
  const a = actor(page, false);
  await page.goto(BASE + "/login");
  await page.getByLabel("Tên tài khoản hoặc email").waitFor();
  await page.mouse.move(900, 620);
  await wait(600);
  const rec = await startRecording(page, 1920, 1200);
  const nav = (label) => page.getByRole("navigation", { name: "Menu ban điều hành" }).locator("a", { hasText: label }).first();
  // Menu gom các mục tiền vào nhóm "Quỹ" (thu gọn sẵn): mở nhóm nếu mục cần bấm chưa hiện.
  const openFunds = async (label) => {
    if (await nav(label).isVisible()) return;
    await a.tap(page.getByRole("navigation", { name: "Menu ban điều hành" }).getByRole("button", { name: /Quỹ/ }));
    await nav(label).waitFor();
  };

  rec.mark("login");
  await wait(500 + BOARD_HOLD);
  await login(page, a, PRESIDENT);
  await page.waitForURL(`**/clubs/${CLUB}`);
  await page.getByRole("heading", { name: "Cần bạn xử lý" }).waitFor();
  await wait(1100);

  rec.mark("check-in");
  await a.tap(page.getByRole("link", { name: "Mở QR điểm danh" }));
  await page.getByRole("heading", { name: "Chưa mở điểm danh" }).waitFor();
  await wait(450);
  await a.tap(page.getByRole("button", { name: "Bắt đầu điểm danh" }));
  await page.locator(".l-qr-svg svg").waitFor();
  // Hai thành viên quét mã bằng điện thoại của mình (trình duyệt phụ, ngoài video): màn chiếu thấy tên hiện lên.
  const boardHelper = await helper(browser, PRESIDENT.personId);
  for (const [personId, device] of [["a017", "video-dt-1"], ["a004", "video-dt-2"]]) {
    await wait(700);
    const qr = await api(boardHelper.page, "GET", `/clubs/${CLUB}/events/tuan-5/qr`);
    const member = await helper(browser, personId);
    await api(member.page, "POST", "/checkin", { eventId: "tuan-5", token: qr.token, deviceId: device });
    await member.close();
  }
  await boardHelper.close();
  await page.waitForFunction(() => document.querySelector(".l-att-list")?.textContent?.includes("Phan Thanh Tâm"), null, { timeout: 10000 });
  await wait(1200 + BOARD_HOLD);

  // Màn chiếu QR không có menu: thoát chế độ chiếu rồi mới sang Đối soát.
  await a.tap(page.getByRole("link", { name: "Thoát chế độ chiếu" }));
  await page.waitForURL(`**/clubs/${CLUB}`);
  rec.mark("reconcile");
  await openFunds("Đối soát sao kê");
  await a.tap(nav("Đối soát sao kê"));
  await page.waitForURL("**/reconcile");
  await page.getByRole("heading", { name: /Cần gán tay/ }).waitFor();
  await wait(800);
  // Thủ quỹ tải file sao kê tự xuất từ ngân hàng (ở đây là file mẫu): con trỏ tới nút tải, file đưa thẳng vào ô chọn file.
  const csv = path.join(os.tmpdir(), "sao-ke-mau-video.csv");
  fs.writeFileSync(csv, "﻿Ngày,Số tiền,Người chuyển,Nội dung\n02/10/2026 09:15:07,\"100,000.00\",LE NGOC ANH,QFALL26 A037\n02/10/2026 11:40:51,\"100,000.00\",AI DO,chuyen tien\n");
  const upload = page.locator("label, button", { hasText: /Tải (file )?sao kê/ }).first();
  if (await upload.count()) await a.point(upload);
  await page.setInputFiles("input[type=file]", csv);
  await page.getByText("sao-ke-mau-video.csv").first().waitFor();
  await wait(1700 + BOARD_HOLD);

  rec.mark("expenses");
  await openFunds("Đề xuất và duyệt chi");
  await a.tap(nav("Đề xuất và duyệt chi"));
  await page.waitForURL("**/expenses");
  await a.tap(page.locator("button.l-pick", { hasText: "Thuê sân tuần 6–7" }));
  await wait(700);
  await a.tap(page.getByRole("button", { name: "Duyệt", exact: true }));
  await page.getByText("Đã duyệt · chờ chi").first().waitFor();
  await wait(1300 + BOARD_HOLD);

  rec.mark("handover");
  await a.tap(nav("Bàn giao"));
  await page.waitForURL("**/handover");
  await page.getByRole("heading", { name: "Đổi tài khoản nhận quỹ" }).waitFor();
  await wait(1200);
  await page.locator("#handover-receiver").selectOption("a006");
  await wait(500);
  await a.type(page.locator("#handover-bank"), "[Ngân hàng thử]");
  await a.type(page.locator("#handover-account-number"), "0123456789");
  await wait(400);
  await a.tap(page.getByRole("button", { name: "Lưu và sang bước 5" }));
  await page.getByRole("heading", { name: "Chuyển quyền quản trị" }).waitFor();
  await wait(1100);
  for (const service of ["Fanpage Facebook", "Google Drive", "Email của CLB", "Tài khoản ngân hàng nhận quỹ"]) {
    await a.tap(page.getByRole("button", { name: `Ghi đã chuyển ${service}` }));
    await wait(650);
  }
  await a.tap(page.getByRole("button", { name: "Tiếp tục" }));
  await page.getByRole("heading", { name: /Ban mới xác nhận/ }).waitFor();
  await wait(1600);
  // Ban mới nhận bàn giao: video chuyển sang máy của chủ nhiệm mới (đăng nhập ngoài khung hình). Chủ nhiệm cũ mất quyền quản trị
  // ngay khi ban mới xác nhận nên không xem được biên bản trên máy của mình nữa.
  await api(page, "POST", "/auth/dev-login", { personId: "a017" });
  await page.goto(`${BASE}/clubs/${CLUB}/handover`);
  await page.getByRole("heading", { name: /Ban mới xác nhận/ }).waitFor({ timeout: 20000 });
  await wait(1500);
  await a.tap(page.getByRole("button", { name: "Xác nhận đã nhận bàn giao" }));
  await page.locator("#typed-confirm").waitFor();
  await wait(500);
  await a.type(page.locator("#typed-confirm"), "BAN GIAO");
  await wait(700);
  await a.tap(page.getByRole("button", { name: /^Đổi ban và xác nhận/ }));
  // exact: tiêu đề "Biên bản bàn giao gồm" ở ô bên phải có sẵn cả lúc trang còn là khung xương, không phải dấu hiệu bước 7 đã mở.
  await page.getByRole("heading", { name: "Biên bản bàn giao", exact: true }).waitFor({ timeout: 20000 });
  const exportButton = page.getByRole("button", { name: /Xuất biên bản/ }).first();
  await exportButton.waitFor({ timeout: 20000 });
  await wait(1800);
  await a.point(exportButton);
  await wait(2400 + BOARD_HOLD);

  const result = await rec.stop();
  await page.context().close();
  return encode("club-admin", result, 1600);
}

(async () => {
  const only = process.argv[2];
  const browser = await launch();
  const baseFile = fs.existsSync(STEPS_FILE) ? STEPS_FILE : MAIN_STEPS_FILE;
  const steps = fs.existsSync(baseFile) ? JSON.parse(fs.readFileSync(baseFile, "utf8")) : {};
  fs.mkdirSync(path.dirname(STEPS_FILE), { recursive: true });
  try {
    if (!only || only === "member") steps["member"] = await recordMember(browser);
    if (!only || only === "club-admin") steps["club-admin"] = await recordBoard(browser);
    fs.writeFileSync(STEPS_FILE, JSON.stringify(steps, null, 2) + "\n");
    console.log("Đã ghi", path.relative(ROOT, STEPS_FILE));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
