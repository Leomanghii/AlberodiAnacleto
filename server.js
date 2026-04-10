const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const { SECRET, authRequired, requireRole } = require('./middleware/auth');

const app = express();
const db = new Database(path.join(__dirname, 'database.sqlite'));

const initSql = fs.readFileSync(path.join(__dirname, 'db', 'init.sql'), 'utf8');
db.exec(initSql);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function sanitizeUser(user) {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role
  };
}

app.get('/api/public-info', (req, res) => {
  const notices = db.prepare(`
    SELECT id, title, content, created_at
    FROM notices
    ORDER BY created_at DESC
  `).all();

  const events = db.prepare(`
    SELECT id, title, event_time
    FROM events
    ORDER BY id ASC
  `).all();

  res.json({
    school: {
      name: 'Albero di Anacleto',
      subtitle: 'Asilo e dopo scuola',
      email: 'alberodianacleto@gmail.com',
      phones: ['3336239209', '3392931477'],
      address: 'Strada per Calerno, 31 - Montecchio Emilia (RE)'
    },
    notices,
    events
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.status(401).json({ message: 'Credenziali non valide' });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ message: 'Credenziali non valide' });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name
    },
    SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  });

  res.json({ user: sanitizeUser(user) });
});

app.post('/api/logout', authRequired, (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout effettuato' });
});

app.get('/api/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: sanitizeUser(user) });
});

app.get('/api/users', authRequired, requireRole('admin'), (req, res) => {
  const users = db.prepare(`
    SELECT id, first_name, last_name, email, role, created_at
    FROM users
    ORDER BY last_name, first_name
  `).all();
  res.json(users);
});

app.post('/api/users', authRequired, requireRole('admin'), (req, res) => {
  const { first_name, last_name, email, password, role } = req.body;

  if (!first_name || !last_name || !email || !password || !role) {
    return res.status(400).json({ message: 'Compila tutti i campi' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) {
    return res.status(400).json({ message: 'Email già registrata' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (first_name, last_name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(first_name, last_name, email, password_hash, role);

  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(sanitizeUser(created));
});

app.put('/api/users/:id', authRequired, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ message: 'Utente non trovato' });
  }

  const {
    first_name = current.first_name,
    last_name = current.last_name,
    email = current.email,
    password,
    role = current.role
  } = req.body;

  const existingEmailUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
  if (existingEmailUser) {
    return res.status(400).json({ message: 'Email già registrata da un altro utente' });
  }

  let password_hash = current.password_hash;
  if (password && password.trim()) {
    password_hash = bcrypt.hashSync(password, 10);
  }

  db.prepare(`
    UPDATE users
    SET first_name = ?, last_name = ?, email = ?, password_hash = ?, role = ?
    WHERE id = ?
  `).run(first_name, last_name, email, password_hash, role, id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(sanitizeUser(updated));
});

app.delete('/api/users/:id', authRequired, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ message: 'Utente non trovato' });
  }
  if (Number(id) === req.user.id) {
    return res.status(400).json({ message: 'Non puoi eliminare il tuo account mentre sei loggato' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ message: 'Utente eliminato' });
});

app.get('/api/events', authRequired, requireRole('admin', 'teacher'), (req, res) => {
  const events = db.prepare(`
    SELECT id, title, event_time, created_at, created_by
    FROM events
    ORDER BY id ASC
  `).all();
  res.json(events);
});

app.post('/api/events', authRequired, requireRole('admin', 'teacher'), (req, res) => {
  const { title, event_time } = req.body;
  if (!title || !event_time) {
    return res.status(400).json({ message: 'Titolo e orario sono obbligatori' });
  }

  const result = db.prepare(`
    INSERT INTO events (title, event_time, created_by)
    VALUES (?, ?, ?)
  `).run(title, event_time, req.user.id);

  const created = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

app.put('/api/events/:id', authRequired, requireRole('admin', 'teacher'), (req, res) => {
  const { id } = req.params;
  const current = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ message: 'Evento non trovato' });
  }

  const { title = current.title, event_time = current.event_time } = req.body;

  db.prepare(`
    UPDATE events
    SET title = ?, event_time = ?
    WHERE id = ?
  `).run(title, event_time, id);

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  res.json(updated);
});

app.delete('/api/events/:id', authRequired, requireRole('admin', 'teacher'), (req, res) => {
  const { id } = req.params;
  const current = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ message: 'Evento non trovato' });
  }

  db.prepare('DELETE FROM events WHERE id = ?').run(id);
  res.json({ message: 'Evento eliminato' });
});

app.get('/api/notices', authRequired, requireRole('admin', 'teacher'), (req, res) => {
  const notices = db.prepare(`
    SELECT id, title, content, created_at
    FROM notices
    ORDER BY created_at DESC
  `).all();
  res.json(notices);
});

app.post('/api/notices', authRequired, requireRole('admin', 'teacher'), (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: 'Titolo e contenuto obbligatori' });
  }

  const result = db.prepare(`
    INSERT INTO notices (title, content, created_by)
    VALUES (?, ?, ?)
  `).run(title, content, req.user.id);

  const created = db.prepare('SELECT * FROM notices WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

app.put('/api/notices/:id', authRequired, requireRole('admin', 'teacher'), (req, res) => {
  const { id } = req.params;
  const current = db.prepare('SELECT * FROM notices WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ message: 'Avviso non trovato' });
  }

  const { title = current.title, content = current.content } = req.body;

  db.prepare(`
    UPDATE notices
    SET title = ?, content = ?
    WHERE id = ?
  `).run(title, content, id);

  const updated = db.prepare('SELECT * FROM notices WHERE id = ?').get(id);
  res.json(updated);
});

app.delete('/api/notices/:id', authRequired, requireRole('admin', 'teacher'), (req, res) => {
  const { id } = req.params;
  const current = db.prepare('SELECT * FROM notices WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ message: 'Avviso non trovato' });
  }

  db.prepare('DELETE FROM notices WHERE id = ?').run(id);
  res.json({ message: 'Avviso eliminato' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});
