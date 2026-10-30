"""Ghép khung hình của hai tab thành một video: vẽ thanh tab ở trên (tab đang xem sáng, tab kia tối) rồi ghi danh sách ảnh cho ffmpeg.
Dùng bởi tools/record-landing-video.cjs. Chạy: python compose_tabs.py <thư mục có timeline.json>
Vào: timeline.json {frames:[{file,t,active,tabs}], end, tabH, tabs:[{name,role,initials}]}. Ra: c<số>.jpg và list.txt (ffconcat)."""
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


F_NAME, F_ROLE, F_INI = font(True, 27), font(False, 25), font(True, 19)
cache = {}


def bar(width, active, tabs):
    key = (active, tabs)
    if key in cache:
        return cache[key]
    im = Image.new("RGB", (width, tab_h), (27, 32, 48))
    dr = ImageDraw.Draw(im)
    x = 24
    for i in range(tabs):
        t = tl["tabs"][i]
        on = i == active
        w, top = 600, 20
        dr.rounded_rectangle((x, top, x + w, tab_h + 20), radius=18, fill=(245, 247, 249) if on else (42, 49, 68))
        cy = top + (tab_h - top) // 2
        dr.ellipse((x + 18, cy - 21, x + 60, cy + 21), fill=(29, 71, 163))
        iw = dr.textlength(t["initials"], font=F_INI)
        dr.text((x + 39 - iw / 2, cy - 12), t["initials"], font=F_INI, fill=(255, 255, 255))
        dr.text((x + 76, cy - 18), t["name"], font=F_NAME, fill=(22, 24, 29) if on else (214, 219, 227))
        nw = dr.textlength(t["name"], font=F_NAME)
        dr.text((x + 76 + nw + 12, cy - 16), "· " + t["role"], font=F_ROLE, fill=(93, 101, 112) if on else (150, 158, 171))
        x += w + 8
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
