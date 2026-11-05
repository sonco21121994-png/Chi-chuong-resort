# Chí Chương Resort

Game 3D web nghỉ dưỡng / bar / vũ trường.

```bash
npm install
npm start
```

Mở http://localhost:8080

## Đặt lại mật khẩu (email)

Người chơi bấm **Quên mật khẩu?** trên màn đăng nhập, nhập email đã đăng ký (và biệt danh nếu nhớ). Máy chủ gửi liên kết một lần, hết hạn sau 45 phút. Mở liên kết trên cùng trang (`/?reset=...`) để đặt mật khẩu mới.

Không cấu hình mail thì liên kết được **ghi ra log máy chủ** (chỉ dùng khi dev). Trên Render, đặt secret rồi redeploy:

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `RESEND_API_KEY` | một trong hai | API key [Resend](https://resend.com). Ưu tiên nếu có. |
| `SMTP_URL` | một trong hai | URL SMTP, ví dụ `smtp://user:pass@smtp.example.com:587` |
| `MAIL_FROM` | khi gửi thật | Địa chỉ gửi, ví dụ `Đảo Ngọc <noreply@ten-mien-cua-ban>` |
| `PUBLIC_URL` | nên có | URL công khai không có dấu `/` cuối, ví dụ `https://chi-chuong-resort.onrender.com`. Nếu trống, dùng `RENDER_EXTERNAL_URL`. |

`RESEND_API_KEY` được dùng trước `SMTP_URL`. API luôn trả cùng một câu cho email có hoặc không có tài khoản.

## Nhạc Vũ Trường (tạm)

Khi cửa mở và người chơi ở trong (hoặc đang vào gần cửa), trình phát SoundCloud Widget phát mixtape Vina House theo thứ tự Part 1 → Part 2, rồi lặp lại. Nút tắt tiếng của game đưa volume về 0. Bar Beer vẫn dùng nhạc synth có sẵn.

- Part 1: https://soundcloud.com/viet-linh-doan/mixtape-vinahouse-la-bat-diet-special-30h-dj-linhlee-ft-54-dj-28-mc-part-1-15h10
- Part 2: https://soundcloud.com/viet-linh-doan/mixtape-vinahouse-la-bat-diet-special-dj-linhlee-ft-54-dj-28-mc-part-2-15h09

File MP3 trực tiếp của SoundCloud bị chặn CORS trên Safari, nên game nhúng `https://w.soundcloud.com/player/` (bắt đầu bằng Part 1) và điều khiển bằng `https://w.soundcloud.com/player/api.js`. Hết một phần thì widget `load` phần kế tiếp. Iframe được giấu (opacity 0), không `display:none`, để iOS vẫn phát sau lần chạm đầu (vào đảo hoặc joystick).
