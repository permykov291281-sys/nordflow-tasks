/* NordFlow Tasks — клиентская часть (без фреймворков). */
(() => {
'use strict';

// ---------- справочники ----------
const STATUSES = [
  ['backlog', 'Бэклог'], ['planned', 'Запланировано'], ['progress', 'В работе'],
  ['review', 'На проверке'], ['done', 'Выполнено'],
];
const STATUS_RU = Object.fromEntries(STATUSES);
const PRIORITIES = [['low', 'Низкий'], ['medium', 'Средний'], ['high', 'Высокий'], ['critical', 'Критический']];
const PRIORITY_RU = Object.fromEntries(PRIORITIES);
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const PSTATUSES = [['planned', 'Планируется'], ['active', 'Активный'], ['paused', 'Приостановлен'], ['done', 'Завершён'], ['archived', 'Архивный']];
const PSTATUS_RU = Object.fromEntries(PSTATUSES);
const ROLES = [['admin', 'Администратор'], ['manager', 'Руководитель проекта'], ['employee', 'Сотрудник']];
const ROLE_RU = Object.fromEntries(ROLES);
const AVATAR_COLORS = ['#00A9A5', '#0B2E4F', '#4CC9F0', '#FF7A59', '#11395E', '#2E9F5B', '#8B5CF6', '#C27C0E'];

const ICON = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  projects: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5c2.4 0 4 1.6 4.5 4"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  clip: '<path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  chat: '<path d="M4 5h16v11H8l-4 4z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
};
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

// ---------- состояние ----------
let S = null; // данные с сервера
const UI = {
  myView: load('myView', 'list'),
  myFilters: { status: '', project: '', priority: '', due: '', overdue: false, q: '' },
  listFilters: { status: '', priority: '', assignee: '', q: '' },
  boardStatus: 'progress',
  taskId: null,
  notifOpen: false,
  sideOpen: false,
  search: '',
  showArchived: false,
};
function load(key, def) { try { return localStorage.getItem('nf.' + key) || def; } catch { return def; } }
function store(key, val) { try { localStorage.setItem('nf.' + key, val); } catch {} }

// ---------- утилиты ----------
const $ = (s, root = document) => root.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => { const d = new Date(); return ymd(d); };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function weekEndStr() { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return ymd(d); }
function monthEndStr() { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
function fmtDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`;
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return `${fmtDate(ymd(d))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function ago(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return fmtDateTime(iso);
}
const isOverdue = (t) => !!t.deadline && t.status !== 'done' && t.deadline < todayStr();
const user = (id) => S.users.find((u) => u.id === id);
const fullName = (u) => (u ? `${u.firstName} ${u.lastName}`.trim() : '—');
const project = (id) => S.projects.find((p) => p.id === id);
const task = (id) => S.tasks.find((t) => t.id === id);
const isAdmin = () => S.me.role === 'admin';
const canManage = (p) => !!p && (isAdmin() || p.managerId === S.me.id);
const canCreateIn = (p) => !!p && p.status !== 'archived' && (canManage(p) || p.allowMemberTasks);
const canStatus = (t) => canManage(project(t.projectId)) || t.assigneeId === S.me.id;
const activeUsers = () => S.users.filter((u) => u.active);
function avatar(u, size = '') {
  if (!u) return `<span class="avatar ${size}">?</span>`;
  if (u.avatar) return `<img class="avatar ${size}" src="${esc(u.avatar)}" alt="${esc(fullName(u))}">`;
  const color = AVATAR_COLORS[[...u.id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return `<span class="avatar ${size}" style="background:${color}" title="${esc(fullName(u))}">${esc((u.firstName[0] || '') + (u.lastName[0] || ''))}</span>`;
}
const prioBadge = (p) => `<span class="badge prio prio-${p}">${PRIORITY_RU[p]}</span>`;
const statusBadge = (s) => `<span class="badge st st-${s}">${STATUS_RU[s]}</span>`;
const pstatusBadge = (s) => `<span class="badge ps-${s}">${PSTATUS_RU[s]}</span>`;
const deadlineHtml = (t) => (t.deadline ? `<span class="${isOverdue(t) ? 'overdue-text' : ''}">${isOverdue(t) ? 'просрочено · ' : ''}${fmtDate(t.deadline)}</span>` : '<span class="muted">без срока</span>');
const options = (list, cur, empty) => (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') + list.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
const userOptions = (ids, cur, empty) => options(ids.map((id) => [id, fullName(user(id))]), cur, empty);
const projectTeam = (p) => [...new Set([p.managerId, ...p.members])].filter((id) => user(id)?.active);
const sortTasks = (list) => list.slice().sort((a, b) => (isOverdue(b) - isOverdue(a)) || ((a.deadline || '9999') < (b.deadline || '9999') ? -1 : (a.deadline || '9999') > (b.deadline || '9999') ? 1 : 0) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

function toast(msg, err = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.className = 'toast'), 2800);
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/api/login') { S = null; render(); throw new Error(data.error || 'Нужно войти'); }
  if (!res.ok) throw new Error(data.error || 'Ошибка ' + res.status);
  return data;
}
async function refresh() {
  try {
    S = await api('GET', '/api/bootstrap');
    document.documentElement.dataset.theme = S.me.theme || 'light';
  } catch { S = null; }
  render();
}
// Действие с сервером + обновление данных + сообщение об ошибке.
async function act(fn, okMsg) {
  try {
    await fn();
    if (okMsg) toast(okMsg);
    await refresh();
    return true;
  } catch (e) {
    toast(e.message, true);
    return false;
  }
}

// ---------- маршруты ----------
function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  return { name: parts[0], id: parts[1], tab: parts[2] };
}
const go = (hash) => { location.hash = hash; };

// ---------- отрисовка ----------
function render() {
  const app = $('#app');
  const focus = document.activeElement;
  const focusId = focus && focus.id;
  const sel = focus && 'selectionStart' in focus ? [focus.selectionStart, focus.selectionEnd] : null;
  const scrollDrawer = $('.drawer-body')?.scrollTop;

  if (!S) {
    document.documentElement.dataset.theme = 'light';
    app.innerHTML = loginView();
  } else {
    app.innerHTML = layout(pageView());
  }
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus(); if (sel && 'setSelectionRange' in el) try { el.setSelectionRange(sel[0], sel[1]); } catch {} }
  }
  if (scrollDrawer && $('.drawer-body')) $('.drawer-body').scrollTop = scrollDrawer;
}

function loginView() {
  return `
  <div class="login">
    <div class="login-card">
      <div class="login-logo"><img src="/img/logo-color.png" alt=""><b>NordFlow Tasks</b></div>
      <h2>Вход в рабочее пространство</h2>
      <p class="muted small" style="margin:4px 0 0">Аккаунты создаёт администратор компании.</p>
      <form id="login-form" autocomplete="on">
        <label class="field"><span>Электронная почта</span><input class="input" id="l-email" name="email" type="email" required autocomplete="username" placeholder="name@nordflow.io"></label>
        <label class="field"><span>Пароль</span>
          <div class="pw"><input class="input" id="l-pass" name="password" type="password" required autocomplete="current-password" placeholder="Пароль">
          <button type="button" data-act="toggle-pw" aria-label="Показать пароль">${icon('eye')}</button></div>
        </label>
        <div class="error" id="l-error"></div>
        <button class="btn primary" type="submit">Войти</button>
      </form>
      <div class="demo">
        <b>Демо-доступ</b>, пароль у всех: <code>nordflow</code><br>
        <button data-act="demo" data-email="anna@nordflow.io">Анна Волкова — администратор</button><br>
        <button data-act="demo" data-email="maxim@nordflow.io">Максим Орлов — руководитель проекта</button><br>
        <button data-act="demo" data-email="ilya@nordflow.io">Илья Морозов — сотрудник</button>
      </div>
    </div>
  </div>`;
}

function layout(content) {
  const r = route();
  const unread = S.notifications.filter((n) => !n.read).length;
  const nav = [
    ['home', 'Главная', 'home'], ['my', 'Мои задачи', 'tasks'], ['projects', 'Проекты', 'projects'],
    ['team', 'Команда', 'team'], ['notifications', 'Уведомления', 'bell'], ['profile', 'Профиль', 'user'],
  ];
  if (isAdmin()) nav.push(['admin', 'Пользователи', 'shield']);
  const active = r.name === 'project' ? 'projects' : r.name;
  return `
  <div class="layout">
    <aside class="side ${UI.sideOpen ? 'open' : ''}">
      <div class="brand"><img src="/img/logo-white.png" alt=""><div><b>NordFlow</b><small>Tasks</small></div></div>
      <nav class="nav">
        ${nav.map(([h, l, i]) => `<a href="#/${h}" class="${active === h ? 'active' : ''}">${icon(i)}<span>${l}</span>${h === 'notifications' && unread ? `<span class="badge count">${unread}</span>` : ''}</a>`).join('')}
      </nav>
      <div class="side-foot">NordFlow · ${ROLE_RU[S.me.role]}</div>
    </aside>
    ${UI.sideOpen ? '<div class="side-backdrop" data-act="side-close"></div>' : ''}
    <div class="main">
      <header class="top">
        <button class="btn icon ghost burger" data-act="side-open" aria-label="Меню">${icon('menu')}</button>
        <div class="search">
          ${icon('search')}
          <input class="input" id="g-search" type="search" placeholder="Поиск задач, проектов, сотрудников" value="${esc(UI.search)}" autocomplete="off">
          ${UI.search.trim().length > 1 ? searchResults() : ''}
        </div>
        <div class="top-right">
          <div class="bell">
            <button class="btn icon ghost" data-act="notif-toggle" aria-label="Уведомления">${icon('bell')}</button>
            ${unread ? `<span class="dot">${unread > 99 ? '99+' : unread}</span>` : ''}
            ${UI.notifOpen ? notifPopover() : ''}
          </div>
          <button class="btn ghost" data-act="go" data-href="#/profile" style="padding:0 8px">${avatar(S.me)}<span class="me-name">${esc(S.me.firstName)}</span></button>
        </div>
      </header>
      <main class="content">${content}</main>
    </div>
  </div>
  ${UI.taskId && task(UI.taskId) ? taskDrawer(task(UI.taskId)) : ''}`;
}

function pageView() {
  const r = route();
  switch (r.name) {
    case 'my': return myTasksView();
    case 'projects': return projectsView();
    case 'project': return projectView(r.id, r.tab || 'board');
    case 'team': return r.id ? personView(r.id) : teamView();
    case 'notifications': return notificationsView();
    case 'profile': return profileView();
    case 'admin': return isAdmin() ? adminView() : forbidden();
    default: return homeView();
  }
}
const forbidden = () => `<div class="card pad empty">Раздел доступен только администратору.</div>`;

// ---------- главная ----------
function homeView() {
  const mine = S.tasks.filter((t) => t.assigneeId === S.me.id && t.status !== 'done');
  const overdue = mine.filter(isOverdue);
  const week = mine.filter((t) => t.deadline && t.deadline >= todayStr() && t.deadline <= weekEndStr());
  const upcoming = sortTasks(mine.filter((t) => t.deadline)).slice(0, 6);
  const updates = S.tasks.flatMap((t) => t.history.map((h) => ({ ...h, t }))).concat(
    S.comments.map((c) => ({ at: c.at, userId: c.userId, text: 'прокомментировал(а)', t: task(c.taskId) })),
  ).filter((x) => x.t).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);
  const myProjects = S.projects.filter((p) => p.status !== 'archived' && (p.managerId === S.me.id || p.members.includes(S.me.id) || isAdmin()));
  const managed = S.projects.filter((p) => p.managerId === S.me.id && p.status !== 'archived');
  const hour = new Date().getHours();
  const hello = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  return `
  <div class="page-head"><div class="grow"><h1>${hello}, ${esc(S.me.firstName)}</h1><div class="muted">${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div></div>
  <div class="stats">
    <div class="card stat" data-act="go" data-href="#/my"><b>${mine.length}</b><span class="muted">активных задач</span></div>
    <div class="card stat ${overdue.length ? 'warn' : ''}" data-act="my-overdue"><b>${overdue.length}</b><span class="muted">просрочено</span></div>
    <div class="card stat" data-act="my-week"><b>${week.length}</b><span class="muted">завершить на этой неделе</span></div>
  </div>
  <div class="cols">
    <div>
      <section class="card pad"><h2>Ближайшие дедлайны</h2>
        ${upcoming.length ? upcoming.map((t) => `
          <div class="list-row" data-act="open-task" data-id="${t.id}">
            <span class="key">${t.key}</span><span class="title">${esc(t.title)}</span>${prioBadge(t.priority)}<span class="small">${deadlineHtml(t)}</span>
          </div>`).join('') : '<div class="empty">Задач со сроком нет</div>'}
      </section>
      <section class="card pad"><h2>Последние обновления</h2>
        ${updates.length ? updates.map((u) => `
          <div class="list-row" data-act="open-task" data-id="${u.t.id}">
            ${avatar(user(u.userId), 'sm')}
            <span class="title" style="font-weight:400"><b>${esc(fullName(user(u.userId)))}</b> ${esc(u.text)} · <span class="key">${u.t.key}</span> ${esc(u.t.title)}</span>
            <span class="small muted">${ago(u.at)}</span>
          </div>`).join('') : '<div class="empty">Пока пусто</div>'}
      </section>
    </div>
    <div>
      <section class="card pad"><h2>Мои проекты</h2>
        ${myProjects.length ? myProjects.map((p) => {
          const pt = S.tasks.filter((t) => t.projectId === p.id);
          const done = pt.filter((t) => t.status === 'done').length;
          return `<div class="list-row" data-act="go" data-href="#/project/${p.id}/board" style="flex-direction:column;align-items:stretch;gap:8px">
            <div style="display:flex;gap:8px;align-items:center"><span class="title">${esc(p.name)}</span>${pstatusBadge(p.status)}</div>
            <div class="progress"><i style="width:${pt.length ? Math.round((done / pt.length) * 100) : 0}%"></i></div>
            <div class="small muted">${done} из ${pt.length} задач выполнено</div></div>`;
        }).join('') : '<div class="empty">Вас пока не добавили в проекты</div>'}
      </section>
      ${managed.length ? `<section class="card pad"><h2>Сводка по команде</h2>
        ${managed.map((p) => {
          const pt = S.tasks.filter((t) => t.projectId === p.id);
          return `<div class="list-row" data-act="go" data-href="#/project/${p.id}/board" style="flex-wrap:wrap">
            <span class="title" style="flex-basis:100%">${esc(p.name)}</span>
            ${STATUSES.map(([s, l]) => `<span class="badge st st-${s}">${l}: ${pt.filter((t) => t.status === s).length}</span>`).join('')}
            <span class="badge" style="color:var(--danger)">Просрочено: ${pt.filter(isOverdue).length}</span>
          </div>`;
        }).join('')}
      </section>` : ''}
    </div>
  </div>`;
}

// ---------- мои задачи ----------
function applyFilters(list, f) {
  const q = (f.q || '').trim().toLowerCase();
  return list.filter((t) =>
    (!f.status || t.status === f.status) &&
    (!f.project || t.projectId === f.project) &&
    (!f.priority || t.priority === f.priority) &&
    (!f.assignee || t.assigneeId === f.assignee) &&
    (!f.overdue || isOverdue(t)) &&
    (!q || t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q)) &&
    (!f.due ||
      (f.due === 'today' && t.deadline === todayStr()) ||
      (f.due === 'week' && t.deadline && t.deadline <= weekEndStr()) ||
      (f.due === 'month' && t.deadline && t.deadline <= monthEndStr()) ||
      (f.due === 'none' && !t.deadline)),
  );
}
function myTasksView() {
  const f = UI.myFilters;
  const mine = S.tasks.filter((t) => t.assigneeId === S.me.id);
  const list = sortTasks(applyFilters(mine, f));
  const myProjects = [...new Set(mine.map((t) => t.projectId))].map(project).filter(Boolean);
  return `
  <div class="page-head"><h1 class="grow">Мои задачи</h1>
    <div class="seg"><button data-act="my-view" data-v="list" class="${UI.myView === 'list' ? 'on' : ''}">Список</button><button data-act="my-view" data-v="board" class="${UI.myView === 'board' ? 'on' : ''}">Доска</button></div>
  </div>
  <div class="filters">
    <input class="input search-local" id="mf-q" data-filter="my.q" type="search" placeholder="Поиск по названию" value="${esc(f.q)}">
    <select class="input" id="mf-status" data-filter="my.status">${options(STATUSES, f.status, 'Все статусы')}</select>
    <select class="input" id="mf-project" data-filter="my.project">${options(myProjects.map((p) => [p.id, p.name]), f.project, 'Все проекты')}</select>
    <select class="input" id="mf-priority" data-filter="my.priority">${options(PRIORITIES, f.priority, 'Любой приоритет')}</select>
    <select class="input" id="mf-due" data-filter="my.due">${options([['today', 'Срок сегодня'], ['week', 'До конца недели'], ['month', 'До конца месяца'], ['none', 'Без срока']], f.due, 'Любой срок')}</select>
    <label class="check"><input type="checkbox" id="mf-overdue" data-filter="my.overdue" ${f.overdue ? 'checked' : ''}> Только просроченные</label>
  </div>
  ${UI.myView === 'board' ? board(list) : taskTable(list, { project: true, assignee: false })}`;
}

