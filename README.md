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
