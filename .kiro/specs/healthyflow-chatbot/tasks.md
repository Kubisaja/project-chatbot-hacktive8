# Implementation Plan: HealthyFlow Chatbot

## Overview

Memperbaiki implementasi yang sudah ada agar memenuhi semua acceptance criteria di requirements.md. Mencakup perbaikan `server.js` (validasi input, model yang benar, session memory, error handling), perbaikan `public/app.js` dan `public/index.html` (loading indicator, Enter key, error handling), serta penambahan `public/style.css` untuk styling loading/error. Testing menggunakan fast-check untuk property-based tests dan unit tests.

## Tasks

- [x] 1. Setup testing framework
  - Install `fast-check` dan `jest` (atau `vitest`) sebagai devDependencies
  - Buat file konfigurasi test (misalnya `vitest.config.js` atau `jest.config.js`)
  - Buat folder `tests/` dengan file `server.test.js` dan `frontend.test.js`
  - _Requirements: (semua requirement — fondasi testing)_


- [x] 2. Perbaiki konfigurasi dan inisialisasi server (`server.js`)
  - [x] 2.1 Tambahkan validasi `GEMINI_API_KEY` saat startup
    - Cek `process.env.GEMINI_API_KEY` setelah `dotenv.config()`; jika kosong/tidak ada, cetak error ke console dan panggil `process.exit(1)`
    - _Requirements: 1.1, 1.4_
  - [x] 2.2 Ganti model dari `gemini-pro` ke `gemini-1.5-flash`
    - Ubah string model di `genAI.getGenerativeModel({ model: "gemini-1.5-flash" })`
    - Export konstanta `modelName` untuk keperluan testing
    - _Requirements: 1.2, 1.3_
  - [ ]* 2.3 Tulis unit test untuk konfigurasi server
    - Test bahwa `modelName === 'gemini-1.5-flash'`
    - Test bahwa server exit jika `GEMINI_API_KEY` tidak ada
    - _Requirements: 1.3, 1.4_

- [x] 3. Perbaiki System Prompt dan endpoint `/chat` di `server.js`
  - [x] 3.1 Definisikan `SYSTEM_PROMPT` sebagai konstanta dengan konten lengkap sesuai design
    - Sertakan identitas "HealthyFlow AI", domain (fokus belajar, olahraga ringan, manajemen istirahat, manajemen waktu), instruksi gaya bahasa santai, dan instruksi redirect topik di luar domain
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 3.2 Tambahkan validasi input di endpoint `POST /chat`
    - Jika `message` tidak ada, null, string kosong, atau hanya whitespace → return HTTP 400 `{ "error": "Pesan tidak boleh kosong." }`
    - _Requirements: 2.1, 2.4_
  - [x] 3.3 Susun prompt dengan `SYSTEM_PROMPT` + `Session_Memory` + pesan user sesuai format di design
    - Format: `{SYSTEM_PROMPT}\n\nRiwayat percakapan:\n{memory.slice(-10).join('\n')}\n\nPesan terbaru dari pengguna:\n{userMessage}`
    - _Requirements: 2.2, 3.1, 4.2_
  - [ ]* 3.4 Tulis property test untuk Property 6: Empty/whitespace input returns HTTP 400
    - **Property 6: Empty or whitespace input returns HTTP 400**
    - **Validates: Requirements 2.4**
    - _Tag: Feature: healthyflow-chatbot, Property 6_
  - [ ]* 3.5 Tulis property test untuk Property 2: System Prompt always included in Gemini request
    - **Property 2: System Prompt always included in Gemini request**
    - **Validates: Requirements 3.1**
    - _Tag: Feature: healthyflow-chatbot, Property 2_


