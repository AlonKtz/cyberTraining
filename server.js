const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3000;

// ── Database setup ──────────────────────────────────────────────
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    secret TEXT DEFAULT 'FLAG{sql_injection_success}'
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS secure_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 1000
  );
`);

// Seed data
db.prepare("INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)").run('admin', 'admin123', 'admin@bank.com');
db.prepare("INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)").run('alice', 'password1', 'alice@example.com');
db.prepare("INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)").run('bob', 'hunter2', 'bob@example.com');

const aliceHash = bcrypt.hashSync('password1', 10);
const adminHash = bcrypt.hashSync('admin123', 10);
db.prepare("INSERT OR IGNORE INTO secure_users (username, password_hash, email) VALUES (?, ?, ?)").run('alice', aliceHash, 'alice@example.com');
db.prepare("INSERT OR IGNORE INTO secure_users (username, password_hash, email) VALUES (?, ?, ?)").run('admin', adminHash, 'admin@bank.com');

db.prepare("INSERT OR IGNORE INTO bank_accounts (owner, balance) VALUES (?, ?)").run('alice', 1000);
db.prepare("INSERT OR IGNORE INTO bank_accounts (owner, balance) VALUES (?, ?)").run('bob', 500);

db.prepare("INSERT OR IGNORE INTO comments (author, body) VALUES (?, ?)").run('alice', 'Great tutorial!');
db.prepare("INSERT OR IGNORE INTO comments (author, body) VALUES (?, ?)").run('bob', 'Very helpful, thanks!');

// ── Middleware ──────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'docs')));

// Simple session store (in-memory)
const sessions = {};
const csrfTokens = {};

function getSession(req) {
  const sid = req.cookies.sid;
  return sid ? sessions[sid] : null;
}

function createSession(username) {
  const sid = uuidv4();
  sessions[sid] = { username, loggedInAt: Date.now() };
  return sid;
}

// ══════════════════════════════════════════════════════════════════
//  LAB 1 — SQL INJECTION
// ══════════════════════════════════════════════════════════════════

// VULNERABLE: builds query with string concatenation
app.post('/api/sqli/vulnerable/login', (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;

  let result;
  try {
    result = db.prepare(query).all();
  } catch (err) {
    return res.json({ success: false, error: err.message, query });
  }

  if (result.length > 0) {
    res.json({ success: true, message: `Welcome ${result[0].username}!`, secret: result[0].secret, query });
  } else {
    res.json({ success: false, message: 'Invalid credentials', query });
  }
});

// SECURE: uses parameterized query
app.post('/api/sqli/secure/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (user && user.password === password) {
    res.json({ success: true, message: `Welcome ${user.username}!` });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

// ══════════════════════════════════════════════════════════════════
//  LAB 2 — XSS
// ══════════════════════════════════════════════════════════════════

// VULNERABLE: stores raw HTML, echoes it back unescaped
app.post('/api/xss/vulnerable/comment', (req, res) => {
  const { author, body } = req.body;
  db.prepare('INSERT INTO comments (author, body) VALUES (?, ?)').run(author, body);
  res.json({ success: true });
});

app.get('/api/xss/vulnerable/comments', (req, res) => {
  const comments = db.prepare('SELECT * FROM comments ORDER BY id DESC LIMIT 20').all();
  // Returns raw HTML — rendered unsanitized in the vulnerable page
  res.json(comments);
});

// SECURE: escapes HTML entities before storage/display
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

app.post('/api/xss/secure/comment', (req, res) => {
  const { author, body } = req.body;
  const safeAuthor = escapeHtml(author);
  const safeBody = escapeHtml(body);
  db.prepare('INSERT INTO comments (author, body) VALUES (?, ?)').run(safeAuthor, safeBody);
  res.json({ success: true });
});

app.get('/api/xss/secure/comments', (req, res) => {
  const comments = db.prepare('SELECT * FROM comments ORDER BY id DESC LIMIT 20').all();
  // Body is already escaped — safe to render as innerHTML
  res.json(comments);
});

// ══════════════════════════════════════════════════════════════════
//  LAB 3 — CSRF
// ══════════════════════════════════════════════════════════════════

// Simulate login for CSRF demo (sets a session cookie)
app.post('/api/csrf/login', (req, res) => {
  const { username } = req.body;
  const account = db.prepare('SELECT * FROM bank_accounts WHERE owner = ?').get(username);
  if (!account) return res.status(404).json({ error: 'User not found' });
  const sid = createSession(username);
  res.cookie('sid', sid, { httpOnly: true });
  res.json({ success: true, username, balance: account.balance });
});

app.get('/api/csrf/balance', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in' });
  const account = db.prepare('SELECT * FROM bank_accounts WHERE owner = ?').get(session.username);
  res.json({ username: session.username, balance: account.balance });
});

// VULNERABLE: no CSRF protection — any site can trigger this
app.post('/api/csrf/vulnerable/transfer', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in' });

  const { to, amount } = req.body;
  const amt = parseInt(amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const from = session.username;
  const fromAccount = db.prepare('SELECT * FROM bank_accounts WHERE owner = ?').get(from);
  if (!fromAccount || fromAccount.balance < amt) return res.status(400).json({ error: 'Insufficient funds' });

  db.prepare('UPDATE bank_accounts SET balance = balance - ? WHERE owner = ?').run(amt, from);
  db.prepare('UPDATE bank_accounts SET balance = balance + ? WHERE owner = ?').run(amt, to);

  const updated = db.prepare('SELECT * FROM bank_accounts WHERE owner = ?').get(from);
  res.json({ success: true, message: `Transferred $${amt} to ${to}`, newBalance: updated.balance });
});

// Generate CSRF token for the secure endpoint
app.get('/api/csrf/token', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in' });
  const token = uuidv4();
  csrfTokens[session.username] = token;
  res.json({ csrfToken: token });
});

// SECURE: validates CSRF token
app.post('/api/csrf/secure/transfer', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in' });

  const { to, amount, csrfToken } = req.body;

  // Validate CSRF token
  if (!csrfToken || csrfTokens[session.username] !== csrfToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token — request rejected' });
  }

  const amt = parseInt(amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const from = session.username;
  const fromAccount = db.prepare('SELECT * FROM bank_accounts WHERE owner = ?').get(from);
  if (!fromAccount || fromAccount.balance < amt) return res.status(400).json({ error: 'Insufficient funds' });

  db.prepare('UPDATE bank_accounts SET balance = balance - ? WHERE owner = ?').run(amt, from);
  db.prepare('UPDATE bank_accounts SET balance = balance + ? WHERE owner = ?').run(amt, to);

  // Rotate token after use
  delete csrfTokens[session.username];

  const updated = db.prepare('SELECT * FROM bank_accounts WHERE owner = ?').get(from);
  res.json({ success: true, message: `Transferred $${amt} to ${to}`, newBalance: updated.balance });
});

// ══════════════════════════════════════════════════════════════════
//  LAB 4 — PASSWORD STORAGE
// ══════════════════════════════════════════════════════════════════

// Show the "leaked" vulnerable database
app.get('/api/passwords/vulnerable/leak', (req, res) => {
  const users = db.prepare('SELECT username, password, email FROM users').all();
  res.json({ warning: 'Plain-text passwords exposed!', users });
});

// Show the "leaked" secure database
app.get('/api/passwords/secure/leak', (req, res) => {
  const users = db.prepare('SELECT username, password_hash, email FROM secure_users').all();
  res.json({ note: 'Only bcrypt hashes stored — plain-text unrecoverable', users });
});

// Register with plain-text password (vulnerable)
app.post('/api/passwords/vulnerable/register', (req, res) => {
  const { username, password, email } = req.body;
  try {
    db.prepare('INSERT INTO users (username, password, email) VALUES (?, ?, ?)').run(username, password, email || '');
    res.json({ success: true, stored: password, warning: 'Password stored as plain text!' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Register with bcrypt hash (secure)
app.post('/api/passwords/secure/register', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO secure_users (username, password_hash, email) VALUES (?, ?, ?)').run(username, hash, email || '');
    res.json({ success: true, stored: hash, note: 'bcrypt hash stored — original password not recoverable' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Login with plain-text comparison (vulnerable)
app.post('/api/passwords/vulnerable/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
  if (user) {
    res.json({ success: true, message: `Logged in as ${username}` });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

// Login with bcrypt comparison (secure)
app.post('/api/passwords/secure/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM secure_users WHERE username = ?').get(username);
  if (user && await bcrypt.compare(password, user.password_hash)) {
    res.json({ success: true, message: `Logged in as ${username}` });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

// ── Reset endpoint (restore balances for CSRF lab) ──────────────
app.post('/api/reset', (req, res) => {
  db.prepare('UPDATE bank_accounts SET balance = 1000 WHERE owner = ?').run('alice');
  db.prepare('UPDATE bank_accounts SET balance = 500 WHERE owner = ?').run('bob');
  db.prepare('DELETE FROM comments WHERE author NOT IN (?, ?)').run('alice', 'bob');
  res.json({ success: true, message: 'Lab data reset' });
});

app.listen(PORT, () => {
  console.log(`\n  Cyber Training Environment running at http://localhost:${PORT}\n`);
  console.log('  Labs:');
  console.log('    /lab1  SQL Injection');
  console.log('    /lab2  XSS (Cross-Site Scripting)');
  console.log('    /lab3  CSRF (Cross-Site Request Forgery)');
  console.log('    /lab4  Password Storage\n');
});