function taskTable(list, cols) {
  if (!list.length) return '<div class="card pad empty">Задач не найдено</div>';
  return `<div class="card table-wrap"><table class="table">
    <thead><tr><th>Задача</th>${cols.project ? '<th>Проект</th>' : ''}<th>Статус</th><th>Приоритет</th><th>Срок</th>${cols.assignee ? '<th>Исполнитель</th>' : ''}<th>Постановщик</th></tr></thead>
    <tbody>${list.map((t) => `
      <tr class="click ${isOverdue(t) ? 'is-overdue' : ''}" data-act="open-task" data-id="${t.id}">
        <td><div class="key">${t.key}</div><b style="font-weight:600">${esc(t.title)}</b></td>
        ${cols.project ? `<td data-label="Проект">${esc(project(t.projectId)?.name)}</td>` : ''}
        <td data-label="Статус">${statusBadge(t.status)}</td>
        <td data-label="Приоритет">${prioBadge(t.priority)}</td>
        <td data-label="Срок">${deadlineHtml(t)}</td>
        ${cols.assignee ? `<td data-label="Исполнитель">${esc(fullName(user(t.assigneeId)))}</td>` : ''}
        <td data-label="Постановщик">${esc(fullName(user(t.reporterId)))}</td>
      </tr>`).join('')}</tbody></table></div>`;
}

