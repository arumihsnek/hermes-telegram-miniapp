/**
 * Tasks/Agents page — equivalent to /agents and /tasks in hermes --tui
 * Shows active telegram sessions and running kanban tasks.
 * Auto-refreshes every 30 seconds.
 */
const tasksPage = {
  _refreshTimer: null,
  _content: null,

  async handler({ content, title }) {
    title.textContent = 'Agents';
    this._content = content;
    clearInterval(this._refreshTimer);
    await this._render();
    this._refreshTimer = setInterval(() => this._render(), 30000);
  },

  async _render() {
    const content = this._content;
    if (!content) return;

    let data;
    try {
      data = await API.get('/agents');
    } catch (err) {
      content.innerHTML = `<div class="error">Failed to load agents: ${this._esc(err.message)}</div>`;
      return;
    }

    const { agents = [], running_tasks = [] } = data;

    const bgAgents = agents.filter(a => a.session_id.startsWith('bg_'));

    let html = `
      <div class="agents-page">
        <div class="agents-refresh-hint tg-text-hint" style="font-size:.72rem;text-align:right;padding:4px 12px">
          Auto-refresh: 30s &nbsp;•&nbsp;
          <span style="cursor:pointer;color:var(--tg-theme-link-color,#4a9eff)" onclick="tasksPage._render()">↻ Now</span>
        </div>`;

    // Running kanban tasks (from delegate_task, /btw, etc.)
    if (running_tasks.length > 0) {
      html += `
        <div class="agents-section">
          <div class="agents-section-title">🏃 Running (${running_tasks.length})</div>
          ${running_tasks.map(t => `
            <div class="agent-card card">
              <div class="agent-header">
                <span class="agent-name">${this._esc(t.title)}</span>
                <span class="agent-badge badge-running">running</span>
              </div>
              <div class="agent-meta tg-text-hint">
                ${t.assignee ? `@${this._esc(t.assignee)} &nbsp;•&nbsp;` : ''}
                ${this._uptime(t.elapsed_seconds)}
                &nbsp;•&nbsp; <span class="agent-id">${t.id}</span>
              </div>
            </div>
          `).join('')}
        </div>`;
    }

    // Background sessions (bg_*)
    if (bgAgents.length > 0) {
      html += `
        <div class="agents-section">
          <div class="agents-section-title">⚡ Background (${bgAgents.length})</div>
          ${bgAgents.map(a => this._agentCard(a)).join('')}
        </div>`;
    }

    if (running_tasks.length === 0 && bgAgents.length === 0) {
      html += `<div class="empty-state"><div class="icon">😴</div><p>Sin tareas activas</p><p class="tg-text-hint">Todo en reposo</p></div>`;
    }

    html += '</div>';
    content.innerHTML = html;
  },

  _agentCard(a) {
    const id8 = (a.session_id || '').slice(0, 8);
    const title = a.title || a.session_id;
    const model = a.model ? `<span class="agent-model">${this._esc(a.model.split('/').pop())}</span>` : '';
    return `
      <div class="agent-card card">
        <div class="agent-header">
          <span class="agent-name">${this._esc(title)}</span>
          <span class="agent-badge badge-active">activo</span>
        </div>
        <div class="agent-meta tg-text-hint">
          ${model}${model ? ' &nbsp;•&nbsp; ' : ''}
          ${this._uptime(a.elapsed_seconds)}
          &nbsp;•&nbsp; <code class="agent-id">${id8}</code>
        </div>
      </div>`;
  },

  _uptime(seconds) {
    if (!seconds || seconds < 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  },

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },
};

Router.register('/tasks', tasksPage.handler.bind(tasksPage));
