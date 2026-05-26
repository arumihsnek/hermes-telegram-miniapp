/**
 * Toast notifications — lightweight in-app notifications
 * Replaces native alert dialogs for success/info/error messages.
 * Auto-dismisses after 3s, supports manual dismiss.
 */
const Toast = {
  _container: null,
  _timeout: null,

  _ensureContainer() {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.id = 'toast-container';
      this._container.className = 'toast-container';
      document.body.appendChild(this._container);
    }
    return this._container;
  },

  show(message, type = 'info', duration = 3000) {
    const container = this._ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span class="toast-text">${this._escape(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(toast);

    // Trigger slide-in animation
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-hiding');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  },

  success(msg, duration) { this.show(msg, 'success', duration); },
  error(msg, duration) { this.show(msg, 'error', duration); },
  info(msg, duration) { this.show(msg, 'info', duration); },

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
};
