/**
 * Long-press utility for copy-on-hold interaction.
 * Usage: LongPress.enable(element, onLongPress, duration)
 */
const LongPress = {
  enable(el, callback, duration = 600) {
    let timeout = null;

    const start = () => {
      timeout = setTimeout(() => {
        if (callback) callback();
        // Visual feedback
        el.style.opacity = '0.6';
      }, duration);
    };

    const cancel = () => {
      if (timeout) clearTimeout(timeout);
      el.style.opacity = '';
    };

    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseleave', cancel);
    el.addEventListener('touchstart', start);
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchcancel', cancel);
  },

  copy(text) {
    navigator.clipboard.writeText(text).then(() => {
      // Toast feedback
      if (window.Toast) Toast.show('✓ Copied');
    });
  },
};
