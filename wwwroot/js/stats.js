// Stats page: summary numbers plus a CSS bar chart for the last seven days.
(function () {
  if (!window.auth.requireAuth()) return;

  const els = {
    badge: document.getElementById('connection-badge'),
    notice: document.getElementById('offline-notice'),
    status: document.getElementById('status-message'),
    loading: document.getElementById('loading'),
    streak: document.getElementById('streak-value'),
    focus: document.getElementById('focus-value'),
    overdue: document.getElementById('overdue-value'),
    chart: document.getElementById('bar-chart')
  };

  function showStatus(message, isError = false) {
    els.status.textContent = message || '';
    els.status.className = `notice ${isError ? 'notice--error' : 'notice--info'}`;
    els.status.hidden = !message;
  }

  function updateConnectionUI() {
    const online = navigator.onLine;
    els.badge.textContent = online ? 'Online' : 'Offline';
    els.badge.classList.toggle('badge--online', online);
    els.badge.classList.toggle('badge--offline', !online);
    els.notice.hidden = online;
  }

  function weekdayLabel(dateString) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' })
      .format(new Date(`${dateString}T00:00:00`));
  }

  function renderChart(days) {
    const max = Math.max(1, ...days.map(day => day.count));
    els.chart.replaceChildren();

    const summary = days
      .map(day => `${weekdayLabel(day.date)} ${day.count}`)
      .join(', ');
    els.chart.setAttribute('aria-label', `Completed tasks in the last 7 days: ${summary}.`);

    days.forEach(day => {
      const column = document.createElement('div');
      column.className = 'bar-col';

      const value = document.createElement('span');
      value.className = 'bar-value';
      value.textContent = String(day.count);

      const track = document.createElement('div');
      track.className = 'bar-track';

      const fill = document.createElement('div');
      fill.className = 'bar-fill' + (day.count === 0 ? ' bar-fill--empty' : '');
      fill.style.height = `${Math.round((day.count / max) * 100)}%`;
      track.appendChild(fill);

      const label = document.createElement('span');
      label.className = 'bar-label';
      label.textContent = weekdayLabel(day.date);

      column.append(value, track, label);
      els.chart.appendChild(column);
    });
  }

  function render(stats) {
    els.streak.textContent = String(stats.currentStreak);
    els.focus.textContent = String(stats.focusMinutesThisWeek);
    els.overdue.textContent = String(stats.overdueCount);
    renderChart(stats.completedLast7Days);
    els.loading.hidden = true;
  }

  async function loadStats() {
    try {
      const stats = await api.stats.get();
      await localDb.setCache('stats', stats);
      render(stats);
      showStatus('');
    } catch (error) {
      if (error.status === 0) {
        const cached = await localDb.getCache('stats');
        if (cached) {
          render(cached);
          showStatus('Showing the last stats saved on this device.');
        } else {
          els.loading.hidden = true;
          showStatus('You are offline and no stats have been saved on this device yet.', true);
        }
      } else {
        els.loading.hidden = true;
        showStatus(error.message, true);
      }
    }
  }

  window.addEventListener('online', () => {
    updateConnectionUI();
    loadStats();
  });
  window.addEventListener('offline', updateConnectionUI);

  updateConnectionUI();
  loadStats();
})();
