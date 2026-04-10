const state = {
  me: null,
  publicData: null,
  users: [],
  events: [],
  notices: []
};

const $ = (selector) => document.querySelector(selector);

const toast = (message) => {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Errore richiesta');
  }
  return data;
}

function renderPublicSchedule() {
  const container = $('#publicSchedule');
  const events = state.publicData?.events || [];

  container.innerHTML = events.map(event => `
    <div class="schedule-item">
      <div>
        <strong>${event.title}</strong>
        <span>Attività della giornata educativa</span>
      </div>
      <strong>${event.event_time}</strong>
    </div>
  `).join('');
}

function renderPublicNotices() {
  const container = $('#publicNotices');
  const notices = state.publicData?.notices || [];
  container.innerHTML = notices.map(notice => `
    <article class="card">
      <h3>${notice.title}</h3>
      <p>${notice.content}</p>
    </article>
  `).join('');
}

async function loadPublicData() {
  state.publicData = await api('/api/public-info');
  renderPublicSchedule();
  renderPublicNotices();
}

function openLogin() {
  $('#loginModal').classList.remove('hidden');
}

function closeLogin() {
  $('#loginModal').classList.add('hidden');
}

function updateNavAuth() {
  const loggedIn = Boolean(state.me);
  $('#openLoginBtn').classList.toggle('hidden', loggedIn);
  $('#logoutNavBtn').classList.toggle('hidden', !loggedIn);
  $('#manageBtn').classList.toggle('hidden', !loggedIn);

  const greeting = $('#navGreeting');
  if (loggedIn) {
    greeting.textContent = `Ciao, ${state.me.first_name}`;
    greeting.classList.remove('hidden');
  } else {
    greeting.textContent = '';
    greeting.classList.add('hidden');
  }
}

function scrollToManagement() {
  const dashboard = $('#dashboard');
  if (!dashboard.classList.contains('hidden')) {
    dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderDashboard() {
  const dashboard = $('#dashboard');
  if (!state.me) {
    dashboard.classList.add('hidden');
    updateNavAuth();
    return;
  }

  dashboard.classList.remove('hidden');
  $('#dashboardTitle').textContent = `Benvenuto ${state.me.first_name} ${state.me.last_name}`;

  const adminOnly = document.querySelectorAll('.admin-only');
  adminOnly.forEach(el => {
    el.classList.toggle('hidden', state.me.role !== 'admin');
  });

  updateNavAuth();
}

function renderEventsList() {
  $('#eventsList').innerHTML = state.events.map(event => `
    <div class="admin-item">
      <div>
        <strong>${event.title}</strong>
        <span>${event.event_time}</span>
      </div>
      <div class="item-actions">
        <button class="action-btn edit-btn" onclick="editEvent(${event.id})">Modifica</button>
        <button class="action-btn delete-btn" onclick="deleteEvent(${event.id})">Elimina</button>
      </div>
    </div>
  `).join('');
}

function renderStaffList() {
  const staffList = $('#staffList');
  if (!staffList) return;
  staffList.innerHTML = state.users.map(user => `
    <div class="admin-item">
      <div>
        <strong>${user.first_name} ${user.last_name}</strong>
        <span>${user.email} • ${user.role}</span>
      </div>
      <div class="item-actions">
        <button class="action-btn edit-btn" onclick="editStaff(${user.id})">Modifica</button>
        <button class="action-btn delete-btn" onclick="deleteStaff(${user.id})">Elimina</button>
      </div>
    </div>
  `).join('');
}

function renderNoticesList() {
  const noticesList = $('#noticesList');
  if (!noticesList) return;
  noticesList.innerHTML = state.notices.map(notice => `
    <div class="admin-item">
      <div>
        <strong>${notice.title}</strong>
        <span>${notice.content}</span>
      </div>
      <div class="item-actions">
        <button class="action-btn edit-btn" onclick="editNotice(${notice.id})">Modifica</button>
        <button class="action-btn delete-btn" onclick="deleteNotice(${notice.id})">Elimina</button>
      </div>
    </div>
  `).join('');
}

async function loadPrivateData() {
  state.events = await api('/api/events');
  state.notices = await api('/api/notices');
  renderEventsList();
  renderNoticesList();

  if (state.me.role === 'admin') {
    state.users = await api('/api/users');
    renderStaffList();
  } else {
    state.users = [];
    renderStaffList();
  }
}

window.editEvent = (id) => {
  const event = state.events.find(item => item.id === id);
  $('#eventId').value = event.id;
  $('#eventTitle').value = event.title;
  $('#eventTime').value = event.event_time;
};

window.deleteEvent = async (id) => {
  if (!confirm('Eliminare questo evento?')) return;
  await api(`/api/events/${id}`, { method: 'DELETE' });
  toast('Evento eliminato');
  await refreshAll();
};

window.editStaff = (id) => {
  const user = state.users.find(item => item.id === id);
  $('#staffId').value = user.id;
  $('#staffFirstName').value = user.first_name;
  $('#staffLastName').value = user.last_name;
  $('#staffEmail').value = user.email;
  $('#staffPassword').value = '';
  $('#staffRole').value = user.role;
};

window.deleteStaff = async (id) => {
  if (!confirm('Eliminare questa persona?')) return;
  await api(`/api/users/${id}`, { method: 'DELETE' });
  toast('Persona eliminata');
  await refreshAll();
};

window.editNotice = (id) => {
  const notice = state.notices.find(item => item.id === id);
  $('#noticeId').value = notice.id;
  $('#noticeTitle').value = notice.title;
  $('#noticeContent').value = notice.content;
};

window.deleteNotice = async (id) => {
  if (!confirm('Eliminare questo avviso?')) return;
  await api(`/api/notices/${id}`, { method: 'DELETE' });
  toast('Avviso eliminato');
  await refreshAll();
};

async function refreshAll() {
  await loadPublicData();
  if (state.me) {
    await loadPrivateData();
  }
}

async function checkSession() {
  try {
    const data = await api('/api/me');
    state.me = data.user;
    renderDashboard();
    await loadPrivateData();
  } catch {
    state.me = null;
    renderDashboard();
    updateNavAuth();
  }
}

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('#' + btn.dataset.tab).classList.add('active');
    });
  });
}