- [x] 4. Implementasi Session Memory di `server.js`
  - [x] 4.1 Pastikan setiap entry Session Memory menggunakan prefix `"User: "` dan `"AI: "`
    - Pesan user disimpan sebagai `"User: ${userMessage}"`, respons AI sebagai `"AI: ${response}"`
    - _Requirements: 4.1, 4.4_
  - [x] 4.2 Batasi konteks yang dikirim ke Gemini API maksimal 10 entry terakhir
    - Gunakan `memory.slice(-10)` saat menyusun prompt
    - _Requirements: 4.2_
  - [x] 4.3 Tambahkan pasangan pesan ke Session Memory hanya setelah AI_Response berhasil diterima
    - Push `"User: ..."` dan `"AI: ..."` ke array `memory` setelah `result.response.text()` berhasil
    - _Requirements: 4.3_
  - [ ]* 4.4 Tulis property test untuk Property 3: Session Memory grows after each successful exchange
    - **Property 3: Session Memory grows after each successful exchange**
    - **Validates: Requirements 4.1, 4.3**
    - _Tag: Feature: healthyflow-chatbot, Property 3_
  - [ ]* 4.5 Tulis property test untuk Property 4: Session Memory context is capped at 10 entries
    - **Property 4: Session Memory context is capped at 10 entries**
    - **Validates: Requirements 4.2**
    - _Tag: Feature: healthyflow-chatbot, Property 4_
  - [ ]* 4.6 Tulis property test untuk Property 5: Session Memory entries are distinguishable by role
    - **Property 5: Session Memory entries are distinguishable by role**
    - **Validates: Requirements 4.4**
    - _Tag: Feature: healthyflow-chatbot, Property 5_

- [x] 5. Perbaiki error handling di `server.js`
  - [x] 5.1 Implementasikan error handling spesifik di blok `catch` endpoint `/chat`
    - Selalu panggil `console.error(error)` sebelum mengirim response
    - Deteksi error API key tidak valid → return `{ "reply": "Konfigurasi AI bermasalah, hubungi administrator." }`
    - Deteksi error rate limit → return `{ "reply": "Terlalu banyak permintaan, coba lagi dalam beberapa saat." }`
    - Error lainnya → return `{ "reply": "Maaf, terjadi kesalahan pada AI. Silakan coba lagi." }`
    - Semua response error menggunakan HTTP 500
    - _Requirements: 2.5, 7.2, 7.3, 7.4_
  - [ ]* 5.2 Tulis property test untuk Property 7: Gemini API error results in HTTP 500 with Indonesian error message
    - **Property 7: Gemini API error results in HTTP 500 with Indonesian error message**
    - **Validates: Requirements 2.5, 7.2, 7.3**
    - _Tag: Feature: healthyflow-chatbot, Property 7_
  - [ ]* 5.3 Tulis property test untuk Property 8: All Gemini errors are logged to console
    - **Property 8: All Gemini errors are logged to console**
    - **Validates: Requirements 7.4**
    - _Tag: Feature: healthyflow-chatbot, Property 8_
  - [ ]* 5.4 Tulis unit test untuk pesan error spesifik (API key invalid, rate limit)
    - Test bahwa error API key invalid menghasilkan pesan "Konfigurasi AI bermasalah..."
    - Test bahwa error rate limit menghasilkan pesan "Terlalu banyak permintaan..."
    - _Requirements: 7.2, 7.3_

- [x] 6. Checkpoint — Pastikan semua tests backend lulus
  - Pastikan semua tests pass, tanyakan ke user jika ada pertanyaan.


- [x] 7. Perbaiki property test untuk valid message response (`server.js`)
  - [ ]* 7.1 Tulis property test untuk Property 1: Valid message always produces a reply
    - **Property 1: Valid message always produces a reply**
    - **Validates: Requirements 2.1, 2.3**
    - _Tag: Feature: healthyflow-chatbot, Property 1_

