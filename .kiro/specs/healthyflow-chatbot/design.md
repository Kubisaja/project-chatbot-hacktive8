# Design Document: HealthyFlow Chatbot

## Overview

HealthyFlow Chatbot adalah Personal Productivity Assistant berbasis AI yang dibangun di atas stack Node.js + Express (backend) dan antarmuka web statis (frontend). Engine AI menggunakan Google Gemini API (`gemini-1.5-flash`) melalui library `@google/generative-ai`.

Sistem ini memungkinkan pengguna berinteraksi melalui chat web untuk mendapatkan tips seputar fokus belajar, olahraga ringan, manajemen istirahat, dan manajemen waktu. Chatbot memiliki persona konsisten sebagai "HealthyFlow AI" dengan gaya bahasa santai dan ramah, serta mempertahankan konteks percakapan dalam satu sesi server.

Tujuan desain ini adalah memperbaiki implementasi yang sudah ada (`server.js`, `public/app.js`, dll.) agar memenuhi semua acceptance criteria di requirements.md, termasuk validasi input, error handling yang informatif, session memory yang benar, dan penggunaan model yang tepat (`gemini-1.5-flash`).

## Architecture

```mermaid
graph TD
    User["Pengguna (Browser)"] -->|HTTP POST /chat| Server["Express Server (server.js)"]
    Server -->|Static files| Frontend["Frontend (public/)"]
    Server -->|generateContent()| GeminiAPI["Google Gemini API"]
    GeminiAPI -->|AI_Response| Server
    Server -->|JSON { reply }| User
    Server -->|read/write| Memory["Session Memory (in-memory array)"]
```

Alur request:
1. Pengguna mengetik pesan di frontend dan menekan Enter atau klik Kirim
2. Frontend mengirim POST `/chat` dengan body `{ message: "..." }`
3. Server memvalidasi input, menyusun prompt dengan System_Prompt + Session_Memory
4. Server memanggil Gemini API dan menunggu respons
5. Server menyimpan pasangan pesan ke Session_Memory lalu mengembalikan `{ reply: "..." }`
6. Frontend menampilkan respons dan men-scroll ke bawah

## Components and Interfaces

### Backend: `server.js`

Tanggung jawab:
- Memuat konfigurasi dari `.env` via `dotenv`
- Menginisialisasi `GoogleGenerativeAI` dan model `gemini-1.5-flash`
- Menyajikan file statis dari folder `public/`
- Menangani endpoint `POST /chat`
- Mengelola Session_Memory
- Menangani semua error dari Gemini API

Interface endpoint:

```
POST /chat
Content-Type: application/json

Request body:
{
  "message": string  // wajib, tidak boleh kosong
}

Response (200 OK):
{
  "reply": string
}

Response (400 Bad Request):
{
  "error": "Pesan tidak boleh kosong."
}

Response (500 Internal Server Error):
{
  "reply": string  // pesan error dalam bahasa Indonesia
}
```

### Frontend: `public/app.js`

Tanggung jawab:
- Menangani event klik tombol Kirim dan keypress Enter
- Memvalidasi input (tidak boleh kosong/whitespace)
- Menampilkan pesan user sebelum menunggu respons
- Menampilkan indikator loading saat menunggu
- Menampilkan AI_Response atau pesan error
- Auto-scroll ke pesan terbaru
- Membersihkan input field setelah pengiriman

### Frontend: `public/index.html`

Struktur UI:
- Container chat dengan judul
- `#chat-box`: area tampilan percakapan
- `#user-input`: input field
- Tombol "Kirim" dengan event handler
- Listener keyboard untuk tombol Enter

### Frontend: `public/style.css`

Styling untuk:
- Layout chat container
- Bubble pesan user (kanan, biru)
- Bubble pesan bot (kiri, hijau)
- Indikator loading
- Pesan error

## Data Models

### Session Memory Entry

Session_Memory disimpan sebagai array of string di memori server (in-process). Format setiap entry:

```
"User: <pesan pengguna>"
"AI: <respons AI>"
```

Maksimal 10 pesan terakhir (5 pasang) disertakan sebagai konteks ke Gemini API.

### Request Body Schema

```typescript
interface ChatRequest {
  message: string; // required, non-empty after trim
}
```

