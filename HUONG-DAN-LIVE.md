# Hướng dẫn phát LIVE DJ vào Đảo Ngọc

Màn LED **chính** là sân khấu trong **Vũ Trường** (mở 21:00–02:00, giờ GMT+7). Màn LED ở bãi biển/quầy bar cũng phát cùng luồng.
Game chỉ **xem** luồng: nó đọc một link HLS (`.m3u8`), MP4 hoặc audio Icecast (`.mp3`/`.aac`). Bạn phải dựng luồng ở dịch vụ bên ngoài.

## 1. Đưa link vào game
- **Cố định:** sửa `config.json` → `"streamUrl": "https://.../index.m3u8"`. Giờ diễn nằm ở `showTime` (mặc định thứ 7, 21:00, 180 phút, `tzOffset: 7`). Muốn phát 24/7 thì đặt `"alwaysOn": true`.
- **Tạm thời (để thử):** thêm vào URL `?stream=<link đã URL-encode>`.
  Ví dụ: `https://<tunnel>/?stream=https%3A%2F%2Ftest-streams.mux.dev%2Fx36xhzz%2Fx36xhzz.m3u8`
- **Admin:** `?admin=1` hiện thanh trượt giờ (để thử Vũ Trường đóng/mở) và nút bật LIVE ngay.
- Nếu không có link hoặc luồng lỗi, game tự chuyển sang nhạc WebAudio tự tạo. Người chơi vẫn có nút tắt tiếng 🔊.

## 2. Phát hình + tiếng (HLS)
1. **OBS Studio:** gom nguồn (bàn DJ, camera), rồi vào Cài đặt → Stream.
2. Chọn **một** nơi nhận RTMP để xuất ra HLS:
   - **Cloudflare Stream Live:** tạo Live Input, dán RTMP URL + key vào OBS. Lấy link HLS `.../manifest/video.m3u8`. Có tính phí theo phút xem.
   - **Livepeer Studio:** tạo stream, dùng RTMP ingest. Link phát là `https://livepeercdn.studio/hls/<playbackId>/index.m3u8`.
   - **Tự host:** dùng **SRS** (`docker run -p 1935:1935 -p 8081:8080 ossrs/srs:5`) hoặc **nginx-rtmp** có `hls on;`. Đẩy lên `rtmp://may-chu/live/dj`, link xem là `http://may-chu:8081/live/dj.m3u8`. Máy chủ phải có HTTPS và CORS (`Access-Control-Allow-Origin: *`), vì trang game chạy HTTPS.
3. Thông số gợi ý: 720p30, 2500–3500 kbps, keyframe 2 s, audio AAC 160 kbps 48 kHz.

## 3. Chỉ phát tiếng (Icecast)
Dùng Icecast2 cùng **BUTT** hoặc Mixxx (Live Broadcasting) để đẩy MP3/AAC lên mount `/dj`. Link cho game là `https://radio.ten-mien/dj`; cần HTTPS và CORS. Khi đó màn LED hiện visualizer thay cho video.

## 4. Độ trễ
- HLS thường trễ 6–30 s. Với Cloudflare/Livepeer, bật Low-Latency để còn khoảng 3–8 s.
- Icecast trễ khoảng 2–5 s.
- Đồng hồ đếm ngược "DJ lên sóng lúc 21h tối thứ 7" và phần thưởng xem LIVE chạy theo giờ GMT+7, không phụ thuộc độ trễ.

## 5. Bản quyền âm nhạc (quan trọng)
Phát nhạc công khai ở Việt Nam cần giấy phép tác quyền (**VCPMC** cho tác giả, và **RIAV** hoặc nhà sản xuất cho bản ghi), kể cả khi phát online. Khi chưa có giấy phép, chỉ nên dùng nhạc tự sáng tác, nhạc royalty-free hoặc set DJ đã được cấp quyền. Quà tặng và Xu trong game đều là **ảo**: không quy đổi ra tiền, không có thanh toán thật.

## 6. Kiểm tra nhanh
Link thử đã kiểm chứng: `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`. Mở `/?admin=1&stream=<link>`, kéo giờ tới 22:00, vào Vũ Trường và xem màn LED sân khấu.