function board(list) {
  return `
  <div class="status-tabs">${STATUSES.map(([s, l]) => `<button data-act="board-status" data-s="${s}" class="${UI.boardStatus === s ? 'on' : ''}">${l} · ${list.filter((t) => t.status === s).length}</button>`).join('')}</div>
  <div class="board">
    ${STATUSES.map(([s, l]) => {
      const col = list.filter((t) => t.status === s);
      return `<div class="column ${UI.boardStatus === s ? 'cur' : ''}" data-status="${s}">
        <div class="column-head">${l}<span class="badge">${col.length}</span></div>
        ${col.map(taskCard).join('') || '<div class="empty small">Пусто</div>'}
      </div>`;
    }).join('')}
  </div>`;
}
function taskCard(t) {
  const comments = S.comments.filter((c) => c.taskId === t.id).length;
  return `<div class="tcard ${isOverdue(t) ? 'overdue' : ''} ${canStatus(t) ? 'draggable' : ''}" data-act="open-task" data-id="${t.id}" data-drag="${canStatus(t) ? 1 : ''}">
    <div class="row"><span class="key">${t.key}</span>${prioBadge(t.priority)}</div>
    <div class="t">${esc(t.title)}</div>
    <div class="meta">
      <span title="${isOverdue(t) ? 'Просрочено' : 'Дедлайн'}">${icon('clock', 'ic')} ${t.deadline ? `<span class="${isOverdue(t) ? 'overdue-text' : ''}">${fmtDate(t.deadline)}</span>` : 'без срока'}</span>
      ${comments ? `<span title="Комментарии">💬 ${comments}</span>` : ''}
      ${t.attachments.length ? `<span title="Вложения">📎 ${t.attachments.length}</span>` : ''}
      ${avatar(user(t.assigneeId), 'sm')}
    </div>
  </div>`;
}

// ---------- проекты ----------
function projectsView() {
  const list = S.projects.filter((p) => UI.showArchived || p.status !== 'archived');
  return `
  <div class="page-head"><h1 class="grow">Проекты</h1>
    <label class="check"><input type="checkbox" data-act="toggle-archived" ${UI.showArchived ? 'checked' : ''}> Показать архивные</label>
    ${isAdmin() ? `<button class="btn primary" data-act="project-new">${icon('plus')} Создать проект</button>` : ''}
  </div>
  ${list.length ? `<div class="projects">${list.map(projectCard).join('')}</div>` : '<div class="card pad empty">Нет доступных проектов</div>'}`;
}
function projectCard(p) {
  const pt = S.tasks.filter((t) => t.projectId === p.id);
  const open = pt.filter((t) => t.status !== 'done').length;
  const done = pt.length - open;
  return `<div class="card project-card" data-act="go" data-href="#/project/${p.id}/board">
    <div style="display:flex;gap:8px;align-items:flex-start"><h2 style="flex:1;margin:0">${esc(p.name)}</h2>${pstatusBadge(p.status)}</div>
    <p>${esc(p.description || 'Без описания')}</p>
    <div class="progress"><i style="width:${pt.length ? Math.round((done / pt.length) * 100) : 0}%"></i></div>
    <div class="project-meta">
      <span>Руководитель: <b>${esc(fullName(user(p.managerId)))}</b></span>
      <span>Открытых задач: <b>${open}</b></span>
      <span>Участников: <b>${projectTeam(p).length}</b></span>
      <span>Завершение: <b>${fmtDate(p.endDate)}</b></span>
    </div>
  </div>`;
}

