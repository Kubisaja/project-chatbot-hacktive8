# Requirements Document

## Introduction

HealthyFlow Chatbot adalah Personal Productivity Assistant berbasis AI yang berfokus pada domain kesehatan ringan dan produktivitas. Sistem ini dibangun menggunakan Node.js + Express di backend, Gemini API sebagai engine AI, dan antarmuka web sederhana (HTML/CSS/JS) di frontend. Chatbot mampu memberikan tips fokus, istirahat, olahraga ringan, dan manajemen waktu dengan gaya bahasa santai dan ramah, serta memiliki memori percakapan sederhana dalam satu sesi.

## Glossary

- **Server**: Aplikasi backend Express yang berjalan di `server.js` pada `localhost:3000`
- **Frontend**: Antarmuka web yang terdiri dari `index.html`, `app.js`, dan `style.css` di folder `public/`
- **Gemini_API**: Layanan Google Generative AI yang diakses melalui library `@google/generative-ai`
- **Chat_Endpoint**: Endpoint POST `/chat` pada Server yang menerima pesan dari Frontend
- **Session_Memory**: Penyimpanan riwayat percakapan sementara dalam satu sesi server
- **AI_Response**: Teks balasan yang dihasilkan oleh Gemini_API berdasarkan prompt dan konteks percakapan
- **System_Prompt**: Instruksi awal yang mendefinisikan peran, gaya bahasa, dan domain chatbot

## Requirements

### Requirement 1: Koneksi ke Gemini API

**User Story:** Sebagai developer, saya ingin server dapat terhubung ke Gemini API dengan benar, agar chatbot dapat menghasilkan respons AI yang relevan.

#### Acceptance Criteria

1. THE Server SHALL memuat `GEMINI_API_KEY` dari file `.env` menggunakan `dotenv` sebelum menginisialisasi koneksi ke Gemini_API.
2. THE Server SHALL menginisialisasi instance `GoogleGenerativeAI` menggunakan `GEMINI_API_KEY` yang telah dimuat.
3. THE Server SHALL menggunakan model `gemini-1.5-flash` saat membuat instance model Gemini_API.
4. IF `GEMINI_API_KEY` tidak ditemukan atau kosong, THEN THE Server SHALL mencetak pesan error yang jelas ke console dan menghentikan proses startup.

---

### Requirement 2: Endpoint Chat Backend

**User Story:** Sebagai pengguna, saya ingin server menerima pesan saya dan mengembalikan respons AI, agar saya bisa berkomunikasi dengan chatbot.

#### Acceptance Criteria

1. THE Chat_Endpoint SHALL menerima request POST dengan body JSON yang mengandung field `message` bertipe string.
2. WHEN request diterima di Chat_Endpoint, THE Server SHALL meneruskan pesan beserta System_Prompt dan riwayat Session_Memory ke Gemini_API.
3. WHEN Gemini_API berhasil menghasilkan respons, THE Chat_Endpoint SHALL mengembalikan response JSON dengan field `reply` berisi teks AI_Response.
4. IF field `message` pada request body kosong atau tidak ada, THEN THE Chat_Endpoint SHALL mengembalikan HTTP status 400 dengan pesan error yang jelas.
5. IF Gemini_API mengembalikan error, THEN THE Chat_Endpoint SHALL mengembalikan HTTP status 500 dengan field `reply` berisi pesan error yang informatif dalam bahasa Indonesia.

---

### Requirement 3: System Prompt dan Persona Chatbot

**User Story:** Sebagai pengguna, saya ingin chatbot memiliki kepribadian yang konsisten sebagai asisten kesehatan dan produktivitas, agar pengalaman percakapan terasa personal dan relevan.

#### Acceptance Criteria

