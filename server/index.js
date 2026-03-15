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

// Middleware
app.use(cors());
app.use(express.json());

let db;

// Initialize Database
async function initDB() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  let data = null;
  if (fs.existsSync(DB_PATH)) {
    data = fs.readFileSync(DB_PATH);
  }
  
  db = new SQL.Database(data);
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_type TEXT NOT NULL,
      metric_value TEXT NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_type TEXT NOT NULL,
      description TEXT,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  saveDB();
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Auth Middleware
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

// Routes

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    try {
      db.run('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', 
        [username, hashedPassword, email || null]);
      saveDB();
      res.json({ message: 'User created' });
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      throw err;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    stmt.bind([username]);
    
    if (!stmt.step()) {
      stmt.free();
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = stmt.getAsObject();
    stmt.free();
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Stats
app.get('/api/stats', authenticateToken, (req, res) => {
  try {
    const results = [];
    const stmt = db.prepare('SELECT * FROM stats ORDER BY recorded_at DESC LIMIT 100');
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Activities
app.get('/api/activities', authenticateToken, (req, res) => {
  try {
    const results = [];
    const stmt = db.prepare('SELECT * FROM activities ORDER BY recorded_at DESC LIMIT 50');
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Activity
app.post('/api/activities', authenticateToken, (req, res) => {
  try {
    const { activity_type, description } = req.body;
    db.run('INSERT INTO activities (activity_type, description) VALUES (?, ?)', 
      [activity_type, description]);
    saveDB();
    res.json({ message: 'Activity added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get OpenClaw Status
app.get('/api/openclaw/status', authenticateToken, async (req, res) => {
  try {
    // Get system info
    const osInfo = await new Promise((resolve) => {
      exec('uname -a', (err, stdout) => resolve(stdout.trim()));
    });

    // Get skills count
    const skillsDir = '/home/node/.openclaw/workspace/skills';
    let skillsCount = 0;
    let skillsList = [];
    try {
      const files = fs.readdirSync(skillsDir);
      skillsCount = files.filter(f => !f.startsWith('.')).length;
      skillsList = files.filter(f => !f.startsWith('.'));
    } catch (e) {}

    // Get memory info
    const memoryInfo = await new Promise((resolve) => {
      exec('free -h', (err, stdout) => resolve(stdout));
    });

    // Get uptime
    const uptime = await new Promise((resolve) => {
      exec('uptime', (err, stdout) => resolve(stdout.trim()));
    });

    // Get cron jobs
    const cronDir = '/home/node/.openclaw/cron';
    let cronCount = 0;
    try {
      const cronFiles = fs.readdirSync(cronDir);
      cronCount = cronFiles.length;
    } catch (e) {}

    res.json({
      os: osInfo,
      nodeVersion: process.version,
      skillsCount,
      skillsList,
      memory: memoryInfo,
      uptime,
      cronCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save stats
app.post('/api/stats', authenticateToken, (req, res) => {
  try {
    const { metric_type, metric_value } = req.body;
    db.run('INSERT INTO stats (metric_type, metric_value) VALUES (?, ?)', 
      [metric_type, JSON.stringify(metric_value)]);
    saveDB();
    res.json({ message: 'Stat saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`OpenClaw Dashboard Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
