/**
 * Tasks page — tasks grouped by session
 * Each session container shows its tasks with status badges.
 * Clicking a task opens the session detail view.
 */
const tasksPage = {
  currentBoardId: null,
  _boardList: null,
  _initialLoadDone: false,

  async handler({ content, title, backBtn }) {
    title.textContent = 'Tasks';
    backBtn.classList.add('hidden');
    this._initialLoadDone = false;

    try {
      const { boards } = await API.get('/boards');
      this._boardList = boards;
      const boardList = boards.map(b => ({
        id: b.slug,
        name: b.name,
        task_count: b.total || 0,
      }));

      if (boardList.length === 0) {
        content.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>No boards available</p><p class="tg-text-hint">Create a board in the web dashboard first</p></div>';
        return;
      }

      content.innerHTML = `
        <div class="tasks-page">
          <div class="tasks-toolbar">
            <select id="tasks-board-filter" class="tg-input" style="width:auto;flex:1">
              ${boardList.map(b => '<option value="' + b.id + '">' + tasksPage._escape(b.name) + ' (' + (b.task_count || 0) + ' tasks)</option>').join('')}
            </select>
            <button id="btn-new-task" class="tg-button" style="width:auto;padding:10px 16px">+ New</button>
          </div>
          <div id="tasks-list"></div>
          <div id="task-form" class="hidden"></div>
        </div>`;

      document.getElementById('tasks-board-filter').addEventListener('change', (e) => {
        this.currentBoardId = e.target.value;
        this._loadTasks();
      });

      document.getElementById('btn-new-task').addEventListener('click', () => {
        if (!this.currentBoardId) {
          TG.showAlert('Select a board first');
          return;
        }
        this._showCreateForm();
      });

      // Auto-select first board
      this.currentBoardId = boardList[0].id;
      document.getElementById('tasks-board-filter').value = this.currentBoardId;
      this._initialLoadDone = true;
      this._loadTasks();

    } catch (err) {
      content.innerHTML = '<div class="error">Failed to load: ' + tasksPage._escape(err.message) + '</div>';
    }
  },

  async _loadTasks() {
    const listEl = document.getElementById('tasks-list');
    if (!this.currentBoardId || !this._initialLoadDone) {
      listEl.innerHTML = '<div class="empty-state"><p class="tg-text-hint">Select a board to see tasks</p></div>';
      return;
    }

    listEl.innerHTML = '<div class="loading">Loading tasks...</div>';
    try {
      const data = await API.get('/boards/' + this.currentBoardId);
      const columns = data.columns || [];
      const allTasks = [];
      columns.forEach(col => {
        (col.tasks || []).forEach(t => {
          allTasks.push({
            id: t.id,
            title: t.title,
            status: t.status || col.name,
            assignee: t.assignee,
            description: t.body || '',
          });
        });
      });

      if (allTasks.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>No tasks in this board</p><p class="tg-text-hint">Click "+ New" to create one</p></div>';
        return;
      }

      // Group tasks by status for display
      const statusGroups = { triage: [], todo: [], ready: [], running: [], blocked: [], done: [] };
      allTasks.forEach(t => {
        const group = t.status?.toLowerCase() || 'todo';
        if (statusGroups[group]) statusGroups[group].push(t);
        else statusGroups['todo'].push(t);
      });

      listEl.innerHTML = Object.entries(statusGroups)
        .filter(([_, tasks]) => tasks.length > 0)
        .map(([status, tasks]) => `
          <div class="task-session-container">
            <div class="task-session-header">${status}</div>
            ${tasks.map(t => `
              <div class="card task-card" onclick="tasksPage._openSessionForTask('${t.id}')">
                <div class="task-card-header">
                  <span class="task-title">${tasksPage._escape(t.title)}</span>
                  <span class="task-status tg-badge">${t.status || 'todo'}</span>
                </div>
                ${t.assignee ? '<div class="tg-text-hint">@ ' + tasksPage._escape(t.assignee) + '</div>' : ''}
                ${t.description ? '<div class="tg-text-hint task-desc">' + tasksPage._escape(t.description.substring(0, 100)) + '</div>' : ''}
              </div>
            `).join('')}
          </div>
        `).join('');

    } catch (err) {
      listEl.innerHTML = '<div class="error">Failed to load tasks: ' + tasksPage._escape(err.message) + '</div>';
    }
  },

  _openSessionForTask(taskId) {
    // Navigate to kanban board showing this task's context
    Router.navigate('/sessions/' + taskId);
  },

  _showCreateForm() {
    const formEl = document.getElementById('task-form');
    formEl.classList.remove('hidden');
    formEl.innerHTML = '<div class="card">' +
      '<h3>New Task</h3>' +
      '<input id="new-task-title" class="tg-input" placeholder="Task title" style="margin-bottom:8px">' +
      '<textarea id="new-task-desc" class="tg-input" placeholder="Description (optional)" rows="3" style="margin-bottom:8px"></textarea>' +
      '<div style="display:flex;gap:8px">' +
      '<button id="btn-save-task" class="tg-button">Save</button>' +
      '<button id="btn-cancel-task" class="tg-button tg-button-secondary">Cancel</button>' +
      '</div></div>';

    document.getElementById('btn-save-task').addEventListener('click', () => this._createTask());
    document.getElementById('btn-cancel-task').addEventListener('click', () => {
      formEl.classList.add('hidden');
    });
  },

  async _createTask() {
    const title = document.getElementById('new-task-title').value.trim();
    const description = document.getElementById('new-task-desc').value.trim();

    if (!title) {
      TG.showAlert('Title is required');
      return;
    }

    try {
      await API.post('/tasks', {
        title: title,
        body: description || undefined,
      });
      document.getElementById('task-form').classList.add('hidden');
      this._loadTasks();
      TG.haptic('success');
    } catch (err) {
      TG.showAlert('Failed to create task: ' + err.message);
    }
  },

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};

Router.register('/tasks', tasksPage.handler.bind(tasksPage));