function projectView(id, tab) {
  const p = project(id);
  if (!p) return '<div class="card pad empty">Проект не найден или у вас нет к нему доступа.</div>';
  const pt = S.tasks.filter((t) => t.projectId === p.id);
  const tabs = [['board', 'Доска'], ['list', 'Список задач'], ['members', 'Участники'], ['info', 'Информация о проекте']];
  let body = '';
  if (tab === 'board') body = board(pt);
  else if (tab === 'list') {
    const f = UI.listFilters;
    body = `<div class="filters">
      <input class="input search-local" id="lf-q" data-filter="list.q" type="search" placeholder="Поиск по названию" value="${esc(f.q)}">
      <select class="input" id="lf-status" data-filter="list.status">${options(STATUSES, f.status, 'Все статусы')}</select>
      <select class="input" id="lf-priority" data-filter="list.priority">${options(PRIORITIES, f.priority, 'Любой приоритет')}</select>
      <select class="input" id="lf-assignee" data-filter="list.assignee">${userOptions(projectTeam(p), f.assignee, 'Все исполнители')}</select>
    </div>${taskTable(sortTasks(applyFilters(pt, f)), { project: false, assignee: true })}`;
  } else if (tab === 'members') {
    body = `<div class="card table-wrap"><table class="table"><thead><tr><th>Сотрудник</th><th>Роль в проекте</th><th>Активных задач</th><th>Просрочено</th></tr></thead><tbody>
      ${projectTeam(p).map((uid) => {
        const u = user(uid);
        const ut = pt.filter((t) => t.assigneeId === uid && t.status !== 'done');
        return `<tr class="click" data-act="go" data-href="#/team/${uid}"><td><div style="display:flex;gap:10px;align-items:center">${avatar(u)}<div><b>${esc(fullName(u))}</b><div class="small muted">${esc(u.position)}</div></div></div></td>
          <td data-label="Роль">${uid === p.managerId ? '<span class="badge ps-active">Руководитель</span>' : 'Участник'}</td>
          <td data-label="Активных задач">${ut.length}</td><td data-label="Просрочено">${ut.filter(isOverdue).length || '—'}</td></tr>`;
      }).join('')}</tbody></table></div>
      ${canManage(p) ? `<p><button class="btn" data-act="project-edit" data-id="${p.id}">${icon('plus')} Добавить участников</button></p>` : ''}`;
  } else {
    body = `<div class="card pad"><div class="props">
      <span>Описание</span><div class="desc">${esc(p.description || '—')}</div>
      <span>Руководитель</span><div>${esc(fullName(user(p.managerId)))}</div>
      <span>Статус</span><div>${pstatusBadge(p.status)}</div>
      <span>Дата начала</span><div>${fmtDate(p.startDate)}</div>
      <span>Плановое завершение</span><div>${fmtDate(p.endDate)}</div>
      <span>Задач всего</span><div>${pt.length} · выполнено ${pt.filter((t) => t.status === 'done').length} · просрочено ${pt.filter(isOverdue).length}</div>
      <span>Задачи сотрудников</span><div>${p.allowMemberTasks ? 'Участники могут создавать задачи' : 'Задачи создаёт только руководитель'}</div>
    </div></div>`;
  }
  return `
  <div class="page-head">
    <div class="grow"><div class="small muted"><a href="#/projects">Проекты</a> / ${esc(p.name)}</div><h1>${esc(p.name)} ${pstatusBadge(p.status)}</h1></div>
    ${canManage(p) ? `<button class="btn" data-act="project-edit" data-id="${p.id}">${icon('edit')} Редактировать</button>` : ''}
    ${canCreateIn(p) ? `<button class="btn primary" data-act="task-new" data-project="${p.id}">${icon('plus')} Создать задачу</button>` : ''}
  </div>
  <div class="tabs">${tabs.map(([t, l]) => `<a href="#/project/${p.id}/${t}" class="${tab === t ? 'on' : ''}">${l}</a>`).join('')}</div>
  ${body}`;
}

// ---------- задача ----------
function taskDrawer(t) {
  const p = project(t.projectId);
  const mgr = canManage(p);
  const own = t.assigneeId === S.me.id;
  const comments = S.comments.filter((c) => c.taskId === t.id).sort((a, b) => (a.at < b.at ? -1 : 1));
  const dis = mgr ? '' : 'disabled';
  return `
  <div class="overlay" data-act="close-task"></div>
  <aside class="drawer" role="dialog" aria-label="Задача ${t.key}">
    <div class="drawer-head">
      <span class="key">${t.key}</span><a href="#/project/${p.id}/board" data-act="close-task" class="small">${esc(p.name)}</a>
      <span style="margin-left:auto"></span>
      ${mgr ? `<button class="btn sm ghost danger" data-act="task-delete" data-id="${t.id}">${icon('trash')}</button>` : ''}
      <button class="btn icon ghost" data-act="close-task" aria-label="Закрыть">${icon('close')}</button>
    </div>
    <div class="drawer-body">
      ${mgr ? `<input class="input" id="t-title" data-tfield="title" value="${esc(t.title)}" style="font:700 20px var(--head);min-height:48px">` : `<h1>${esc(t.title)}</h1>`}
      ${isOverdue(t) ? '<div class="badge" style="background:rgba(229,72,77,.12);color:var(--danger);align-self:flex-start">Задача просрочена</div>' : ''}
      <div class="props">
        <span>Статус</span><select class="input" id="t-status" data-tfield="status" ${canStatus(t) ? '' : 'disabled'}>${options(STATUSES, t.status)}</select>
        <span>Приоритет</span><select class="input" id="t-priority" data-tfield="priority" ${dis}>${options(PRIORITIES, t.priority)}</select>
        <span>Исполнитель</span><select class="input" id="t-assignee" data-tfield="assigneeId" ${dis}>${userOptions(projectTeam(p), t.assigneeId)}</select>
        <span>Дедлайн</span><input class="input" id="t-deadline" type="date" data-tfield="deadline" value="${esc(t.deadline)}" ${dis}>
        <span>Теги</span>${mgr ? `<input class="input" id="t-tags" data-tfield="tags" value="${esc(t.tags.join(', '))}" placeholder="через запятую">` : `<div>${t.tags.map((g) => `<span class="badge tag">${esc(g)}</span>`).join(' ') || '—'}</div>`}
        <span>Проект</span><div>${esc(p.name)}</div>
        <span>Постановщик</span><div style="display:flex;gap:8px;align-items:center">${avatar(user(t.reporterId), 'sm')} ${esc(fullName(user(t.reporterId)))}</div>
        <span>Создана</span><div>${fmtDateTime(t.createdAt)}</div>
      </div>
      <section><h3 style="margin-bottom:8px">Описание</h3>
        ${mgr ? `<textarea class="input" id="t-desc" data-tfield="description" placeholder="Подробное описание задачи">${esc(t.description)}</textarea>` : `<div class="desc">${esc(t.description) || '<span class="muted">Нет описания</span>'}</div>`}
      </section>
      <section><h3 style="margin-bottom:8px">Вложения</h3>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${t.attachments.map((a) => `<div class="att">${icon(a.type === 'link' ? 'link' : 'clip')}<a href="${a.type === 'link' ? esc(a.url) : '/files/' + a.id}" target="_blank" rel="noopener">${esc(a.name)}</a>
            ${mgr || own ? `<button class="btn sm ghost" data-act="att-delete" data-id="${a.id}" aria-label="Удалить">${icon('close')}</button>` : ''}</div>`).join('') || '<div class="muted small">Нет вложений</div>'}
        </div>
        ${mgr || own ? `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <input class="input" id="att-url" placeholder="https://ссылка" style="flex:1;min-width:180px">
          <button class="btn" data-act="att-link">${icon('link')} Добавить ссылку</button>
          <label class="btn">${icon('clip')} Файл<input type="file" id="att-file" hidden></label>
        </div>` : ''}
      </section>
      <section><h3 style="margin-bottom:10px">Комментарии · ${comments.length}</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${comments.map((c) => commentHtml(c)).join('') || '<div class="muted small">Комментариев пока нет</div>'}
        </div>
        <div class="comment" style="margin-top:12px">${avatar(S.me)}<div style="flex:1;display:flex;flex-direction:column;gap:8px">
          <textarea class="input" id="c-new" placeholder="Написать комментарий…" style="min-height:70px"></textarea>
          <button class="btn teal" data-act="comment-add" style="align-self:flex-end">Отправить</button>
        </div></div>
      </section>
      <section><h3 style="margin-bottom:8px">История изменений</h3>
        <div class="history">${t.history.slice().reverse().map((h) => `<div><b>${esc(fullName(user(h.userId)))}</b> ${esc(h.text)} · ${fmtDateTime(h.at)}</div>`).join('')}</div>
      </section>
    </div>
  </aside>`;
}
function commentHtml(c) {
  const u = user(c.userId);
  const mine = c.userId === S.me.id;
  const editing = UI.editComment === c.id;
  return `<div class="comment">${avatar(u)}<div class="bubble">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px"><b>${esc(fullName(u))}</b><span class="small muted">${fmtDateTime(c.at)}${c.editedAt ? ' · изменён' : ''}</span>
      <span class="comment-actions">
        ${mine && !editing ? `<button class="btn sm ghost" data-act="comment-edit" data-id="${c.id}" aria-label="Редактировать">${icon('edit')}</button>` : ''}
        ${mine || isAdmin() ? `<button class="btn sm ghost danger" data-act="comment-delete" data-id="${c.id}" aria-label="Удалить">${icon('trash')}</button>` : ''}
      </span></div>
    ${editing ? `<textarea class="input" id="c-edit">${esc(c.text)}</textarea><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button class="btn sm" data-act="comment-cancel">Отмена</button><button class="btn sm teal" data-act="comment-save" data-id="${c.id}">Сохранить</button></div>` : `<div class="text">${esc(c.text)}</div>`}
  </div></div>`;
}

