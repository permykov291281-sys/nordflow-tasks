// NordFlow Tasks — сервер без внешних зависимостей (Node 18+).
// Данные хранятся в JSON-файле (DATA_DIR/db.json), файлы задач — в DATA_DIR/files.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { seed } = require('./seed');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const FILES_DIR = path.join(DATA_DIR, 'files');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_FILE = 3 * 1024 * 1024;

fs.mkdirSync(FILES_DIR, { recursive: true });

// ---------- хранилище ----------
let db;
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 32).toString('hex') };
}
function checkPassword(user, password) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}
function load() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = seed(hashPassword);
    saveNow();
  }
}
let saveTimer = null;
function saveNow() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 150);
}
const newId = () => crypto.randomBytes(6).toString('hex');
const now = () => new Date().toISOString();

// ---------- права ----------
const isAdmin = (u) => u.role === 'admin';
function projectMember(u, p) {
  return isAdmin(u) || p.managerId === u.id || p.members.includes(u.id);
}
function projectManager(u, p) {
  return isAdmin(u) || p.managerId === u.id;
}
function visibleProjects(u) {
  return db.projects.filter((p) => projectMember(u, p));
}
function canSeeTask(u, t) {
  const p = db.projects.find((x) => x.id === t.projectId);
  return p && projectMember(u, p);
}
function canEditTask(u, t) {
  const p = db.projects.find((x) => x.id === t.projectId);
  return p && projectManager(u, p);
}
function publicUser(u) {
  const { hash, salt, ...rest } = u;
  return rest;
}

// ---------- уведомления ----------
function notify(userId, actorId, type, task, text) {
  if (!userId || userId === actorId) return;
  db.notifications.unshift({ id: newId(), userId, type, taskId: task.id, text, at: now(), read: false });
  if (db.notifications.length > 2000) db.notifications.length = 2000;
}
function dayStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
// Дедлайн хранится как YYYY-MM-DD; просрочена — если день дедлайна уже прошёл.
function isOverdue(t) {
  return t.deadline && t.status !== 'done' && new Date(t.deadline + 'T23:59:59') < new Date();
}
function deadlineSweep() {
  const tomorrow = new Date(dayStart().getTime() + 86400000).toISOString().slice(0, 10);
  let changed = false;
  for (const t of db.tasks) {
    if (!t.assigneeId || t.status === 'done' || !t.deadline) continue;
    t.flags = t.flags || {};
    if (isOverdue(t) && t.flags.overdue !== t.deadline) {
      t.flags.overdue = t.deadline;
      notify(t.assigneeId, null, 'overdue', t, `Задача ${t.key} «${t.title}» просрочена`);
      changed = true;
    } else if (!isOverdue(t) && t.deadline <= tomorrow && t.flags.soon !== t.deadline) {
      t.flags.soon = t.deadline;
      notify(t.assigneeId, null, 'soon', t, `Скоро дедлайн: ${t.key} «${t.title}» — ${fmtDate(t.deadline)}`);
      changed = true;
    }
  }
  if (changed) save();
}
function fmtDate(d) {
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

// ---------- HTTP-утилиты ----------
function send(res, code, data, headers = {}) {
  const body = typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(body);
}
const fail = (res, code, message) => send(res, code, { error: message });
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_FILE * 1.5) {
        reject(new Error('too big'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(e);
      }
    });
  });
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function currentUser(req) {
  const token = cookies(req).nf_session;
  const s = token && db.sessions[token];
  if (!s) return null;
  return db.users.find((u) => u.id === s.userId) || null;
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};
function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR)) return fail(res, 403, 'forbidden');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  fs.createReadStream(file).pipe(res);
}

