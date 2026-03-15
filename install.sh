#!/bin/bash
# OpenClaw 监控面板 - 一键安装脚本

echo "开始安装 OpenClaw 监控面板..."

# 创建目录
mkdir -p ~/openclaw-dashboard
cd ~/openclaw-dashboard

# 创建后端目录
mkdir -p server client

# 创建 server/package.json
cat > server/package.json << 'EOF'
{
  "name": "openclaw-dashboard-server",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "sql.js": "^1.10.2"
  }
}
EOF

# 创建 server/index.js
cat > server/index.js << 'EOFJS'
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'openclaw-dashboard-secret-key-2026';
const DB_PATH = path.join(__dirname, 'dashboard.db');

app.use(cors());
app.use(express.json());

let db;

async function initDB() {
  const SQL = await initSqlJs();
  let data = null;
  if (fs.existsSync(DB_PATH)) {
    data = fs.readFileSync(DB_PATH);
  }
  db = new SQL.Database(data);
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS stats (id INTEGER PRIMARY KEY AUTOINCREMENT, metric_type TEXT NOT NULL, metric_value TEXT NOT NULL, recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_type TEXT NOT NULL, description TEXT, recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  saveDB();
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      db.run('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', [username, hashedPassword, email || null]);
      saveDB();
      res.json({ message: 'User created' });
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
      throw err;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    stmt.bind([username]);
    if (!stmt.step()) { stmt.free(); return res.status(401).json({ error: 'Invalid credentials' }); }
    const user = stmt.getAsObject();
    stmt.free();
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/openclaw/status', authenticateToken, async (req, res) => {
  try {
    const osInfo = await new Promise((resolve) => exec('uname -a', (err, stdout) => resolve(stdout.trim())));
    const skillsDir = '/home/node/.openclaw/workspace/skills';
    let skillsCount = 0, skillsList = [];
    try { const files = fs.readdirSync(skillsDir); skillsCount = files.filter(f => !f.startsWith('.')).length; skillsList = files.filter(f => !f.startsWith('.')); } catch (e) {}
    const memoryInfo = await new Promise((resolve) => exec('free -h', (err, stdout) => resolve(stdout)));
    const uptime = await new Promise((resolve) => exec('uptime', (err, stdout) => resolve(stdout.trim())));
    const cronDir = '/home/node/.openclaw/cron';
    let cronCount = 0;
    try { cronCount = fs.readdirSync(cronDir).length; } catch (e) {}
    res.json({ os: osInfo, nodeVersion: process.version, skillsCount, skillsList, memory: memoryInfo, uptime, cronCount, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OpenClaw Dashboard Server running on port ${PORT}`);
    console.log(`访问地址: http://你的服务器IP:3001/`);
  });
}).catch(err => { console.error('Failed:', err); process.exit(1); });
EOFJS

# 安装依赖
cd server
npm install

echo ""
echo "=========================================="
echo "安装完成！"
echo "=========================================="
echo ""
echo "启动命令: cd ~/openclaw-dashboard/server && node index.js"
echo ""
echo "启动后会显示访问地址"
echo ""