// ---------- команда ----------
function teamView() {
  const people = activeUsers();
  return `<div class="page-head"><h1 class="grow">Команда</h1><span class="muted">${people.length} сотрудников</span></div>
  <div class="people">${people.map((u) => {
    const ut = S.tasks.filter((t) => t.assigneeId === u.id && t.status !== 'done');
    const over = ut.filter(isOverdue).length;
    const loadPct = Math.min(100, Math.round((ut.length / 6) * 100));
    const cls = loadPct >= 100 ? 'load-over' : loadPct >= 67 ? 'load-high' : '';
    return `<div class="card person" data-act="go" data-href="#/team/${u.id}">
      <div class="who">${avatar(u)}<div><b>${esc(fullName(u))}</b><div class="small muted">${esc(u.position || ROLE_RU[u.role])}</div></div></div>
      <div class="small muted">${esc(u.email)}</div>
      <div class="load"><span>Активных: <b>${ut.length}</b></span><span class="${over ? 'overdue-text' : 'muted'}">Просрочено: ${over}</span></div>
      <div class="progress ${cls}"><i style="width:${loadPct}%"></i></div>
      <div class="small muted">Загрузка: ${loadPct >= 100 ? 'перегружен(а)' : loadPct >= 67 ? 'высокая' : loadPct >= 34 ? 'нормальная' : 'низкая'}</div>
    </div>`;
  }).join('')}</div>`;
}
function personView(id) {
  const u = user(id);
  if (!u) return '<div class="card pad empty">Сотрудник не найден</div>';
  const ut = sortTasks(S.tasks.filter((t) => t.assigneeId === u.id && t.status !== 'done'));
  const canSee = isAdmin() || S.me.role === 'manager' || u.id === S.me.id;
  return `<div class="page-head"><div class="grow"><div class="small muted"><a href="#/team">Команда</a> / ${esc(fullName(u))}</div></div></div>
  <div class="card pad" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-bottom:16px">${avatar(u, 'lg')}
    <div style="flex:1"><h1>${esc(fullName(u))}</h1><div class="muted">${esc(u.position)} · ${ROLE_RU[u.role]}</div><div><a href="mailto:${esc(u.email)}">${esc(u.email)}</a></div></div>
    <div class="stats" style="margin:0;grid-template-columns:repeat(2,auto)"><div class="stat" style="padding:0 12px"><b>${ut.length}</b><span class="muted small">активных</span></div><div class="stat warn" style="padding:0 12px"><b>${ut.filter(isOverdue).length}</b><span class="muted small">просрочено</span></div></div>
  </div>
  ${canSee ? `<h2 style="margin-bottom:12px">Активные задачи</h2>${taskTable(ut, { project: true, assignee: false })}` : '<div class="card pad muted">Список задач сотрудника доступен руководителям.</div>'}`;
}

// ---------- уведомления ----------
const NICON = { assigned: 'tasks', comment: 'chat', status: 'projects', deadline: 'clock', soon: 'clock', overdue: 'clock', project: 'projects' };
function notifItem(n) {
  return `<div class="notif ${n.read ? '' : 'unread'}" data-act="notif-open" data-id="${n.id}">
    <span class="nicon" style="${n.type === 'overdue' ? 'color:var(--danger)' : ''}">${icon(NICON[n.type] || 'bell')}</span>
    <div><div class="ntext">${esc(n.text)}</div><div class="small muted">${ago(n.at)}</div></div></div>`;
}
function notifPopover() {
  const list = S.notifications.slice(0, 8);
  return `<div class="card notif-pop">
    <div style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)"><b style="flex:1">Уведомления</b><button class="btn sm ghost" data-act="notif-readall">Прочитать все</button></div>
    ${list.map(notifItem).join('') || '<div class="empty">Новых уведомлений нет</div>'}
    <div style="padding:10px 16px;border-top:1px solid var(--line)"><a href="#/notifications" data-act="notif-close">Все уведомления</a></div>
  </div>`;
}
function notificationsView() {
  return `<div class="page-head"><h1 class="grow">Уведомления</h1><button class="btn" data-act="notif-readall">Отметить все прочитанными</button></div>
  <div class="card">${S.notifications.map(notifItem).join('') || '<div class="empty">Уведомлений пока нет</div>'}</div>`;
}