// ---------- проверка полей ----------
const STATUSES = ['backlog', 'planned', 'progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const PROJECT_STATUSES = ['planned', 'active', 'paused', 'done', 'archived'];
const STATUS_RU = { backlog: 'Бэклог', planned: 'Запланировано', progress: 'В работе', review: 'На проверке', done: 'Выполнено' };
const PRIORITY_RU = { low: 'низкий', medium: 'средний', high: 'высокий', critical: 'критический' };
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const userName = (id) => {
  const u = db.users.find((x) => x.id === id);
  return u ? `${u.firstName} ${u.lastName}` : '—';
};

// ---------- API ----------
async function api(req, res, pathname, me) {
  const m = req.method;
  const parts = pathname.split('/').filter(Boolean).slice(1); // без "api"
  const [res1, id, sub] = parts;
  const body = m === 'GET' ? {} : await readBody(req);

  // вход / выход
  if (res1 === 'login' && m === 'POST') {
    const email = str(body.email).toLowerCase();
    const user = db.users.find((u) => u.email === email);
    if (!user || !user.active || !checkPassword(user, String(body.password || ''))) {
      return fail(res, 401, 'Неверная почта или пароль');
    }
    const token = crypto.randomBytes(24).toString('hex');
    db.sessions[token] = { userId: user.id, at: now() };
    save();
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return send(res, 200, { ok: true }, {
      'Set-Cookie': `nf_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${30 * 86400}${secure}`,
    });
  }
  if (res1 === 'logout' && m === 'POST') {
    const token = cookies(req).nf_session;
    if (token) delete db.sessions[token];
    save();
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'nf_session=; Path=/; Max-Age=0' });
  }

  if (!me) return fail(res, 401, 'Нужно войти');

  // всё, что пользователь вправе видеть, — одним запросом
  if (res1 === 'bootstrap' && m === 'GET') {
    deadlineSweep();
    const projects = visibleProjects(me);
    const pids = new Set(projects.map((p) => p.id));
    const tasks = db.tasks.filter((t) => pids.has(t.projectId));
    const tids = new Set(tasks.map((t) => t.id));
    return send(res, 200, {
      me: publicUser(me),
      users: db.users.map(publicUser),
      projects,
      tasks,
      comments: db.comments.filter((c) => tids.has(c.taskId)),
      notifications: db.notifications.filter((n) => n.userId === me.id).slice(0, 100),
      serverTime: now(),
    });
  }

  // профиль
  if (res1 === 'me' && m === 'PATCH') {
    if (body.firstName !== undefined) me.firstName = str(body.firstName, 60) || me.firstName;
    if (body.lastName !== undefined) me.lastName = str(body.lastName, 60) || me.lastName;
    if (body.position !== undefined) me.position = str(body.position, 80);
    if (body.theme === 'light' || body.theme === 'dark') me.theme = body.theme;
    if (body.avatar !== undefined) {
      if (body.avatar === null) me.avatar = null;
      else if (typeof body.avatar === 'string' && body.avatar.startsWith('data:image/') && body.avatar.length < 400000) me.avatar = body.avatar;
      else return fail(res, 400, 'Фото слишком большое или не картинка');
    }
    save();
    return send(res, 200, publicUser(me));
  }
  if (res1 === 'me' && id === 'password' && m === 'POST') {
    if (!checkPassword(me, String(body.oldPassword || ''))) return fail(res, 400, 'Текущий пароль указан неверно');
    const pw = String(body.newPassword || '');
    if (pw.length < 6) return fail(res, 400, 'Новый пароль — минимум 6 символов');
    Object.assign(me, hashPassword(pw));
    save();
    return send(res, 200, { ok: true });
  }

  // пользователи (только администратор)
  if (res1 === 'users') {
    if (!isAdmin(me)) return fail(res, 403, 'Только для администратора');
    if (m === 'POST') {
      const email = str(body.email).toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, 'Укажите корректную почту');
      if (db.users.some((u) => u.email === email)) return fail(res, 400, 'Пользователь с такой почтой уже есть');
      if (!str(body.firstName)) return fail(res, 400, 'Укажите имя');
      const pw = String(body.password || '');
      if (pw.length < 6) return fail(res, 400, 'Пароль — минимум 6 символов');
      const user = {
        id: newId(), email, firstName: str(body.firstName, 60), lastName: str(body.lastName, 60),
        position: str(body.position, 80), role: ['admin', 'manager', 'employee'].includes(body.role) ? body.role : 'employee',
        avatar: null, theme: 'light', active: true, createdAt: now(), ...hashPassword(pw),
      };
      db.users.push(user);
      save();
      return send(res, 200, publicUser(user));
    }
    const user = db.users.find((u) => u.id === id);
    if (!user) return fail(res, 404, 'Пользователь не найден');
    if (m === 'PATCH') {
      if (body.email !== undefined) {
        const email = str(body.email).toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, 'Укажите корректную почту');
        if (db.users.some((u) => u.email === email && u.id !== user.id)) return fail(res, 400, 'Почта уже занята');
        user.email = email;
      }
      if (body.role !== undefined) {
        if (!['admin', 'manager', 'employee'].includes(body.role)) return fail(res, 400, 'Неизвестная роль');
        if (user.id === me.id && body.role !== 'admin') return fail(res, 400, 'Нельзя снять роль администратора с самого себя');
        user.role = body.role;
      }
      if (body.firstName !== undefined) user.firstName = str(body.firstName, 60) || user.firstName;
      if (body.lastName !== undefined) user.lastName = str(body.lastName, 60);
      if (body.position !== undefined) user.position = str(body.position, 80);
      if (body.password) {
        if (String(body.password).length < 6) return fail(res, 400, 'Пароль — минимум 6 символов');
        Object.assign(user, hashPassword(String(body.password)));
      }
      save();
      return send(res, 200, publicUser(user));
    }
    if (m === 'DELETE') {
      if (user.id === me.id) return fail(res, 400, 'Нельзя удалить самого себя');
      // Пользователь деактивируется: его задачи и комментарии остаются в истории.
      user.active = false;
      for (const [t, s] of Object.entries(db.sessions)) if (s.userId === user.id) delete db.sessions[t];
      for (const p of db.projects) p.members = p.members.filter((x) => x !== user.id);
      save();
      return send(res, 200, { ok: true });
    }
  }

  // проекты
  if (res1 === 'projects') {
    if (m === 'POST') {
      if (!isAdmin(me)) return fail(res, 403, 'Создавать проекты может только администратор');
      const p = projectFromBody({}, body);
      if (p.error) return fail(res, 400, p.error);
      p.id = newId();
      p.createdAt = now();
      db.projects.push(p);
      for (const uid of new Set([p.managerId, ...p.members])) {
        notify(uid, me.id, 'project', { id: null }, `Вас добавили в проект «${p.name}»`);
      }
      save();
      return send(res, 200, p);
    }
    const p = db.projects.find((x) => x.id === id);
    if (!p || !projectMember(me, p)) return fail(res, 404, 'Проект не найден');
    if (m === 'PATCH') {
      if (!projectManager(me, p)) return fail(res, 403, 'Недостаточно прав');
      // Руководитель может менять участников и описание, но не назначать другого руководителя и не архивировать.
      if (!isAdmin(me)) {
        delete body.managerId;
        if (body.status === 'archived') return fail(res, 403, 'Архивировать проект может только администратор');
      }
      const before = new Set(p.members);
      const upd = projectFromBody(p, body);
      if (upd.error) return fail(res, 400, upd.error);
      Object.assign(p, upd);
      for (const uid of p.members) if (!before.has(uid)) notify(uid, me.id, 'project', { id: null }, `Вас добавили в проект «${p.name}»`);
      save();
      return send(res, 200, p);
    }
  }

  // задачи
  if (res1 === 'tasks' && !sub) {
    if (m === 'POST') {
      const p = db.projects.find((x) => x.id === body.projectId);
      if (!p || !projectMember(me, p)) return fail(res, 400, 'Выберите проект');
      if (!projectManager(me, p) && !p.allowMemberTasks) return fail(res, 403, 'В этом проекте задачи создаёт руководитель');
      const t = taskFromBody({}, body, p);
      if (t.error) return fail(res, 400, t.error);
      Object.assign(t, {
        id: newId(), key: `NDF-${db.counter++}`, projectId: p.id, reporterId: me.id,
        createdAt: now(), updatedAt: now(), attachments: [], history: [{ at: now(), userId: me.id, text: 'создал(а) задачу' }],
      });
      if (!projectManager(me, p)) t.assigneeId = t.assigneeId || me.id;
      db.tasks.push(t);
      notify(t.assigneeId, me.id, 'assigned', t, `Вам назначена задача ${t.key} «${t.title}»`);
      save();
      return send(res, 200, t);
    }
  }
  if (res1 === 'tasks' && id) {
    const t = db.tasks.find((x) => x.id === id);
    if (!t || !canSeeTask(me, t)) return fail(res, 404, 'Задача не найдена');
    const p = db.projects.find((x) => x.id === t.projectId);
    const manager = canEditTask(me, t);
    const own = t.assigneeId === me.id;

    if (!sub && m === 'PATCH') {
      // Сотрудник может менять только статус своей задачи.
      const keys = Object.keys(body);
      if (!manager) {
        if (!own || keys.some((k) => k !== 'status')) return fail(res, 403, 'Вы можете менять только статус своих задач');
      }
      const upd = taskFromBody(t, body, p);
      if (upd.error) return fail(res, 400, upd.error);
      const changes = [];
      const track = (field, label, fmt = (v) => v || '—') => {
        if (upd[field] !== undefined && JSON.stringify(upd[field]) !== JSON.stringify(t[field])) {
          changes.push({ field, text: `${label}: ${fmt(t[field])} → ${fmt(upd[field])}` });
        }
      };
      track('title', 'название');
      track('status', 'статус', (v) => STATUS_RU[v]);
      track('priority', 'приоритет', (v) => PRIORITY_RU[v]);
      track('assigneeId', 'исполнитель', userName);
      track('deadline', 'срок', (v) => (v ? fmtDate(v) : 'без срока'));
      track('description', 'описание', () => '…');
      track('tags', 'теги', (v) => (v && v.length ? v.join(', ') : '—'));
      if (!changes.length) return send(res, 200, t);
      const oldAssignee = t.assigneeId;
      Object.assign(t, upd, { updatedAt: now() });
      for (const c of changes) t.history.push({ at: now(), userId: me.id, text: c.text });
      const fields = new Set(changes.map((c) => c.field));
      if (fields.has('assigneeId')) notify(t.assigneeId, me.id, 'assigned', t, `Вам назначена задача ${t.key} «${t.title}»`);
      if (fields.has('deadline') && !fields.has('assigneeId')) notify(t.assigneeId, me.id, 'deadline', t, `Изменён срок задачи ${t.key}: ${t.deadline ? fmtDate(t.deadline) : 'без срока'}`);
      if (fields.has('status')) {
        const text = `${t.key} «${t.title}»: статус — ${STATUS_RU[t.status]}`;
        for (const uid of new Set([t.assigneeId, t.reporterId, p.managerId])) notify(uid, me.id, 'status', t, text);
      }
      if (fields.has('deadline') && t.flags) t.flags = {};
      void oldAssignee;
      save();
      return send(res, 200, t);
    }
    if (!sub && m === 'DELETE') {
      if (!manager) return fail(res, 403, 'Недостаточно прав');
      db.tasks = db.tasks.filter((x) => x.id !== t.id);
      db.comments = db.comments.filter((c) => c.taskId !== t.id);
      save();
      return send(res, 200, { ok: true });
    }
    if (sub === 'comments' && m === 'POST') {
      const text = str(body.text, 4000);
      if (!text) return fail(res, 400, 'Комментарий пустой');
      const c = { id: newId(), taskId: t.id, userId: me.id, text, at: now(), editedAt: null };
      db.comments.push(c);
      t.updatedAt = now();
      for (const uid of new Set([t.assigneeId, t.reporterId])) notify(uid, me.id, 'comment', t, `Новый комментарий в ${t.key}: ${text.slice(0, 80)}`);
      save();
      return send(res, 200, c);
    }
    if (sub === 'attachments' && m === 'POST') {
      if (!manager && !own) return fail(res, 403, 'Прикреплять файлы можно к своим задачам');
      let att;
      if (body.url) {
        const url = str(body.url, 1000);
        if (!/^https?:\/\//i.test(url)) return fail(res, 400, 'Ссылка должна начинаться с http:// или https://');
        att = { id: newId(), type: 'link', name: str(body.name, 120) || url, url, at: now(), userId: me.id };
      } else if (body.data) {
        const match = /^data:([^;]*);base64,(.*)$/.exec(String(body.data));
        if (!match) return fail(res, 400, 'Не удалось прочитать файл');
        const buf = Buffer.from(match[2], 'base64');
        if (buf.length > MAX_FILE) return fail(res, 400, 'Файл больше 3 МБ');
        const fid = newId();
        fs.writeFileSync(path.join(FILES_DIR, fid), buf);
        att = { id: fid, type: 'file', name: str(body.name, 120) || 'файл', mime: match[1] || 'application/octet-stream', size: buf.length, at: now(), userId: me.id };
      } else return fail(res, 400, 'Нет ни ссылки, ни файла');
      t.attachments.push(att);
      t.history.push({ at: now(), userId: me.id, text: `вложение: ${att.name}` });
      save();
      return send(res, 200, t);
    }
    if (sub === 'attachments' && m === 'DELETE') {
      if (!manager && !own) return fail(res, 403, 'Недостаточно прав');
      t.attachments = t.attachments.filter((a) => a.id !== body.id);
      save();
      return send(res, 200, t);
    }
  }

  // комментарии: правка и удаление
  if (res1 === 'comments' && id) {
    const c = db.comments.find((x) => x.id === id);
    const t = c && db.tasks.find((x) => x.id === c.taskId);
    if (!c || !t || !canSeeTask(me, t)) return fail(res, 404, 'Комментарий не найден');
    if (m === 'PATCH') {
      if (c.userId !== me.id) return fail(res, 403, 'Можно редактировать только свои комментарии');
      const text = str(body.text, 4000);
      if (!text) return fail(res, 400, 'Комментарий пустой');
      c.text = text;
      c.editedAt = now();
      save();
      return send(res, 200, c);
    }
    if (m === 'DELETE') {
      if (c.userId !== me.id && !isAdmin(me)) return fail(res, 403, 'Можно удалять только свои комментарии');
      db.comments = db.comments.filter((x) => x.id !== c.id);
      save();
      return send(res, 200, { ok: true });
    }
  }

  // уведомления
  if (res1 === 'notifications' && id === 'read' && m === 'POST') {
    for (const n of db.notifications) {
      if (n.userId === me.id && (!body.id || n.id === body.id)) n.read = true;
    }
    save();
    return send(res, 200, { ok: true });
  }

  return fail(res, 404, 'Не найдено');
}

