(function () {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark');
    }

    const toggle = document.getElementById('darkToggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark');
      document.documentElement.classList.toggle('dark', isDark);
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  });
})();