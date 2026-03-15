import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { GoogleGenerativeAI } from "@google/generative-ai"

dotenv.config()

if (!process.env.GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY tidak ditemukan. Server tidak dapat dijalankan.")
  process.exit(1)
}

export const modelName = "gemini-1.5-flash"

export const SYSTEM_PROMPT = `Kamu adalah HealthyFlow AI, asisten produktivitas dan kesehatan yang ramah.
Gunakan bahasa santai dan ramah dalam setiap respons.
Fokus HANYA pada topik berikut:
- Tips fokus belajar
- Olahraga ringan
- Manajemen istirahat
- Manajemen waktu

Berikan saran yang praktis, singkat, dan dapat langsung diterapkan.
Jika pengguna menanyakan topik di luar domain ini, arahkan kembali
percakapan ke topik kesehatan dan produktivitas dengan ramah.`

export let memory = []

const app = express()
const port = 3000

app.use(cors())
app.use(express.json())
app.use(express.static("public"))

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: modelName })

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message

  if (!userMessage || typeof userMessage !== "string" || userMessage.trim() === "") {
    return res.status(400).json({ error: "Pesan tidak boleh kosong." })
  }

  const prompt = `${SYSTEM_PROMPT}

Riwayat percakapan:
${memory.slice(-10).join("\n")}

Pesan terbaru dari pengguna:
${userMessage}`

  try {
    const result = await model.generateContent(prompt)
    const response = result.response.text()

    memory.push(`User: ${userMessage}`)
    memory.push(`AI: ${response}`)

    res.json({ reply: response })
  } catch (error) {
    console.error(error)

    const msg = (error && error.message) ? error.message : ""
    if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid") || msg.includes("invalid api key")) {
      return res.status(500).json({ reply: "Konfigurasi AI bermasalah, hubungi administrator." })
    }
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("429")) {
      return res.status(500).json({ reply: "Terlalu banyak permintaan, coba lagi dalam beberapa saat." })
    }
    res.status(500).json({ reply: "Maaf, terjadi kesalahan pada AI. Silakan coba lagi." })
  }
})

app.listen(port, () => {
  console.log("Server berjalan di http://localhost:3000")
})

export { app }