function projectFromBody(old, b) {
  const p = {};
  if (b.name !== undefined || !old.id) {
    p.name = str(b.name, 120);
    if (!p.name) return { error: 'Укажите название проекта' };
  }
  if (b.description !== undefined) p.description = str(b.description, 2000);
  if (b.managerId !== undefined || !old.id) {
    const mgr = db.users.find((u) => u.id === b.managerId && u.active);
    if (!mgr) return { error: 'Выберите руководителя проекта' };
    p.managerId = mgr.id;
  }
  if (b.members !== undefined) {
    if (!Array.isArray(b.members)) return { error: 'Участники — список' };
    p.members = [...new Set(b.members.filter((id) => db.users.some((u) => u.id === id && u.active)))];
  } else if (!old.id) p.members = [];
  if (b.startDate !== undefined) p.startDate = isDate(b.startDate) ? b.startDate : '';
  if (b.endDate !== undefined) p.endDate = isDate(b.endDate) ? b.endDate : '';
  const start = p.startDate ?? old.startDate;
  const end = p.endDate ?? old.endDate;
  if (start && end && end < start) return { error: 'Дата завершения раньше даты начала' };
  if (b.status !== undefined || !old.id) {
    p.status = PROJECT_STATUSES.includes(b.status) ? b.status : 'planned';
  }
  if (b.allowMemberTasks !== undefined) p.allowMemberTasks = !!b.allowMemberTasks;
  return p;
}

