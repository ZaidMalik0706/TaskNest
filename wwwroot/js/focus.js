// Focus page: a 25-minute countdown that logs a FocusSession when it finishes.
(function () {
  if (!window.auth.requireAuth()) return;

  const els = {
    badge: document.getElementById('connection-badge'),
    notice: document.getElementById('offline-notice'),
    status: document.getElementById('status-message'),
    task: document.getElementById('focus-task'),
    timer: document.getElementById('timer'),
    timerStatus: document.getElementById('timer-status'),
    start: document.getElementById('start-btn'),
    pause: document.getElementById('pause-btn'),
    reset: document.getElementById('reset-btn')
  };

  const SESSION_SECONDS = 25 * 60;
  let remaining = SESSION_SECONDS;
  let timerId = null;
  let startedAt = null;

  function showStatus(message, isError = true) {
    els.status.textContent = message || '';
    els.status.className = `notice ${isError ? 'notice--error' : 'notice--info'}`;
    els.status.hidden = !message;
  }

  function formatTime(totalSeconds) {
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function renderTimer() {
    els.timer.textContent = formatTime(remaining);
    els.timer.setAttribute('aria-label', `${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`);
  }

  function updateConnectionUI() {
    const online = navigator.onLine;
    els.badge.textContent = online ? 'Online' : 'Offline';
    els.badge.classList.toggle('badge--online', online);
    els.badge.classList.toggle('badge--offline', !online);
    els.notice.hidden = online;
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function setRunning(running) {
    els.start.disabled = running;
    els.pause.disabled = !running;
    els.task.disabled = running;
  }

  function startTimer() {
    const taskId = els.task.value;
    if (!taskId) {
      showStatus('Choose a task before starting a focus session.');
      return;
    }
    if (remaining <= 0) remaining = SESSION_SECONDS;
    if (!startedAt) startedAt = new Date().toISOString();

    showStatus('');
    setRunning(true);
    els.timerStatus.textContent = 'Focusing…';
    renderTimer();

    timerId = setInterval(() => {
      remaining -= 1;
      renderTimer();

      if (remaining <= 0) {
        stopTimer();
        completeSession(taskId);
      }
    }, 1000);
  }

  function pauseTimer() {
    stopTimer();
    setRunning(false);
    els.timerStatus.textContent = 'Paused. Your remaining time is kept.';
  }

  function resetTimer() {
    stopTimer();
    remaining = SESSION_SECONDS;
    startedAt = null;
    setRunning(false);
    els.timerStatus.textContent = 'Ready to start.';
    showStatus('');
    renderTimer();
  }

  async function completeSession(taskId) {
    els.timerStatus.textContent = 'Session complete.';
    setRunning(false);

    try {
      await api.focus.log({ taskId, minutes: 25, startedAt });
      startedAt = null;
      showStatus('Session complete — 25 focus minutes saved.', false);
    } catch (error) {
      // Keep the session visible even if it could not be saved.
      showStatus(error.status === 0
        ? 'Session finished, but you are offline. Reconnect to log it next time.'
        : error.message);
    }
  }

  async function loadTasks() {
    try {
      const tasks = await api.tasks.list();
      await localDb.setCache('tasks', tasks);
      populate(tasks);
    } catch (error) {
      if (error.status === 0) {
        const cached = await localDb.getCache('tasks');
        populate(cached || []);
        if (!cached) showStatus('You are offline and no tasks are saved on this device yet.');
      } else {
        showStatus(error.message);
      }
    }
  }

  function populate(tasks) {
    const active = tasks.filter(task => !task.isDone);
    const previous = els.task.value;

    els.task.replaceChildren(new Option('Select a task', ''));
    active.forEach(task => {
      els.task.appendChild(new Option(task.title, task.id));
    });

    if (previous && active.some(task => task.id === previous)) {
      els.task.value = previous;
    } else if (active.length === 0) {
      els.timerStatus.textContent = 'Add an active task first, then come back.';
    }
  }

  els.start.addEventListener('click', startTimer);
  els.pause.addEventListener('click', pauseTimer);
  els.reset.addEventListener('click', resetTimer);

  window.addEventListener('online', () => {
    updateConnectionUI();
    loadTasks();
  });
  window.addEventListener('offline', updateConnectionUI);

  updateConnectionUI();
  renderTimer();
  loadTasks();
})();