// ---------- профиль ----------
function profileView() {
  const u = S.me;
  return `<div class="page-head"><h1 class="grow">Профиль</h1><button class="btn" data-act="logout">${icon('logout')} Выйти</button></div>
  <div class="cols">
    <div><section class="card pad">
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:18px">${avatar(u, 'lg')}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><label class="btn sm">Загрузить фото<input type="file" id="avatar-file" accept="image/*" hidden></label>${u.avatar ? '<button class="btn sm ghost" data-act="avatar-remove">Удалить</button>' : ''}</div></div>
      <form id="profile-form" style="display:flex;flex-direction:column;gap:14px">
        <div class="grid2"><label class="field"><span>Имя</span><input class="input" name="firstName" value="${esc(u.firstName)}" required></label>
        <label class="field"><span>Фамилия</span><input class="input" name="lastName" value="${esc(u.lastName)}"></label></div>
        <label class="field"><span>Должность</span><input class="input" name="position" value="${esc(u.position)}"></label>
        <div class="grid2"><label class="field"><span>Электронная почта</span><input class="input" value="${esc(u.email)}" disabled></label>
        <label class="field"><span>Роль</span><input class="input" value="${ROLE_RU[u.role]}" disabled></label></div>
        <div class="small muted">Почту и роль меняет администратор.</div>
        <button class="btn teal" style="align-self:flex-start">Сохранить</button>
      </form>
    </section></div>
    <div>
      <section class="card pad"><h2>Тема интерфейса</h2>
        <div class="seg"><button data-act="theme" data-v="light" class="${u.theme !== 'dark' ? 'on' : ''}">${icon('sun', 'ic')} Светлая</button><button data-act="theme" data-v="dark" class="${u.theme === 'dark' ? 'on' : ''}">Тёмная</button></div>
      </section>
      <section class="card pad"><h2>Смена пароля</h2>
        <form id="password-form" style="display:flex;flex-direction:column;gap:12px">
          <label class="field"><span>Текущий пароль</span><input class="input" type="password" name="oldPassword" required autocomplete="current-password"></label>
          <label class="field"><span>Новый пароль</span><input class="input" type="password" name="newPassword" required minlength="6" autocomplete="new-password"></label>
          <button class="btn" style="align-self:flex-start">Изменить пароль</button>
        </form>
      </section>
    </div>
  </div>`;
}

// ---------- администрирование ----------
function adminView() {
  return `<div class="page-head"><h1 class="grow">Пользователи</h1><button class="btn primary" data-act="user-new">${icon('plus')} Добавить пользователя</button></div>
  <div class="card table-wrap"><table class="table"><thead><tr><th>Сотрудник</th><th>Почта</th><th>Роль</th><th>Статус</th><th></th></tr></thead><tbody>
  ${S.users.slice().sort((a, b) => b.active - a.active).map((u) => `<tr>
    <td><div style="display:flex;gap:10px;align-items:center">${avatar(u)}<div><b>${esc(fullName(u))}</b><div class="small muted">${esc(u.position)}</div></div></div></td>
    <td data-label="Почта">${esc(u.email)}</td>
    <td data-label="Роль">${u.active ? `<select class="input" style="min-height:34px;height:34px;padding:4px 8px;width:auto" data-act-change="user-role" data-id="${u.id}" ${u.id === S.me.id ? 'disabled' : ''}>${options(ROLES, u.role)}</select>` : ROLE_RU[u.role]}</td>
    <td data-label="Статус">${u.active ? '<span class="badge st-done">Активен</span>' : '<span class="badge">Удалён</span>'}</td>
    <td style="text-align:right;white-space:nowrap">${u.active ? `<button class="btn sm" data-act="user-edit" data-id="${u.id}">${icon('edit')} Изменить</button>
      ${u.id !== S.me.id ? `<button class="btn sm ghost danger" data-act="user-delete" data-id="${u.id}">${icon('trash')}</button>` : ''}` : ''}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

// ---------- поиск ----------
function searchResults() {
  const q = UI.search.trim().toLowerCase();
  const projects = S.projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
  const tasks = S.tasks.filter((t) => t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q) || t.tags.some((g) => g.toLowerCase().includes(q))).slice(0, 8);
  const people = activeUsers().filter((u) => (fullName(u) + ' ' + u.position + ' ' + u.email).toLowerCase().includes(q)).slice(0, 5);
  if (!projects.length && !tasks.length && !people.length) return '<div class="search-results"><div class="empty">Ничего не найдено</div></div>';
  return `<div class="search-results">
    ${projects.length ? `<h4>Проекты</h4>${projects.map((p) => `<a href="#/project/${p.id}/board" data-act="search-close">${icon('projects', 'ic')}<span>${esc(p.name)}</span></a>`).join('')}` : ''}
    ${tasks.length ? `<h4>Задачи</h4>${tasks.map((t) => `<a href="#" data-act="search-task" data-id="${t.id}"><span class="key">${t.key}</span><span>${esc(t.title)}</span>${statusBadge(t.status)}</a>`).join('')}` : ''}
    ${people.length ? `<h4>Сотрудники</h4>${people.map((u) => `<a href="#/team/${u.id}" data-act="search-close">${avatar(u, 'sm')}<span>${esc(fullName(u))}</span><span class="small muted">${esc(u.position)}</span></a>`).join('')}` : ''}
  </div>`;
}

// ---------- модальные окна ----------
function modal(title, body, foot, id) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.id = 'modal';
  wrap.innerHTML = `<form class="modal" id="${id}" novalidate>
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="btn icon ghost" data-act="modal-close" aria-label="Закрыть">${icon('close')}</button></div>
    <div class="modal-body">${body}<div class="error" id="m-error"></div></div>
    <div class="modal-foot">${foot}</div></form>`;
  document.body.appendChild(wrap);
  wrap.querySelector('input,select,textarea')?.focus();
}
const closeModal = () => $('#modal')?.remove();
const modalError = (msg) => { const e = $('#m-error'); if (e) e.textContent = msg; };

function openTaskForm(projectId) {
  const creatable = S.projects.filter(canCreateIn);
  if (!creatable.length) return toast('Нет проектов, где вы можете создавать задачи', true);
  const p = project(projectId) && canCreateIn(project(projectId)) ? project(projectId) : creatable[0];
  modal('Новая задача', `
    <label class="field"><span>Название <b>*</b></span><input class="input" name="title" required maxlength="200" placeholder="Что нужно сделать"></label>
    <label class="field"><span>Описание</span><textarea class="input" name="description" placeholder="Подробности, ссылки, критерии готовности"></textarea></label>
    <div class="grid2">
      <label class="field"><span>Проект <b>*</b></span><select class="input" name="projectId" id="tf-project">${options(creatable.map((x) => [x.id, x.name]), p.id)}</select></label>
      <label class="field"><span>Исполнитель <b>*</b></span><select class="input" name="assigneeId" id="tf-assignee">${userOptions(canManage(p) ? projectTeam(p) : [S.me.id], canManage(p) ? '' : S.me.id, canManage(p) ? 'Выберите исполнителя' : undefined)}</select></label>
      <label class="field"><span>Статус <b>*</b></span><select class="input" name="status">${options(STATUSES, 'planned')}</select></label>
      <label class="field"><span>Приоритет <b>*</b></span><select class="input" name="priority">${options(PRIORITIES, 'medium')}</select></label>
      <label class="field"><span>Дедлайн</span><input class="input" type="date" name="deadline" min="${todayStr()}"></label>
      <label class="field"><span>Теги</span><input class="input" name="tags" placeholder="дизайн, срочно"></label>
      <label class="field"><span>Постановщик</span><input class="input" value="${esc(fullName(S.me))}" disabled></label>
      <label class="field"><span>Дата создания</span><input class="input" value="${fmtDate(todayStr())}" disabled></label>
    </div>
    <label class="field"><span>Ссылка (необязательно)</span><input class="input" name="link" type="url" placeholder="https://"></label>`,
  `<button type="button" class="btn" data-act="modal-close">Отмена</button><button class="btn primary">Создать задачу</button>`, 'task-form');
}