- [x] 8. Perbaiki frontend `public/app.js`
  - [x] 8.1 Tambahkan event listener untuk tombol Enter di `#user-input`
    - Tambahkan `keydown` event listener pada input field; jika `event.key === 'Enter'` panggil `sendMessage()`
    - _Requirements: 5.1_
  - [x] 8.2 Tambahkan validasi input kosong/whitespace sebelum fetch
    - Jika `message.trim() === ""` return lebih awal tanpa memanggil `fetch`
    - _Requirements: 5.4_
  - [x] 8.3 Tampilkan loading indicator sebelum menunggu respons server
    - Setelah menampilkan pesan user, tambahkan elemen loading dengan id unik (misalnya `loading-indicator`) dan teks "HealthyFlow sedang mengetik..."
    - Hapus elemen loading setelah respons diterima (baik sukses maupun error)
    - _Requirements: 5.3_
  - [x] 8.4 Implementasikan error handling di frontend
    - Wrap `fetch` dalam try/catch; jika network error tampilkan "Tidak dapat terhubung ke server. Periksa koneksi Anda."
    - Jika response HTTP 4xx/5xx, tampilkan pesan dari field `reply` atau `error` dalam response JSON
    - Jika response tidak bisa di-parse, tampilkan "Terjadi kesalahan yang tidak terduga."
    - _Requirements: 6.3, 7.1_
  - [x] 8.5 Pastikan input field dibersihkan dan chat box di-scroll setelah pengiriman
    - `input.value = ""` setelah pesan user ditampilkan (sudah ada, verifikasi posisinya benar)
    - `chatBox.scrollTop = chatBox.scrollHeight` setelah setiap penambahan pesan
    - _Requirements: 6.2, 6.4_
  - [ ]* 8.6 Tulis property test untuk Property 9: Frontend displays user message before awaiting response
    - **Property 9: Frontend displays user message before awaiting response**
    - **Validates: Requirements 5.1, 5.2**
    - _Tag: Feature: healthyflow-chatbot, Property 9_
  - [ ]* 8.7 Tulis property test untuk Property 10: Frontend prevents sending empty input
    - **Property 10: Frontend prevents sending empty input**
    - **Validates: Requirements 5.4**
    - _Tag: Feature: healthyflow-chatbot, Property 10_
  - [ ]* 8.8 Tulis property test untuk Property 11: Frontend clears input and scrolls after send
    - **Property 11: Frontend clears input and scrolls after send**
    - **Validates: Requirements 6.2, 6.4**
    - _Tag: Feature: healthyflow-chatbot, Property 11_

- [x] 9. Perbaiki frontend `public/index.html` dan `public/style.css`
  - [x] 9.1 Pastikan `index.html` sudah memiliki struktur yang benar
    - Verifikasi `#chat-box`, `#user-input`, dan tombol "Kirim" ada dengan atribut yang benar
    - Tidak perlu perubahan jika struktur sudah sesuai design
    - _Requirements: 5.1_
  - [x] 9.2 Tambahkan styling untuk loading indicator dan pesan error di `style.css`
    - Tambahkan class `.loading` dengan styling yang membedakannya dari pesan biasa (misalnya italic, warna abu-abu)
    - Tambahkan class `.error` untuk pesan error (misalnya warna merah)
    - _Requirements: 5.3, 6.3_
  - [ ]* 9.3 Tulis property test untuk Property 12: Frontend displays AI response with distinct label
    - **Property 12: Frontend displays AI response with distinct label**
    - **Validates: Requirements 6.1**
    - _Tag: Feature: healthyflow-chatbot, Property 12_
  - [ ]* 9.4 Tulis property test untuk Property 13: Frontend shows error message on server failure
    - **Property 13: Frontend shows error message on server failure**
    - **Validates: Requirements 6.3, 7.1**
    - _Tag: Feature: healthyflow-chatbot, Property 13_

- [x] 10. Final checkpoint — Pastikan semua tests lulus
  - Pastikan semua tests pass, tanyakan ke user jika ada pertanyaan.

## Notes

- Tasks bertanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirement spesifik untuk traceability
- Property tests menggunakan fast-check dengan minimal 100 iterasi per property
- Unit tests melengkapi property tests untuk kasus spesifik dan pesan error eksak
- Checkpoint memastikan validasi inkremental sebelum melanjutkan ke fase berikutnya
