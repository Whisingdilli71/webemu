(function () {
  const STORAGE_KEY = 'webemu-theme';

const COLORS = {
  light:  { bg: '#ffffff', color: '#000000' },
  dark:   { bg: '#0b0b0b', color: '#e6eef8' },
  blue:   { bg: '#0d1117', color: '#e0eaff' },
  red:    { bg: '#0f0a0a', color: '#ffe8e8' },
  forest: { bg: '#0a0f0a', color: '#d4f0d4' },
};

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const c = COLORS[theme] || COLORS.light;
  document.documentElement.style.setProperty('background', c.bg, 'important');
  document.documentElement.style.setProperty('color', c.color, 'important');
  if (document.body) {
    document.body.style.setProperty('background', c.bg, 'important');
    document.body.style.setProperty('color', c.color, 'important');
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

  applyTheme(localStorage.getItem(STORAGE_KEY) || 'light');

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    const menu = document.createElement('div');
    menu.id = 'themeMenu';
    menu.innerHTML = `
      <button class="theme-opt" data-t="light">Light</button>
      <button class="theme-opt" data-t="dark">Dark</button>
      <button class="theme-opt" data-t="blue">Blue</button>
      <button class="theme-opt" data-t="red">Red</button>
      <button class="theme-opt" data-t="forest">Forest</button>
    `;
    document.body.appendChild(menu);

    toggle.addEventListener('click', e => {
      e.stopPropagation();
      const rect = toggle.getBoundingClientRect();
      menu.style.top   = (rect.bottom + 8) + 'px';
      menu.style.right = (window.innerWidth - rect.right) + 'px';
      menu.classList.toggle('open');
    });

    document.addEventListener('click', () => menu.classList.remove('open'));
    menu.addEventListener('click', e => e.stopPropagation());

    menu.querySelectorAll('.theme-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        applyTheme(btn.dataset.t);
        menu.classList.remove('open');
        updateActive();
      });
    });

    function updateActive() {
      const current = localStorage.getItem(STORAGE_KEY) || 'light';
      menu.querySelectorAll('.theme-opt').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.t === current);
      });
    }

    updateActive();
  });
})();