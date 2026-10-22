// Shared authentication + theme helpers used on every page.
(function () {
  const TOKEN_KEY = 'tasknest_token';
  const USER_KEY = 'tasknest_user';
  const THEME_KEY = 'tasknest_theme';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function saveAuth(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // Cached API responses are user-specific, so drop them when the user changes.
  async function clearApiCaches() {
    if (!('caches' in window)) return;
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key => key.startsWith('tasknest-api')).map(key => caches.delete(key))
    );
  }

  function logout() {
    clearAuth();
    clearApiCaches();
    location.replace('/login.html');
  }

  function requireAuth() {
    if (!getToken()) {
      location.replace('/login.html');
      return false;
    }
    return true;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const isDark = theme === 'dark';
      button.setAttribute('aria-pressed', String(isDark));
      button.textContent = isDark ? 'Light mode' : 'Dark mode';
      button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function initTheme() {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
      });
    });
  }

  function initUser() {
    const user = getUser();
    document.querySelectorAll('[data-user-name]').forEach(element => {
      element.textContent = user ? user.name : '';
    });
    document.querySelectorAll('[data-logout]').forEach(button => {
      button.addEventListener('click', logout);
    });
  }

  function showFormError(message) {
    const box = document.getElementById('form-error');
    if (!box) return;
    box.textContent = message || '';
    box.hidden = !message;
  }

  function bindLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      showFormError('');

      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      if (!email || !password) {
        showFormError('Enter your email and password.');
        return;
      }

      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const data = await api.auth.login({ email, password });
        saveAuth(data);
        await clearApiCaches();
        location.replace('/index.html');
      } catch (error) {
        showFormError(error.message);
      } finally {
        submit.disabled = false;
      }
    });
  }

  function bindRegisterForm() {
    const form = document.getElementById('register-form');
    if (!form) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      showFormError('');

      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;

      if (!name) {
        showFormError('Enter your name.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFormError('Enter a valid email address.');
        return;
      }
      if (password.length < 8) {
        showFormError('Password must be at least 8 characters.');
        return;
      }

      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const data = await api.auth.register({ name, email, password });
        saveAuth(data);
        await clearApiCaches();
        location.replace('/index.html');
      } catch (error) {
        showFormError(error.message);
      } finally {
        submit.disabled = false;
      }
    });
  }

  initTheme();
  initUser();
  bindLoginForm();
  bindRegisterForm();

  if (getToken() && /\/(login|register)\.html$/.test(location.pathname)) {
    location.replace('/index.html');
  }

  window.auth = {
    getToken,
    getUser,
    saveAuth,
    clearAuth,
    logout,
    requireAuth,
    clearApiCaches
  };
})();
