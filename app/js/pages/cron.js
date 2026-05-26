/**
 * Cron page — view and manage scheduled cron jobs.
 * Equivalent to the cron section of hermes --tui.
 */
const cronPage = {
  _jobs: [],
  _showForm: false,

  async handler({ content, title }) {
    title.textContent = 'Cron';
    this._content = content;
    this._showForm = false;
    await this._render();
  },

  async _render() {
    const content = this._content;
    if (!content) return;

    try {
      const data = await API.get('/jobs');
      this._jobs = data.jobs || [];
    } catch (err) {
      content.innerHTML = `<div class="error">Failed to load jobs: ${this._esc(err.message)}</div>`;
      return;
    }

    let html = `<div class="cron-page">`;

    // Header with create button
    html += `
      <div class="cron-toolbar" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px">
        <span style="font-size:.85rem;color:var(--tg-theme-hint-color,#888)">${this._jobs.length} job${this._jobs.length !== 1 ? 's' : ''}</span>
        <button class="tg-button" style="width:auto;padding:8px 16px;font-size:.8rem" onclick="cronPage._openForm()">+ Nuevo Cron</button>
      </div>`;

    // Job form (inline)
    html += `<div id="cron-form-container"></div>`;

    // Jobs list
    if (this._jobs.length === 0) {
      html += `<div class="empty-state"><div class="icon">🕐</div><p>Sin cron jobs</p><p class="tg-text-hint">Crea uno con "+ Nuevo Cron"</p></div>`;
    } else {
      html += this._jobs.map(j => this._jobCard(j)).join('');
    }

    html += `</div>`;
    content.innerHTML = html;
  },

  _jobCard(j) {
    const enabled = j.enabled !== false;
    const state = j.state || 'scheduled';
    const lastStatus = j.last_status;
    const lastError = j.last_error;
    const nextRun = j.next_run_at ? this._relTime(j.next_run_at) : '—';
    const lastRun = j.last_run_at ? this._relTime(j.last_run_at) : 'Nunca';

    const stateColor = {
      running: '#4a9eff',
      scheduled: enabled ? '#4caf50' : '#888',
      error: '#ff6b6b',
      paused: '#ff9800',
    }[state] || '#888';

    const statusDot = lastStatus === 'error'
      ? `<span style="color:#ff6b6b">● error</span>`
      : lastStatus === 'ok'
        ? `<span style="color:#4caf50">● ok</span>`
        : '';

    return `
      <div class="cron-card card" style="margin:8px 12px;border-left:3px solid ${stateColor}">
        <div style="display:flex;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <strong style="font-size:.9rem">${this._esc(j.name)}</strong>
              ${statusDot}
              ${!enabled ? '<span class="tg-text-hint" style="font-size:.72rem">(desactivado)</span>' : ''}
            </div>
            <div class="tg-text-hint" style="font-size:.75rem;margin-top:3px">
              📅 ${this._esc(j.schedule_display || j.schedule?.display || '?')}
              &nbsp;•&nbsp; próx: ${nextRun}
              &nbsp;•&nbsp; último: ${lastRun}
            </div>
            ${lastError ? `<div style="font-size:.72rem;color:#ff6b6b;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this._esc(lastError)}">⚠ ${this._esc(lastError.slice(0, 80))}</div>` : ''}
            ${j.prompt ? `<div class="tg-text-hint" style="font-size:.72rem;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._esc(j.prompt.slice(0, 100))}</div>` : ''}
            ${j.skill ? `<div style="font-size:.72rem;margin-top:2px;color:var(--tg-theme-link-color,#4a9eff)">/${this._esc(j.skill)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
            <button class="tg-button" style="width:auto;padding:5px 10px;font-size:.72rem"
              onclick="cronPage._runNow('${j.id}')">▶ Run</button>
            <button class="tg-button tg-button-secondary" style="width:auto;padding:5px 10px;font-size:.72rem"
              onclick="cronPage._toggle('${j.id}')">${enabled ? 'Pausar' : 'Activar'}</button>
            <button class="tg-button tg-button-secondary" style="width:auto;padding:5px 10px;font-size:.72rem"
              onclick="cronPage._toggleSessions('${j.id}', this)">📋</button>
          </div>
        </div>
        <div id="cron-sessions-${j.id}" style="display:none;margin-top:6px;border-top:1px solid var(--tg-theme-secondary-bg-color,#2a2a2a);padding-top:6px"></div>
      </div>`;
  },

  _openForm() {
    const container = document.getElementById('cron-form-container');
    if (!container) return;
    container.innerHTML = `
      <div class="card" style="margin:8px 12px;border:1px solid var(--tg-theme-button-color,#4a9eff)">
        <div style="font-weight:600;margin-bottom:10px">Nuevo Cron Job</div>
        <input id="cron-name" class="tg-input" placeholder="Nombre (ej: daily-report)" style="margin-bottom:8px">
        <textarea id="cron-prompt" class="tg-input" rows="3" placeholder="Prompt / instrucción" style="margin-bottom:8px"></textarea>
        <input id="cron-skill" class="tg-input" placeholder="Skill (opcional, ej: kanban-worker)" style="margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <label style="font-size:.82rem;color:var(--tg-theme-hint-color,#888);white-space:nowrap">Cada</label>
          <input id="cron-minutes" class="tg-input" type="number" min="1" value="60" style="width:80px">
          <label style="font-size:.82rem;color:var(--tg-theme-hint-color,#888)">minutos</label>
        </div>
        <div style="display:flex;gap:8px">
          <button class="tg-button" style="flex:1" onclick="cronPage._createJob()">Crear</button>
          <button class="tg-button tg-button-secondary" style="flex:1" onclick="cronPage._closeForm()">Cancelar</button>
        </div>
      </div>`;
    container.scrollIntoView({ behavior: 'smooth' });
  },

  _closeForm() {
    const container = document.getElementById('cron-form-container');
    if (container) container.innerHTML = '';
  },

  async _createJob() {
    const name = (document.getElementById('cron-name')?.value || '').trim();
    const prompt = (document.getElementById('cron-prompt')?.value || '').trim();
    const skill = (document.getElementById('cron-skill')?.value || '').trim() || null;
    const minutes = parseInt(document.getElementById('cron-minutes')?.value || '60', 10);

    if (!name) { if (window.TG) TG.showAlert('El nombre es obligatorio'); return; }
    if (!prompt && !skill) { if (window.TG) TG.showAlert('Indica un prompt o skill'); return; }

    try {
      await API.post('/jobs', { name, prompt, skill, schedule_minutes: minutes });
      if (window.TG) TG.haptic && TG.haptic('success');
      await this._render();
    } catch (err) {
      if (window.TG) TG.showAlert('Error: ' + err.message);
    }
  },

  async _toggleSessions(jobId, btn) {
    const el = document.getElementById(`cron-sessions-${jobId}`);
    if (!el) return;
    if (el.style.display !== 'none') { el.style.display = 'none'; btn.textContent = '📋'; return; }
    el.style.display = 'block';
    btn.textContent = '▲';
    el.innerHTML = '<div class="tg-text-hint" style="font-size:.72rem">Cargando...</div>';
    try {
      const data = await API.get(`/jobs/${jobId}/sessions`);
      const sessions = data.sessions || [];
      if (sessions.length === 0) { el.innerHTML = '<div class="tg-text-hint" style="font-size:.72rem">Sin sesiones</div>'; return; }
      el.innerHTML = sessions.map(s => {
        const running = !s.ended_at;
        const dot = running ? '🟢' : (s.end_reason === 'error' ? '🔴' : '⚪');
        const label = s.title || s.id.slice(0, 20);
        return `<div style="padding:4px 0;cursor:pointer;font-size:.75rem;display:flex;gap:6px;align-items:center"
          onclick="Router.navigate('/sessions/${s.id}')">
          ${dot} <span>${this._esc(label)}</span>
          <span class="tg-text-hint" style="font-size:.68rem;margin-left:auto">${this._relTime(s.started_at)}</span>
        </div>`;
      }).join('');
    } catch (err) {
      el.innerHTML = `<div class="tg-text-hint" style="font-size:.72rem">Error: ${this._esc(err.message)}</div>`;
    }
  },

  async _runNow(jobId) {
    try {
      await API.post(`/jobs/${jobId}/run`, {});
      Toast.show('Job en cola ▶');
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  },

  async _toggle(jobId) {
    try {
      const res = await API.post(`/jobs/${jobId}/toggle`, {});
      await this._render();
      Toast.show(res.enabled ? 'Activado ✓' : 'Pausado ⏸');
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  },

  _relTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const diff = Math.round((d - Date.now()) / 1000);
    const abs = Math.abs(diff);
    const past = diff < 0;
    if (abs < 60) return past ? `hace ${abs}s` : `en ${abs}s`;
    if (abs < 3600) return past ? `hace ${Math.floor(abs/60)}m` : `en ${Math.floor(abs/60)}m`;
    if (abs < 86400) return past ? `hace ${Math.floor(abs/3600)}h` : `en ${Math.floor(abs/3600)}h`;
    return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  },

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },
};

Router.register('/cron', cronPage.handler.bind(cronPage));