### Response Body Schema

```typescript
interface ChatResponse {
  reply: string; // AI response text atau pesan error
}

interface ErrorResponse {
  error: string; // untuk HTTP 400
}
```

### System Prompt Structure

System_Prompt didefinisikan sebagai konstanta di `server.js`:

```
Kamu adalah HealthyFlow AI, asisten produktivitas dan kesehatan yang ramah.
Gunakan bahasa santai dan ramah dalam setiap respons.
Fokus HANYA pada topik berikut:
- Tips fokus belajar
- Olahraga ringan
- Manajemen istirahat
- Manajemen waktu

Berikan saran yang praktis, singkat, dan dapat langsung diterapkan.
Jika pengguna menanyakan topik di luar domain ini, arahkan kembali
percakapan ke topik kesehatan dan produktivitas dengan ramah.
```

### Prompt Assembly

Prompt yang dikirim ke Gemini API disusun sebagai:

```
{SYSTEM_PROMPT}

Riwayat percakapan:
{last 10 entries from Session_Memory}

Pesan terbaru dari pengguna:
{userMessage}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid message always produces a reply

*For any* non-empty string message sent to `POST /chat`, the server should return HTTP 200 with a JSON body containing a `reply` field of type string.

**Validates: Requirements 2.1, 2.3**

---

### Property 2: System Prompt always included in Gemini request

*For any* user message processed by the chat endpoint, the prompt assembled and sent to Gemini API must always contain the System_Prompt text (including "HealthyFlow AI" and domain keywords).

**Validates: Requirements 3.1**

---

### Property 3: Session Memory grows after each successful exchange

*For any* sequence of valid messages sent to the chat endpoint, after each successful response the Session_Memory must contain both the user message and the AI response as a new pair, making the memory length grow by exactly 2 entries per exchange.

**Validates: Requirements 4.1, 4.3**

---

### Property 4: Session Memory context is capped at 10 entries

*For any* Session_Memory with more than 10 entries, the prompt sent to Gemini API must contain at most the 10 most recent entries — never more.

**Validates: Requirements 4.2**

---

### Property 5: Session Memory entries are distinguishable by role

*For any* entry stored in Session_Memory, it must be prefixed with either `"User: "` or `"AI: "` so that the role of each message can be unambiguously determined.

**Validates: Requirements 4.4**

---

### Property 6: Empty or whitespace input returns HTTP 400

*For any* request to `POST /chat` where the `message` field is absent, null, empty string, or composed entirely of whitespace characters, the server must return HTTP 400 with an error message.

**Validates: Requirements 2.4**

---

### Property 7: Gemini API error results in HTTP 500 with Indonesian error message

*For any* Gemini API error (network failure, invalid key, rate limit, etc.), the server must return HTTP 500 with a `reply` field containing a human-readable error message in Indonesian.

**Validates: Requirements 2.5, 7.2, 7.3**

---

### Property 8: All Gemini errors are logged to console

*For any* error thrown by the Gemini API call, `console.error` must be called with sufficient detail (error message or stack) before the response is sent.

**Validates: Requirements 7.4**

---

### Property 9: Frontend displays user message before awaiting response

*For any* valid (non-empty) user input submitted via the send button or Enter key, the user's message must appear in `#chat-box` in the DOM before the fetch promise resolves.

**Validates: Requirements 5.1, 5.2**

---

### Property 10: Frontend prevents sending empty input

*For any* input value that is empty or composed entirely of whitespace, triggering the send action (button click or Enter) must not invoke `fetch` and must leave `#chat-box` unchanged.

**Validates: Requirements 5.4**

---

### Property 11: Frontend clears input and scrolls after send

*For any* successfully submitted message, after the response is rendered: the `#user-input` field must be empty and `#chat-box.scrollTop` must equal `#chat-box.scrollHeight`.

**Validates: Requirements 6.2, 6.4**

---

### Property 12: Frontend displays AI response with distinct label

*For any* successful server response, the AI reply rendered in `#chat-box` must be visually distinguishable from user messages (different CSS class or label prefix).

**Validates: Requirements 6.1**

---

### Property 13: Frontend shows error message on server failure

*For any* server response with HTTP 4xx/5xx status or a network-level fetch failure, a user-friendly error message must appear in `#chat-box`.

