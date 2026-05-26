/**
 * Chat page — conversation history + quick message input
 *
 * Shows recent Telegram-sourced sessions with last message preview.
 * Typing a message opens Telegram chat with the text prepopulated.
 * Tapping a session opens the full session detail view.
 */
const chatPage = {
  _allSessions: [],

  async handler({ content, title, backBtn }) {
    title.textContent = 'Chat';
    backBtn.classList.add('hidden');

    this._renderShell(content);
    await this._loadSessions();
    this._renderChats(content);
    this._bindInput(content);
  },

  _renderShell(container) {
    container.innerHTML = `
      <div class="chat-page">
        <div class="chat-header-actions">
          <button id="chat-new-btn" class="tg-button" style="padding:8px 14px;font-size:13px">+ New Chat</button>
        </div>
        <div id="chat-list" class="chat-list">
          <div class="loading">Loading conversations...</div>
        </div>
        <div class="chat-input-bar">
          <input id="chat-input" class="tg-input" type="text" placeholder="Type a message..." maxlength="200">
          <button id="chat-send-btn" class="chat-send-btn" disabled>&#10148;</button>
        </div>
      </div>`;
  },

  async _loadSessions() {
    try {
      const data = await API.get('/sessions?source=telegram&limit=20');
      this._allSessions = data.sessions || [];
    } catch (err) {
      this._allSessions = [];
    }
  },

  _renderChats(container) {
    const listEl = container.querySelector('#chat-list');
    const sessions = this._allSessions;

    if (sessions.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">&#128172;</div>
          <p>No conversations yet</p>
          <p class="tg-text-hint">Your Telegram chats with HERMES will appear here</p>
        </div>`;
      return;
    }

    listEl.innerHTML = sessions.map(s => `
      <div class="chat-conversation card" onclick="chatPage._openSession('${chatPage._escape(s.id)}')">
        <div class="chat-conv-header">
          <span class="chat-conv-title">${chatPage._escape(s.title || 'Chat ' + (s.id || '').substring(0, 10))}</span>
          <span class="chat-conv-time">${chatPage._formatDate(s.ended_at || s.started_at)}</span>
        </div>
        <div class="chat-conv-preview">
          <span class="chat-preview-role">${s.last_role === 'user' ? '👤' : (s.last_role === 'assistant' ? '🤖' : '🔧')}</span>
          <span class="chat-preview-text">${chatPage._escape(s.last_message || '') || '💬 ' + (s.message_count || 0) + ' messages'}</span>
        </div>
        <div class="chat-conv-meta">
          <span class="tg-badge">${s.message_count || 0} msgs</span>
        </div>
      </div>
    `).join('');
  },

  _bindInput(container) {
    const input = container.querySelector('#chat-input');
    const sendBtn = container.querySelector('#chat-send-btn');
    const newBtn = container.querySelector('#chat-new-btn');

    // Enable/disable send based on input
    input.addEventListener('input', () => {
      sendBtn.disabled = !input.value.trim();
    });

    // Send: open Telegram chat with the message prepopulated
    const sendMessage = () => {
      const text = input.value.trim();
      if (!text) return;
      const encoded = encodeURIComponent(text);
      const tgDeepLink = 'tg://resolve?domain=hermesagentbot&text=' + encoded;
      window.location.href = tgDeepLink;
      input.value = '';
      sendBtn.disabled = true;
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // New Chat: open blank Telegram conversation
    newBtn.addEventListener('click', () => {
      window.location.href = 'tg://resolve?domain=hermesagentbot';
    });
  },

  async _openSession(sessionId) {
    Router.navigate('/sessions/' + sessionId);
  },

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  _formatDate(dateStr) {
    try {
      if (!dateStr) return '';
      const d = typeof dateStr === 'number' ? new Date(dateStr * 1000) : new Date(dateStr);
      if (Number.isNaN(d.getTime())) return '';
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
      if (diff < 604800000) return Math.floor(diff / 86400000) + 'd';
      return d.toLocaleDateString();
    } catch (e) { return ''; }
  },
};

Router.register('/chat', chatPage.handler.bind(chatPage));
