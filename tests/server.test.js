import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import request from 'supertest'

// Shared mock state — must be declared before vi.mock (hoisted)
const mockState = {
  generateContent: null,
}

vi.mock('@google/generative-ai', () => {
  function GoogleGenerativeAI() {}
  GoogleGenerativeAI.prototype.getGenerativeModel = function () {
    return {
      generateContent: (...args) => mockState.generateContent(...args),
    }
  }
  return { GoogleGenerativeAI }
})

// Import after mock is set up
const { app, modelName, SYSTEM_PROMPT, memory } = await import('../server.js')

beforeEach(() => {
  // Reset memory between tests
  memory.splice(0)
  // Default mock: returns a successful response
  mockState.generateContent = vi.fn().mockResolvedValue({
    response: { text: () => 'default AI response' },
  })
})

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('Unit: Server Configuration', () => {
  // Requirements 1.3
  it('uses gemini-1.5-flash model', () => {
    expect(modelName).toBe('gemini-1.5-flash')
  })

  // Requirements 3.2–3.4
  it('SYSTEM_PROMPT contains HealthyFlow AI identity', () => {
    expect(SYSTEM_PROMPT).toContain('HealthyFlow AI')
  })

  it('SYSTEM_PROMPT contains domain keywords', () => {
    expect(SYSTEM_PROMPT).toContain('fokus belajar')
    expect(SYSTEM_PROMPT).toContain('Olahraga ringan')
    expect(SYSTEM_PROMPT).toContain('istirahat')
    expect(SYSTEM_PROMPT).toContain('waktu')
  })

  it('SYSTEM_PROMPT instructs redirect for off-domain topics', () => {
    expect(SYSTEM_PROMPT).toMatch(/arahkan kembali|di luar domain/i)
  })
})

// ─── Unit Tests: Specific Error Messages ─────────────────────────────────────

describe('Unit: Specific Error Messages', () => {
  // Requirements 7.2
  it('API key invalid error returns "Konfigurasi AI bermasalah"', async () => {
    mockState.generateContent = vi.fn().mockRejectedValue(
      new Error('API_KEY_INVALID: API key not valid')
    )

    const res = await request(app).post('/chat').send({ message: 'halo' })

    expect(res.status).toBe(500)
    expect(res.body.reply).toContain('Konfigurasi AI bermasalah')
  })

  // Requirements 7.3
  it('Rate limit error returns "Terlalu banyak permintaan"', async () => {
    mockState.generateContent = vi.fn().mockRejectedValue(
      new Error('RESOURCE_EXHAUSTED: quota exceeded rate limit 429')
    )

    const res = await request(app).post('/chat').send({ message: 'halo' })

    expect(res.status).toBe(500)
    expect(res.body.reply).toContain('Terlalu banyak permintaan')
  })
})

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 1: Valid message always produces a reply', () => {
  // Feature: healthyflow-chatbot, Property 1
  // Validates: Requirements 2.1, 2.3
  it('valid message always returns HTTP 200 with reply string', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (message) => {
          const res = await request(app).post('/chat').send({ message })
          expect(res.status).toBe(200)
          expect(typeof res.body.reply).toBe('string')
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 6: Empty or whitespace input returns HTTP 400', () => {
  // Feature: healthyflow-chatbot, Property 6
  // Validates: Requirements 2.4
  it('empty or whitespace message returns 400', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t'),
          fc.constant('\n'),
          fc.string().filter(s => s.trim() === '')
        ),
        async (message) => {
          const res = await request(app).post('/chat').send({ message })
          expect(res.status).toBe(400)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('missing message field returns 400', async () => {
    const res = await request(app).post('/chat').send({})
    expect(res.status).toBe(400)
  })
})

describe('Property 2: System Prompt always included in Gemini request', () => {
  // Feature: healthyflow-chatbot, Property 2
  // Validates: Requirements 3.1
  it('prompt sent to Gemini always contains SYSTEM_PROMPT content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (message) => {
          let capturedPrompt = ''
          mockState.generateContent = vi.fn().mockImplementation(async (prompt) => {
            capturedPrompt = prompt
            return { response: { text: () => 'ok' } }
          })

          await request(app).post('/chat').send({ message })

          expect(capturedPrompt).toContain('HealthyFlow AI')
          expect(capturedPrompt).toContain('fokus belajar')
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('Property 3: Session Memory grows after each successful exchange', () => {
  // Feature: healthyflow-chatbot, Property 3
  // Validates: Requirements 4.1, 4.3
  it('memory grows by 2 after each successful exchange', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 5 }
        ),
        async (messages) => {
          memory.splice(0)
          mockState.generateContent = vi.fn().mockResolvedValue({
            response: { text: () => 'response ok' },
          })

          for (let i = 0; i < messages.length; i++) {
            const before = memory.length
            const res = await request(app).post('/chat').send({ message: messages[i] })
            expect(res.status).toBe(200)
            expect(memory.length).toBe(before + 2)
          }
        }
      ),
      { numRuns: 20 }
    )
  })
})