function openProjectForm(id) {
  const p = id ? project(id) : null;
  const admin = isAdmin();
  const team = activeUsers();
  modal(p ? 'Редактировать проект' : 'Новый проект', `
    <label class="field"><span>Название проекта <b>*</b></span><input class="input" name="name" required value="${esc(p?.name)}"></label>
    <label class="field"><span>Описание</span><textarea class="input" name="description">${esc(p?.description)}</textarea></label>
    <div class="grid2">
      <label class="field"><span>Руководитель проекта <b>*</b></span><select class="input" name="managerId" ${admin ? '' : 'disabled'}>${userOptions(team.filter((u) => u.role !== 'employee').map((u) => u.id), p?.managerId || '', 'Выберите руководителя')}</select></label>
      <label class="field"><span>Статус</span><select class="input" name="status">${options(PSTATUSES.filter(([s]) => admin || s !== 'archived' || p?.status === 'archived'), p?.status || 'planned')}</select></label>
      <label class="field"><span>Дата начала</span><input class="input" type="date" name="startDate" value="${esc(p?.startDate)}"></label>
      <label class="field"><span>Плановая дата завершения</span><input class="input" type="date" name="endDate" value="${esc(p?.endDate)}"></label>
    </div>
    <div class="field"><span>Участники</span><div class="members-pick">
      ${team.map((u) => `<label class="check"><input type="checkbox" name="members" value="${u.id}" ${p?.members.includes(u.id) ? 'checked' : ''}> ${esc(fullName(u))} <span class="small muted">${esc(u.position)}</span></label>`).join('')}
    </div></div>
    <label class="check"><input type="checkbox" name="allowMemberTasks" ${p?.allowMemberTasks ? 'checked' : ''}> Участники могут создавать задачи</label>`,
  `<button type="button" class="btn" data-act="modal-close">Отмена</button><button class="btn primary">${p ? 'Сохранить' : 'Создать проект'}</button>`, 'project-form');
  $('#project-form').dataset.id = id || '';
}

function openUserForm(id) {
  const u = id ? user(id) : null;
  modal(u ? 'Изменить пользователя' : 'Новый пользователь', `
    <div class="grid2">
      <label class="field"><span>Имя <b>*</b></span><input class="input" name="firstName" required value="${esc(u?.firstName)}"></label>
      <label class="field"><span>Фамилия</span><input class="input" name="lastName" value="${esc(u?.lastName)}"></label>
      <label class="field"><span>Электронная почта <b>*</b></span><input class="input" type="email" name="email" required value="${esc(u?.email)}"></label>
      <label class="field"><span>Должность</span><input class="input" name="position" value="${esc(u?.position)}"></label>
      <label class="field"><span>Роль</span><select class="input" name="role" ${u?.id === S.me.id ? 'disabled' : ''}>${options(ROLES, u?.role || 'employee')}</select></label>
      <label class="field"><span>${u ? 'Новый пароль' : 'Пароль <b>*</b>'}</span><input class="input" type="text" name="password" ${u ? 'placeholder="оставьте пустым, чтобы не менять"' : 'required'} minlength="6" autocomplete="new-password"></label>
    </div>`,
  `<button type="button" class="btn" data-act="modal-close">Отмена</button><button class="btn primary">${u ? 'Сохранить' : 'Создать'}</button>`, 'user-form');
  $('#user-form').dataset.id = id || '';
}

// ---------- изменения задач ----------
async function patchTask(id, data) {
  const t = task(id);
  const backup = { ...t };
  Object.assign(t, data);
  render();
  try {
    await api('PATCH', '/api/tasks/' + id, data);
    await refresh();
  } catch (e) {
    Object.assign(t, backup);
    render();
    toast(e.message, true);
  }
}
function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function resizeImage(file, size = 256) {
  const url = await readFile(file);
  const img = new Image();
  await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
  const c = document.createElement('canvas');
  const s = Math.min(img.width, img.height);
  c.width = c.height = size;
  c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.85);
}