function taskFromBody(old, b, project) {
  const t = {};
  if (b.title !== undefined || !old.id) {
    t.title = str(b.title, 200);
    if (!t.title) return { error: 'Укажите название задачи' };
  }
  if (b.description !== undefined) t.description = str(b.description, 10000);
  if (b.status !== undefined || !old.id) {
    if (!STATUSES.includes(b.status)) return { error: 'Укажите статус' };
    t.status = b.status;
  }
  if (b.priority !== undefined || !old.id) {
    if (!PRIORITIES.includes(b.priority)) return { error: 'Укажите приоритет' };
    t.priority = b.priority;
  }
  if (b.assigneeId !== undefined || !old.id) {
    const okIds = new Set([project.managerId, ...project.members]);
    if (!b.assigneeId || !okIds.has(b.assigneeId)) return { error: 'Выберите исполнителя из участников проекта' };
    t.assigneeId = b.assigneeId;
  }
  if (b.deadline !== undefined) t.deadline = isDate(b.deadline) ? b.deadline : '';
  if (b.tags !== undefined) {
    const list = Array.isArray(b.tags) ? b.tags : String(b.tags).split(',');
    t.tags = [...new Set(list.map((x) => str(String(x), 30)).filter(Boolean))].slice(0, 10);
  }
  return t;
}

// ---------- сервер ----------
load();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname === '/health') return send(res, 200, { ok: true });
    const me = currentUser(req);
    if (pathname.startsWith('/api/')) return await api(req, res, pathname, me);
    if (pathname.startsWith('/files/')) {
      if (!me) return fail(res, 401, 'Нужно войти');
      const fid = pathname.split('/')[2];
      const t = db.tasks.find((x) => x.attachments.some((a) => a.id === fid && a.type === 'file'));
      if (!t || !canSeeTask(me, t)) return fail(res, 404, 'Файл не найден');
      const a = t.attachments.find((x) => x.id === fid);
      res.writeHead(200, {
        'Content-Type': a.mime,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(a.name)}`,
      });
      return fs.createReadStream(path.join(FILES_DIR, fid)).pipe(res);
    }
    return serveStatic(req, res, pathname);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) fail(res, 500, 'Ошибка сервера');
  }
});
server.listen(PORT, () => console.log(`NordFlow Tasks: http://localhost:${PORT}`));
process.on('SIGTERM', () => {
  saveNow();
  process.exit(0);
});