**Validates: Requirements 6.3, 7.1**

---

## Error Handling

### Backend Error Handling

| Kondisi | HTTP Status | Response |
|---|---|---|
| `message` kosong / tidak ada | 400 | `{ "error": "Pesan tidak boleh kosong." }` |
| Gemini API key tidak valid | 500 | `{ "reply": "Konfigurasi AI bermasalah, hubungi administrator." }` |
| Gemini rate limit | 500 | `{ "reply": "Terlalu banyak permintaan, coba lagi dalam beberapa saat." }` |
| Error Gemini lainnya | 500 | `{ "reply": "Maaf, terjadi kesalahan pada AI. Silakan coba lagi." }` |

Semua error dari Gemini API harus di-log ke console dengan `console.error(error)` sebelum mengirim response.

Validasi API key saat startup: jika `process.env.GEMINI_API_KEY` kosong atau tidak ada, server harus mencetak pesan error ke console dan memanggil `process.exit(1)`.

### Frontend Error Handling

| Kondisi | Tampilan di chat box |
|---|---|
| Network error (fetch gagal) | "Tidak dapat terhubung ke server. Periksa koneksi Anda." |
| HTTP 4xx / 5xx dari server | Pesan dari field `reply` atau `error` dalam response JSON |
| Response tidak bisa di-parse | "Terjadi kesalahan yang tidak terduga." |

Loading indicator ("HealthyFlow sedang mengetik...") ditampilkan segera setelah pesan user dikirim dan dihapus setelah respons diterima (baik sukses maupun error).

---

## Testing Strategy

### Dual Testing Approach

Pengujian menggunakan dua pendekatan yang saling melengkapi:

1. **Unit tests** — memverifikasi contoh spesifik, edge case, dan kondisi error
2. **Property-based tests** — memverifikasi properti universal di berbagai input yang di-generate secara acak

### Property-Based Testing

Library yang digunakan: **fast-check** (JavaScript/Node.js)

```bash
npm install --save-dev fast-check
```

Setiap property test harus:
- Dijalankan minimal **100 iterasi** (default fast-check sudah 100)
- Diberi komentar tag dengan format: `Feature: healthyflow-chatbot, Property {N}: {property_text}`
- Mereferensikan nomor property dari design document ini

Contoh struktur property test:

```javascript
// Feature: healthyflow-chatbot, Property 1: Valid message always produces a reply
test('valid message always returns reply field', async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ minLength: 1 }), async (message) => {
      const res = await request(app).post('/chat').send({ message });
      expect(res.status).toBe(200);
      expect(typeof res.body.reply).toBe('string');
    }),
    { numRuns: 100 }
  );
});
```

### Unit Tests

Unit tests fokus pada:
- Contoh spesifik yang mendemonstrasikan perilaku benar (Requirements 1.1–1.3, 3.2–3.4, 7.2–7.3)
- Integrasi antara komponen (server ↔ Gemini mock)
- Edge case dan kondisi error (input kosong, API key tidak ada)

Contoh unit test:

```javascript
// Requirements 1.3: model yang digunakan adalah gemini-1.5-flash
test('uses gemini-1.5-flash model', () => {
  expect(modelName).toBe('gemini-1.5-flash');
});

// Requirements 7.1: pesan error koneksi spesifik
test('shows connection error message on network failure', async () => {
  // mock fetch to throw
  // assert chat box contains "Tidak dapat terhubung ke server..."
});
```

### Test Coverage Target

| Area | Jenis Test | Properties / Cases |
|---|---|---|
| Backend validation | Property | Property 6 |
| Backend response format | Property | Property 1 |
| System Prompt inclusion | Property | Property 2 |
| Session Memory growth | Property | Property 3 |
| Session Memory cap | Property | Property 4 |
| Session Memory format | Property | Property 5 |
| Gemini error → 500 | Property | Property 7 |
| Error logging | Property | Property 8 |
| Frontend send behavior | Property | Property 9, 10, 11 |
| Frontend rendering | Property | Property 12, 13 |
| Model name config | Unit | Requirement 1.3 |
| System Prompt content | Unit | Requirements 3.2–3.4 |
| Specific error messages | Unit | Requirements 7.1–7.3 |
