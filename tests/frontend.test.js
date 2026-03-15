// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load app.js source once
const appSource = readFileSync(resolve(process.cwd(), 'public/app.js'), 'utf-8')

function setupDOM() {
  document.body.innerHTML = `
    <div id="chat-box"></div>
    <input id="user-input" value="" />
    <button onclick="sendMessage()">Kirim</button>
  `
}

function loadApp() {
  // Strip the DOMContentLoaded block and wrap sendMessage assignment into globalThis
  const stripped = appSource.replace(
    /\/\/ 8\.1: Enter key listener[\s\S]*$/,
    ''
  )
  // Wrap in a function that assigns to globalThis so it's accessible after eval
  const wrapped = `
    ${stripped}
    globalThis.sendMessage = sendMessage;
  `
  // Use window.eval so the function is defined in the global scope
  window.eval(wrapped) // eslint-disable-line no-eval
}

beforeEach(() => {
  setupDOM()
  loadApp()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Property 9: Frontend displays user message before awaiting response ──────

describe('Property 9: Frontend displays user message before awaiting response', () => {
  // Feature: healthyflow-chatbot, Property 9
  // Validates: Requirements 5.1, 5.2
  it('user message appears in #chat-box before fetch resolves', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (message) => {
          setupDOM()
          loadApp()

          let resolvePromise
          const delayedFetch = vi.fn(() =>
            new Promise((res) => {
              resolvePromise = () =>
                res({
                  ok: true,
                  json: async () => ({ reply: 'AI response' }),
                })
            })
          )
          vi.stubGlobal('fetch', delayedFetch)

          document.getElementById('user-input').value = message

          // Start sendMessage but don't await yet
          const sendPromise = globalThis.sendMessage()

          // User message should already be in chat-box (synchronously appended before fetch)
          const chatBox = document.getElementById('chat-box')
          const userMessages = chatBox.querySelectorAll('.message.user')
          expect(userMessages.length).toBeGreaterThan(0)
          expect(userMessages[userMessages.length - 1].textContent).toContain(message)

          // Resolve fetch and finish
          resolvePromise()
          await sendPromise
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ─── Property 10: Frontend prevents sending empty input ───────────────────────

describe('Property 10: Frontend prevents sending empty input', () => {
  // Feature: healthyflow-chatbot, Property 10
  // Validates: Requirements 5.4
  it('empty or whitespace input does not call fetch and leaves chat-box unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t'),
          fc.constant('\n'),
          fc.string().filter(s => s.trim() === '')
        ),
        async (emptyInput) => {
          setupDOM()
          loadApp()

          const mockFetch = vi.fn()
          vi.stubGlobal('fetch', mockFetch)

          const chatBox = document.getElementById('chat-box')
          const initialHTML = chatBox.innerHTML

          document.getElementById('user-input').value = emptyInput
          await globalThis.sendMessage()

          expect(mockFetch).not.toHaveBeenCalled()
          expect(chatBox.innerHTML).toBe(initialHTML)
        }
      ),
      { numRuns: 30 }
    )
  })
})

// ─── Property 11: Frontend clears input and scrolls after send ────────────────

describe('Property 11: Frontend clears input and scrolls after send', () => {
  // Feature: healthyflow-chatbot, Property 11
  // Validates: Requirements 6.2, 6.4
  it('input is cleared and chatBox is scrolled after successful send', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (message) => {
          setupDOM()
          loadApp()

          vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ reply: 'AI response' }),
          }))

          const input = document.getElementById('user-input')
          input.value = message

          await globalThis.sendMessage()

          expect(input.value).toBe('')
          // jsdom doesn't do layout, but scrollTop is set to scrollHeight
          const chatBox = document.getElementById('chat-box')
          expect(chatBox.scrollTop).toBe(chatBox.scrollHeight)
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ─── Property 12: Frontend displays AI response with distinct label ───────────

describe('Property 12: Frontend displays AI response with distinct label', () => {
  // Feature: healthyflow-chatbot, Property 12
  // Validates: Requirements 6.1
  it('bot messages have class "bot" distinct from user messages with class "user"', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1 }),
        async (userMsg, aiReply) => {
          setupDOM()
          loadApp()

          vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ reply: aiReply }),
          }))

          document.getElementById('user-input').value = userMsg
          await globalThis.sendMessage()

          const chatBox = document.getElementById('chat-box')
          const userDivs = chatBox.querySelectorAll('.message.user')
          const botDivs = chatBox.querySelectorAll('.message.bot:not(.loading)')

          expect(userDivs.length).toBeGreaterThan(0)
          expect(botDivs.length).toBeGreaterThan(0)

          // Classes must be distinct
          userDivs.forEach(d => expect(d.classList.contains('bot')).toBe(false))
          botDivs.forEach(d => expect(d.classList.contains('user')).toBe(false))
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ─── Property 13: Frontend shows error message on server failure ──────────────

describe('Property 13: Frontend shows error message on server failure', () => {
  // Feature: healthyflow-chatbot, Property 13
  // Validates: Requirements 6.3, 7.1

  it('network error (fetch throws) shows error message in #chat-box', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (message) => {
          setupDOM()
          loadApp()

          vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

          document.getElementById('user-input').value = message
          await globalThis.sendMessage()

          const chatBox = document.getElementById('chat-box')
          const errorDivs = chatBox.querySelectorAll('.message.bot.error')
          expect(errorDivs.length).toBeGreaterThan(0)
          expect(errorDivs[errorDivs.length - 1].textContent).toContain('Tidak dapat terhubung')
        }
      ),
      { numRuns: 20 }
    )
  })

  it('HTTP 4xx/5xx response shows error message in #chat-box', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 400, max: 599 }),
        async (message, statusCode) => {
          setupDOM()
          loadApp()

          vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: statusCode,
            json: async () => ({ reply: 'Server error occurred' }),
          }))

          document.getElementById('user-input').value = message
          await globalThis.sendMessage()

          const chatBox = document.getElementById('chat-box')
          const errorDivs = chatBox.querySelectorAll('.message.bot.error')
          expect(errorDivs.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 20 }
    )
  })
})
