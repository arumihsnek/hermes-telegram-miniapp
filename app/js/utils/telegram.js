// Telegram SDK helpers
const TG = window.Telegram?.WebApp || {};

// Show an alert (supports both native and fallback)
TG.showAlert = TG.showAlert || function (msg) {
  alert(msg);
};

// Haptic feedback
TG.haptic = TG.haptic || function (type) {
  try { TG.HapticFeedback?.impactOccurred?.(type || 'medium'); } catch (e) {}
};

export { TG };
