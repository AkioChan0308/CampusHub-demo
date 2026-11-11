"""Ghép khung hình của nhiều tab thành một video: vẽ thanh tab ở trên (tab đang xem sáng, các tab khác tối) rồi ghi danh sách ảnh cho ffmpeg.
Dùng bởi tools/record-landing-video.cjs. Chạy: python compose_tabs.py <thư mục có timeline.json>
Vào: timeline.json {frames:[{file,t,active,tabs}], end, tabH, tabs:[{name,role,initials}]}. `tabs` của từng khung là danh sách số thứ tự
(trong `tabs` của timeline) các tab đang hiện trên thanh, theo thứ tự vẽ; `active` là số thứ tự của tab đang xem. Ra: c<số>.jpg và list.txt (ffconcat)."""
import io
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

d = sys.argv[1]
tl = json.load(io.open(os.path.join(d, "timeline.json"), encoding="utf-8"))
tab_h = tl["tabH"]


def font(bold, size):
    for p in (r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


cache = {}
fonts = {}


def fonts_for(k):
    """Cỡ chữ theo hệ số co k của tab (k = 1 khi tab rộng 600)."""
    key = round(k, 2)
    if key not in fonts:
        fonts[key] = (font(True, max(10, round(27 * k))), font(False, max(10, round(25 * k))), font(True, max(8, round(19 * k))))
    return fonts[key]


def bar(width, active, tabs):
    key = (active, tuple(tabs))
    if key in cache:
        return cache[key]
    im = Image.new("RGB", (width, tab_h), (27, 32, 48))
    dr = ImageDraw.Draw(im)
    gap, margin = 8, 24
    # Mỗi tab rộng tối đa 600; nhiều tab thì co lại cho vừa chiều rộng khung, chữ co theo.
    w = min(600, (width - 2 * margin - gap * (len(tabs) - 1)) // len(tabs))
    k = w / 600
    f_name, f_role, f_ini = fonts_for(k)
    x = margin
    for i in tabs:
        t = tl["tabs"][i]
        on = i == active
        top = 20
        dr.rounded_rectangle((x, top, x + w, tab_h + 20), radius=18, fill=(245, 247, 249) if on else (42, 49, 68))
        cy = top + (tab_h - top) // 2
        r = round(21 * k)
        dr.ellipse((x + round(39 * k) - r, cy - r, x + round(39 * k) + r, cy + r), fill=(29, 71, 163))
        iw = dr.textlength(t["initials"], font=f_ini)
        dr.text((x + round(39 * k) - iw / 2, cy - round(12 * k)), t["initials"], font=f_ini, fill=(255, 255, 255))
        tx = x + round(76 * k)
        dr.text((tx, cy - round(18 * k)), t["name"], font=f_name, fill=(22, 24, 29) if on else (214, 219, 227))
        nw = dr.textlength(t["name"], font=f_name)
        dr.text((tx + nw + round(12 * k), cy - round(16 * k)), "· " + t["role"], font=f_role, fill=(93, 101, 112) if on else (150, 158, 171))
        x += w + gap
    cache[key] = im
    return im


lines = ["ffconcat version 1.0"]
frames = tl["frames"]
for i, f in enumerate(frames):
    fr = Image.open(os.path.join(d, f["file"])).convert("RGB")
    w, h = fr.size
    out = Image.new("RGB", (w, h + tab_h), (27, 32, 48))
    out.paste(bar(w, f["active"], f["tabs"]), (0, 0))
    out.paste(fr, (0, tab_h))
    name = f"c{i:06d}.jpg"
    out.save(os.path.join(d, name), quality=92)
    nxt = frames[i + 1]["t"] if i + 1 < len(frames) else tl["end"]
    lines += [f"file '{name}'", f"duration {max(0.001, nxt - f['t']):.4f}"]
lines.append(f"file 'c{len(frames) - 1:06d}.jpg'")
io.open(os.path.join(d, "list.txt"), "w", encoding="utf-8", newline="\n").write("\n".join(lines))
print(len(frames), "khung")