function bindForms() {
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const email = $('#loginEmail').value.trim();
      const password = $('#loginPassword').value.trim();
      const data = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      state.me = data.user;
      closeLogin();
      toast('Login effettuato');
      renderDashboard();
      await loadPrivateData();
      scrollToManagement();
    } catch (error) {
      toast(error.message);
    }
  });

  const logout = async () => {
    await api('/api/logout', { method: 'POST' });
    state.me = null;
    state.users = [];
    state.events = [];
    state.notices = [];
    renderDashboard();
    updateNavAuth();
    toast('Logout effettuato');
  };

  $('#logoutBtn').addEventListener('click', logout);
  $('#logoutNavBtn').addEventListener('click', logout);

  $('#eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#eventId').value;
    const payload = {
      title: $('#eventTitle').value.trim(),
      event_time: $('#eventTime').value.trim()
    };

    if (id) {
      await api(`/api/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      toast('Evento aggiornato');
    } else {
      await api('/api/events', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      toast('Evento creato');
    }

    $('#eventForm').reset();
    $('#eventId').value = '';
    await refreshAll();
  });

  const staffForm = $('#staffForm');
  if (staffForm) {
    staffForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('#staffId').value;
      const payload = {
        first_name: $('#staffFirstName').value.trim(),
        last_name: $('#staffLastName').value.trim(),
        email: $('#staffEmail').value.trim(),
        password: $('#staffPassword').value.trim(),
        role: $('#staffRole').value
      };

      if (id) {
        await api(`/api/users/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast('Persona aggiornata');
      } else {
        await api('/api/users', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast('Persona aggiunta');
      }

      staffForm.reset();
      $('#staffId').value = '';
      await refreshAll();
    });
  }

  const noticeForm = $('#noticeForm');
  if (noticeForm) {
    noticeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('#noticeId').value;
      const payload = {
        title: $('#noticeTitle').value.trim(),
        content: $('#noticeContent').value.trim()
      };

      if (id) {
        await api(`/api/notices/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast('Avviso aggiornato');
      } else {
        await api('/api/notices', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast('Avviso creato');
      }

      noticeForm.reset();
      $('#noticeId').value = '';
      await refreshAll();
    });
  }
}

function bindUi() {
  $('#openLoginBtn').addEventListener('click', openLogin);
  $('#closeLoginBtn').addEventListener('click', closeLogin);
  $('#manageBtn').addEventListener('click', scrollToManagement);
  $('#loginModal').addEventListener('click', (e) => {
    if (e.target.id === 'loginModal') closeLogin();
  });
  $('#menuBtn').addEventListener('click', () => {
    $('#mainNav').classList.toggle('open');
  });
}

async function init() {
  bindUi();
  bindForms();
  bindTabs();
  updateNavAuth();
  await loadPublicData();
  await checkSession();
}

init();
