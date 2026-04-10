const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const sqlPath = path.join(__dirname, 'init.sql');

const db = new Database(dbPath);
const initSql = fs.readFileSync(sqlPath, 'utf8');
db.exec(initSql);

const adminEmail = 'admin@alberodianacleto.it';
const adminPassword = 'Admin123!';
const hash = bcrypt.hashSync(adminPassword, 10);

const exists = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
if (!exists) {
  db.prepare(`
    INSERT INTO users (first_name, last_name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run('Admin', 'Anacleto', adminEmail, hash, 'admin');
}

const insertEvent = db.prepare(`
  INSERT INTO events (title, event_time, created_by)
  VALUES (?, ?, ?)
`);

const admin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);

const eventCount = db.prepare('SELECT COUNT(*) AS count FROM events').get().count;
if (eventCount === 0) {
  insertEvent.run('Entrata e accoglienza', '07:30 - 09:00', admin.id);
  insertEvent.run('Piccolo spuntino a base di frutta', '09:30', admin.id);
  insertEvent.run('Attività educative', '10:00', admin.id);
  insertEvent.run('Pranzo', '11:30', admin.id);
  insertEvent.run('Uscita Part-Time', '12:30 - 13:00', admin.id);
  insertEvent.run('Nanna', '12:45', admin.id);
  insertEvent.run('Merenda', '15:00', admin.id);
  insertEvent.run('Uscita e ricongiungimento', '16:30', admin.id);
}

const noticeCount = db.prepare('SELECT COUNT(*) AS count FROM notices').get().count;
if (noticeCount === 0) {
  db.prepare(`
    INSERT INTO notices (title, content, created_by)
    VALUES (?, ?, ?)
  `).run(
    'Iscrizioni aperte 2026/2027',
    'Le iscrizioni sono aperte fino ad esaurimento posti. Per richiedere il modulo scrivere a alberodianacleto@gmail.com.',
    admin.id
  );
}

console.log('Database inizializzato.');
console.log('Admin demo:', adminEmail, '/', adminPassword);