1. THE Server SHALL menyertakan System_Prompt pada setiap request ke Gemini_API yang mendefinisikan chatbot sebagai "HealthyFlow AI" dengan gaya bahasa santai dan ramah.
2. THE System_Prompt SHALL membatasi domain respons chatbot pada topik: tips fokus belajar, olahraga ringan, manajemen istirahat, dan manajemen waktu.
3. THE System_Prompt SHALL menginstruksikan chatbot untuk memberikan saran yang praktis, singkat, dan dapat langsung diterapkan.
4. WHEN pengguna menanyakan topik di luar domain kesehatan dan produktivitas, THE Server SHALL menginstruksikan chatbot melalui System_Prompt untuk mengarahkan kembali percakapan ke domain yang relevan.

---

### Requirement 4: Session Memory (Memori Percakapan)

**User Story:** Sebagai pengguna, saya ingin chatbot mengingat konteks percakapan sebelumnya dalam satu sesi, agar respons terasa lebih natural dan tidak mengulang pertanyaan yang sama.

#### Acceptance Criteria

1. THE Server SHALL menyimpan riwayat percakapan dalam Session_Memory selama satu sesi server aktif.
2. WHEN pesan baru diterima, THE Server SHALL menyertakan maksimal 10 pesan terakhir dari Session_Memory sebagai konteks pada request ke Gemini_API.
3. WHEN AI_Response berhasil diterima, THE Server SHALL menambahkan pasangan pesan user dan AI_Response ke Session_Memory.
4. THE Session_Memory SHALL menyimpan pesan dalam format yang membedakan antara pesan "User" dan pesan "AI".

---

### Requirement 5: Pengiriman Pesan dari Frontend

**User Story:** Sebagai pengguna, saya ingin bisa mengetik pesan dan mengirimkannya ke chatbot melalui antarmuka web, agar saya dapat berinteraksi dengan mudah.

#### Acceptance Criteria

1. WHEN pengguna mengklik tombol "Kirim" atau menekan tombol Enter, THE Frontend SHALL mengirim pesan ke Chat_Endpoint menggunakan HTTP POST dengan header `Content-Type: application/json`.
2. WHEN pesan berhasil dikirim, THE Frontend SHALL menampilkan pesan pengguna di chat box sebelum menunggu respons dari server.
3. WHILE menunggu respons dari server, THE Frontend SHALL menampilkan indikator loading (misalnya teks "HealthyFlow sedang mengetik...") di chat box.
4. IF input pengguna kosong, THEN THE Frontend SHALL mencegah pengiriman pesan dan tidak melakukan request ke server.

---

### Requirement 6: Tampilan Respons AI di Frontend

**User Story:** Sebagai pengguna, saya ingin melihat respons AI ditampilkan dengan jelas di antarmuka chat, agar saya dapat membaca balasan dengan nyaman.

#### Acceptance Criteria

1. WHEN AI_Response diterima dari server, THE Frontend SHALL menampilkan respons tersebut di chat box dengan label yang membedakannya dari pesan pengguna.
2. WHEN pesan baru ditampilkan, THE Frontend SHALL otomatis men-scroll chat box ke pesan terbaru.
3. IF server mengembalikan error (HTTP 4xx atau 5xx), THEN THE Frontend SHALL menampilkan pesan error yang ramah kepada pengguna di chat box.
4. THE Frontend SHALL membersihkan input field setelah pesan berhasil dikirim.

---

### Requirement 7: Error Handling yang Informatif

**User Story:** Sebagai pengguna, saya ingin mendapatkan pesan yang jelas ketika terjadi kesalahan, agar saya tahu apa yang terjadi dan bisa mengambil tindakan.

#### Acceptance Criteria

1. IF koneksi ke server gagal dari sisi Frontend, THEN THE Frontend SHALL menampilkan pesan "Tidak dapat terhubung ke server. Periksa koneksi Anda." di chat box.
2. IF Gemini_API mengembalikan error karena API key tidak valid, THEN THE Server SHALL mencatat detail error ke console dan mengembalikan pesan "Konfigurasi AI bermasalah, hubungi administrator." kepada Frontend.
3. IF Gemini_API mengembalikan error karena rate limit, THEN THE Server SHALL mengembalikan pesan "Terlalu banyak permintaan, coba lagi dalam beberapa saat." kepada Frontend.
4. THE Server SHALL mencatat semua error dari Gemini_API ke console dengan detail yang cukup untuk debugging.
