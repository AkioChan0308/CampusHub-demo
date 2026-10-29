# CampusHub: bản demo

Hai thứ, đều chạy được trên GitHub Pages (không cần máy chủ):

- **`/` (thư mục gốc):** trang xem lần lượt từng bước của luồng chính bằng ảnh và video.
- **`/app/`:** bản dùng thử tương tác. Đăng nhập bằng tài khoản mẫu rồi bấm thử như bản thật: đăng bài, tạo đợt thu, thêm thành viên, điểm danh QR, bàn giao, duyệt tin của nhà trường.

Địa chỉ: `https://<tài khoản>.github.io/CampusHub-demo/` và `https://<tài khoản>.github.io/CampusHub-demo/app/`.

## Bản `/app/` là mock

Mọi thứ chạy trong trình duyệt của người xem:

- Không có máy chủ, không có cơ sở dữ liệu. Dữ liệu mẫu nạp vào `localStorage`, thao tác nào cũng lưu ở đó. Mỗi người xem có một bản riêng, không ai thấy dữ liệu của ai.
- Đồng hồ của trang đi từ 03/10/2026 (ngày dữ liệu mẫu được viết) để việc và hạn hiện đúng.
- Đăng nhập bằng 7 tài khoản mẫu (mật khẩu chung nằm ở trang đăng nhập). Không có đăng nhập Google, không gửi email, không gọi AI thật: trợ lý là bản mẫu tính từ dữ liệu của CLB.
- Mã QR đóng quỹ không chuyển tiền được.
- Thứ người xem tạo mới (CLB, buổi, đợt thu, tin, lời mời) lấy id từ một "bể" id đã dựng sẵn trang: 6 CLB, 8 buổi, 8 đợt thu, 24 tin, 40 lời mời. Hết bể thì dữ liệu vẫn lưu nhưng trang riêng của thứ đó không mở được.
- Xóa dữ liệu trình duyệt hoặc bấm đặt lại dữ liệu mẫu thì về trạng thái ban đầu.

## Dựng lại bản `/app/`

Mã nguồn của bản này **không nằm trong repo công khai này**: nó được đồng bộ từ repo CampusHub chính (riêng tư) vào `source/` (bị `.gitignore` chặn). Repo này chỉ giữ bản đã dựng (`app/`) và các file thay thế bản chạy trong trình duyệt.

```
node tools/sync.mjs [đường dẫn repo CampusHub chính]   # chép web/ và server/src/ vào source/, chép đè overrides/, sửa nhỏ
cd source && npm install && cd web && npm ci            # lần đầu
node tools/build.mjs                                    # next build (xuất tĩnh) rồi chép vào app/
node tools/serve.mjs 8100                               # xem thử giống GitHub Pages: http://localhost:8100/CampusHub-demo/app/
```

- `overrides/`: bản thay thế chạy trong trình duyệt (`password`, `qr`, `sessions`, `google`, "máy chủ" trong `server/src/browser/`, cấu hình Next, danh sách trang có id).
- `tools/sync.mjs`: chỗ nào của repo chính mà đoạn cần sửa không còn thì script dừng và báo, để biết phải cập nhật.
- Dựng bằng Node.js 22 trở lên.

## Không đưa vào repo

Khóa API, mật khẩu, dữ liệu thật, mã nguồn của repo chính. Dữ liệu trong bản demo là dữ liệu mẫu tự bịa (email `example.com`).
