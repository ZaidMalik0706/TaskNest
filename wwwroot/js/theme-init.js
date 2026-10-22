// Runs before the page paints: applies the saved theme and guards private pages.
(function () {
  try {
    if (localStorage.getItem('tasknest_theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch { /* storage can be unavailable */ }

  const protectedPages = ['/', '/index.html', '/focus.html', '/stats.html'];
  if (protectedPages.includes(location.pathname) && !localStorage.getItem('tasknest_token')) {
    location.replace('/login.html');
  }
})();