// ---------- события ----------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (UI.notifOpen && !e.target.closest('.bell')) { UI.notifOpen = false; render(); }
  if (UI.search && !e.target.closest('.search')) { UI.search = ''; render(); }
  if (!el) return;
  if (dragState.suppressClick) { dragState.suppressClick = false; return; }
  const a = el.dataset.act;
  const id = el.dataset.id;
  switch (a) {
    case 'toggle-pw': { const i = $('#l-pass'); i.type = i.type === 'password' ? 'text' : 'password'; break; }
    case 'demo': $('#l-email').value = el.dataset.email; $('#l-pass').value = 'nordflow'; break;
    case 'go': e.preventDefault(); go(el.dataset.href); break;
    case 'side-open': UI.sideOpen = true; render(); break;
    case 'side-close': UI.sideOpen = false; render(); break;
    case 'notif-toggle': UI.notifOpen = !UI.notifOpen; render(); break;
    case 'notif-close': UI.notifOpen = false; break;
    case 'notif-readall': await act(() => api('POST', '/api/notifications/read', {})); break;
    case 'notif-open': {
      const n = S.notifications.find((x) => x.id === id);
      UI.notifOpen = false;
      if (n && !n.read) { n.read = true; api('POST', '/api/notifications/read', { id }).catch(() => {}); }
      if (n?.taskId && task(n.taskId)) UI.taskId = n.taskId;
      render();
      break;
    }
    case 'my-overdue': UI.myFilters = { ...UI.myFilters, overdue: true, due: '' }; go('#/my'); render(); break;
    case 'my-week': UI.myFilters = { ...UI.myFilters, overdue: false, due: 'week' }; go('#/my'); render(); break;
    case 'my-view': UI.myView = el.dataset.v; store('myView', UI.myView); render(); break;
    case 'board-status': UI.boardStatus = el.dataset.s; render(); break;
    case 'toggle-archived': UI.showArchived = el.checked; render(); break;
    case 'open-task': UI.taskId = id; UI.editComment = null; render(); break;
    case 'close-task': if (el.tagName !== 'A') e.preventDefault(); UI.taskId = null; render(); break;
    case 'search-close': UI.search = ''; break;
    case 'search-task': e.preventDefault(); UI.search = ''; UI.taskId = id; render(); break;
    case 'task-new': openTaskForm(el.dataset.project); break;
    case 'task-delete':
      if (confirm('Удалить задачу без возможности восстановления?')) { UI.taskId = null; await act(() => api('DELETE', '/api/tasks/' + id), 'Задача удалена'); }
      break;
    case 'project-new': openProjectForm(); break;
    case 'project-edit': openProjectForm(id); break;
    case 'user-new': openUserForm(); break;
    case 'user-edit': openUserForm(id); break;
    case 'user-delete':
      if (confirm(`Удалить пользователя ${fullName(user(id))}? Его задачи и комментарии сохранятся.`)) await act(() => api('DELETE', '/api/users/' + id), 'Пользователь удалён');
      break;
    case 'modal-close': closeModal(); break;
    case 'comment-add': {
      const text = $('#c-new').value.trim();
      if (!text) return toast('Напишите текст комментария', true);
      await act(() => api('POST', `/api/tasks/${UI.taskId}/comments`, { text }));
      break;
    }
    case 'comment-edit': UI.editComment = id; render(); $('#c-edit')?.focus(); break;
    case 'comment-cancel': UI.editComment = null; render(); break;
    case 'comment-save': {
      const text = $('#c-edit').value.trim();
      if (!text) return toast('Комментарий пустой', true);
      UI.editComment = null;
      await act(() => api('PATCH', '/api/comments/' + id, { text }));
      break;
    }
    case 'comment-delete': if (confirm('Удалить комментарий?')) await act(() => api('DELETE', '/api/comments/' + id)); break;
    case 'att-link': {
      const url = $('#att-url').value.trim();
      if (!url) return toast('Вставьте ссылку', true);
      await act(() => api('POST', `/api/tasks/${UI.taskId}/attachments`, { url: /^https?:\/\//i.test(url) ? url : 'https://' + url }), 'Ссылка добавлена');
      break;
    }
    case 'att-delete': await act(() => api('DELETE', `/api/tasks/${UI.taskId}/attachments`, { id })); break;
    case 'theme': await act(() => api('PATCH', '/api/me', { theme: el.dataset.v })); break;
    case 'avatar-remove': await act(() => api('PATCH', '/api/me', { avatar: null }), 'Фото удалено'); break;
    case 'logout': await api('POST', '/api/logout').catch(() => {}); S = null; UI.taskId = null; go('#/home'); render(); break;
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'g-search') { UI.search = el.value; render(); return; }
  if (el.dataset.filter && el.type !== 'checkbox' && el.tagName === 'INPUT') setFilter(el);
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.filter) return setFilter(el);
  if (el.dataset.actChange === 'user-role') return act(() => api('PATCH', '/api/users/' + el.dataset.id, { role: el.value }), 'Роль изменена');
  if (el.dataset.tfield) {
    const t = task(UI.taskId);
    let v = el.value;
    if (el.dataset.tfield === 'title' && !v.trim()) { toast('Название не может быть пустым', true); el.value = t.title; return; }
    if (el.dataset.tfield === 'tags') v = v.split(',').map((x) => x.trim()).filter(Boolean);
    return patchTask(t.id, { [el.dataset.tfield]: v });
  }
  if (el.id === 'tf-project') {
    const p = project(el.value);
    $('#tf-assignee').innerHTML = userOptions(canManage(p) ? projectTeam(p) : [S.me.id], canManage(p) ? '' : S.me.id, canManage(p) ? 'Выберите исполнителя' : undefined);
  }
  if (el.id === 'att-file' && el.files[0]) {
    const f = el.files[0];
    if (f.size > 3 * 1024 * 1024) return toast('Файл больше 3 МБ', true);
    const data = await readFile(f);
    return act(() => api('POST', `/api/tasks/${UI.taskId}/attachments`, { name: f.name, data }), 'Файл прикреплён');
  }
  if (el.id === 'avatar-file' && el.files[0]) {
    try {
      const avatarData = await resizeImage(el.files[0]);
      return act(() => api('PATCH', '/api/me', { avatar: avatarData }), 'Фото обновлено');
    } catch { toast('Не удалось прочитать картинку', true); }
  }
});
function setFilter(el) {
  const [scope, key] = el.dataset.filter.split('.');
  const f = scope === 'my' ? UI.myFilters : UI.listFilters;
  f[key] = el.type === 'checkbox' ? el.checked : el.value;
  render();
}

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  if (form.id === 'login-form') {
    try {
      await api('POST', '/api/login', { email: data.email, password: data.password });
      await refresh();
    } catch (err) { $('#l-error').textContent = err.message; }
    return;
  }
  if (form.id === 'task-form') {
    if (!data.title.trim()) return modalError('Укажите название задачи');
    if (!data.assigneeId) return modalError('Выберите исполнителя');
    try {
      const t = await api('POST', '/api/tasks', { ...data, tags: data.tags });
      if (data.link) await api('POST', `/api/tasks/${t.id}/attachments`, { url: /^https?:\/\//i.test(data.link) ? data.link : 'https://' + data.link });
      closeModal();
      toast(`Задача ${t.key} создана`);
      await refresh();
    } catch (err) { modalError(err.message); }
    return;
  }
  if (form.id === 'project-form') {
    const id = form.dataset.id;
    const body = { name: data.name, description: data.description, status: data.status, startDate: data.startDate, endDate: data.endDate, members: fd.getAll('members'), allowMemberTasks: !!data.allowMemberTasks };
    if (isAdmin()) body.managerId = data.managerId;
    if (!body.name.trim()) return modalError('Укажите название проекта');
    if (isAdmin() && !body.managerId) return modalError('Выберите руководителя проекта');
    try {
      const p = await api(id ? 'PATCH' : 'POST', id ? '/api/projects/' + id : '/api/projects', body);
      closeModal();
      toast(id ? 'Проект сохранён' : 'Проект создан');
      await refresh();
      if (!id) go(`#/project/${p.id}/board`);
    } catch (err) { modalError(err.message); }
    return;
  }
  if (form.id === 'user-form') {
    const id = form.dataset.id;
    const body = { ...data };
    if (id && !body.password) delete body.password;
    try {
      await api(id ? 'PATCH' : 'POST', id ? '/api/users/' + id : '/api/users', body);
      closeModal();
      toast(id ? 'Изменения сохранены' : 'Пользователь создан');
      await refresh();
    } catch (err) { modalError(err.message); }
    return;
  }
  if (form.id === 'profile-form') return act(() => api('PATCH', '/api/me', data), 'Профиль сохранён');
  if (form.id === 'password-form') {
    if (await act(() => api('POST', '/api/me/password', data), 'Пароль изменён')) form.reset();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($('#modal')) return closeModal();
  if (UI.search) { UI.search = ''; render(); return; }
  if (UI.taskId) { UI.taskId = null; render(); }
});

// ---------- перетаскивание карточек (мышь и перо; на телефоне — вкладки статусов) ----------
const dragState = { el: null, ghost: null, startX: 0, startY: 0, active: false, suppressClick: false };
document.addEventListener('pointerdown', (e) => {
  const card = e.target.closest('.tcard[data-drag="1"]');
  if (!card || e.button !== 0 || e.pointerType === 'touch') return;
  Object.assign(dragState, { el: card, startX: e.clientX, startY: e.clientY, active: false });
});
document.addEventListener('pointermove', (e) => {
  const d = dragState;
  if (!d.el) return;
  if (!d.active) {
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
    d.active = true;
    const r = d.el.getBoundingClientRect();
    d.offX = d.startX - r.left;
    d.offY = d.startY - r.top;
    d.ghost = d.el.cloneNode(true);
    d.ghost.classList.add('drag-ghost');
    d.ghost.style.width = r.width + 'px';
    document.body.appendChild(d.ghost);
    d.el.classList.add('dragging');
  }
  d.ghost.style.left = e.clientX - d.offX + 'px';
  d.ghost.style.top = e.clientY - d.offY + 'px';
  document.querySelectorAll('.column.drop').forEach((c) => c.classList.remove('drop'));
  const col = document.elementFromPoint(e.clientX, e.clientY)?.closest('.column');
  if (col) col.classList.add('drop');
});
document.addEventListener('pointerup', (e) => {
  const d = dragState;
  if (!d.el) return;
  if (d.active) {
    d.ghost.remove();
    d.el.classList.remove('dragging');
    document.querySelectorAll('.column.drop').forEach((c) => c.classList.remove('drop'));
    const col = document.elementFromPoint(e.clientX, e.clientY)?.closest('.column');
    const t = task(d.el.dataset.id);
    d.suppressClick = true;
    setTimeout(() => (d.suppressClick = false), 0);
    if (col && t && col.dataset.status !== t.status) {
      patchTask(t.id, { status: col.dataset.status });
      toast(`${t.key} → ${STATUS_RU[col.dataset.status]}`);
    }
  }
  d.el = null;
  d.active = false;
});

window.addEventListener('hashchange', () => { UI.sideOpen = false; UI.notifOpen = false; UI.search = ''; render(); window.scrollTo(0, 0); });

// Новые уведомления и изменения коллег подтягиваются раз в 30 секунд,
// если пользователь сейчас ничего не вводит.
setInterval(() => {
  if (!S || document.hidden || $('#modal') || dragState.el) return;
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  refresh();
}, 30000);

refresh();
})();