describe('Property 4: Session Memory context is capped at 10 entries', () => {
  // Feature: healthyflow-chatbot, Property 4
  // Validates: Requirements 4.2
  it('prompt sent to Gemini contains at most 10 memory entries', async () => {
    // Pre-fill memory with 15 entries
    for (let i = 0; i < 15; i++) {
      memory.push(i % 2 === 0 ? `User: message ${i}` : `AI: response ${i}`)
    }

    let capturedPromptLocal = ''
    mockState.generateContent = vi.fn().mockImplementation(async (prompt) => {
      capturedPromptLocal = prompt
      return { response: { text: () => 'capped response' } }
    })

    await request(app).post('/chat').send({ message: 'test cap' })

    const lines = capturedPromptLocal.split('\n')
    const memoryLines = lines.filter(l => l.startsWith('User: ') || l.startsWith('AI: '))
    expect(memoryLines.length).toBeLessThanOrEqual(10)
  })

  it('property: for any memory size > 10, prompt never contains more than 10 entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 11, max: 30 }),
        async (extraEntries) => {
          memory.splice(0)
          for (let i = 0; i < extraEntries; i++) {
            memory.push(i % 2 === 0 ? `User: msg ${i}` : `AI: resp ${i}`)
          }

          let capturedPromptLocal = ''
          mockState.generateContent = vi.fn().mockImplementation(async (prompt) => {
            capturedPromptLocal = prompt
            return { response: { text: () => 'ok' } }
          })

          await request(app).post('/chat').send({ message: 'check cap' })

          const lines = capturedPromptLocal.split('\n')
          const memoryLines = lines.filter(l => l.startsWith('User: ') || l.startsWith('AI: '))
          expect(memoryLines.length).toBeLessThanOrEqual(10)
        }
      ),
      { numRuns: 20 }
    )
  })
})

describe('Property 5: Session Memory entries are distinguishable by role', () => {
  // Feature: healthyflow-chatbot, Property 5
  // Validates: Requirements 4.4
  it('all memory entries start with "User: " or "AI: "', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 5 }
        ),
        async (messages) => {
          memory.splice(0)
          mockState.generateContent = vi.fn().mockResolvedValue({
            response: { text: () => 'AI reply here' },
          })

          for (const msg of messages) {
            await request(app).post('/chat').send({ message: msg })
          }

          for (const entry of memory) {
            expect(entry.startsWith('User: ') || entry.startsWith('AI: ')).toBe(true)
          }
        }
      ),
      { numRuns: 20 }
    )
  })
})

describe('Property 7: Gemini API error results in HTTP 500 with Indonesian error message', () => {
  // Feature: healthyflow-chatbot, Property 7
  // Validates: Requirements 2.5, 7.2, 7.3
  it('any Gemini error returns HTTP 500 with Indonesian reply', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (errorMessage) => {
          mockState.generateContent = vi.fn().mockRejectedValue(new Error(errorMessage))

          const res = await request(app).post('/chat').send({ message: 'test error' })

          expect(res.status).toBe(500)
          expect(typeof res.body.reply).toBe('string')
          expect(res.body.reply.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('Property 8: All Gemini errors are logged to console', () => {
  // Feature: healthyflow-chatbot, Property 8
  // Validates: Requirements 7.4
  it('console.error is called for every Gemini error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (errorMessage) => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
          mockState.generateContent = vi.fn().mockRejectedValue(new Error(errorMessage))

          await request(app).post('/chat').send({ message: 'trigger error' })

          expect(consoleSpy).toHaveBeenCalled()
          consoleSpy.mockRestore()
        }
      ),
      { numRuns: 30 }
    )
  })
})
