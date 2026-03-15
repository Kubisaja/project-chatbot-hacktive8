async function sendMessage() {
  const input = document.getElementById('user-input')
  const chatBox = document.getElementById('chat-box')
  const message = input.value

  // 8.2: Validate empty/whitespace input
  if (message.trim() === '') return

  // 8.5: Clear input field after capturing message
  input.value = ''

  // Display user message
  const userDiv = document.createElement('div')
  userDiv.className = 'message user'
  userDiv.textContent = 'Kamu: ' + message
  chatBox.appendChild(userDiv)
  chatBox.scrollTop = chatBox.scrollHeight

  // 8.3: Show loading indicator
  const loadingDiv = document.createElement('div')
  loadingDiv.className = 'message bot loading'
  loadingDiv.id = 'loading-indicator'
  loadingDiv.textContent = 'HealthyFlow sedang mengetik...'
  chatBox.appendChild(loadingDiv)
  chatBox.scrollTop = chatBox.scrollHeight

  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    })

    // 8.3: Remove loading indicator
    const loadingEl = document.getElementById('loading-indicator')
    if (loadingEl) loadingEl.remove()

    // 8.4: Handle HTTP error responses
    if (!response.ok) {
      let errorText = 'Terjadi kesalahan yang tidak terduga.'
      try {
        const errData = await response.json()
        errorText = errData.reply || errData.error || errorText
      } catch (_) {}

      const errorDiv = document.createElement('div')
      errorDiv.className = 'message bot error'
      errorDiv.textContent = 'HealthyFlow: ' + errorText
      chatBox.appendChild(errorDiv)
      chatBox.scrollTop = chatBox.scrollHeight
      return
    }

    const data = await response.json()

    const botDiv = document.createElement('div')
    botDiv.className = 'message bot'
    botDiv.textContent = 'HealthyFlow: ' + data.reply
    chatBox.appendChild(botDiv)
    chatBox.scrollTop = chatBox.scrollHeight

  } catch (_) {
    // 8.4: Handle network errors
    const loadingEl = document.getElementById('loading-indicator')
    if (loadingEl) loadingEl.remove()

    const errorDiv = document.createElement('div')
    errorDiv.className = 'message bot error'
    errorDiv.textContent = 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'
    chatBox.appendChild(errorDiv)
    chatBox.scrollTop = chatBox.scrollHeight
  }
}

// 8.1: Enter key listener
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('user-input')
  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') sendMessage()
    })
  }
})
