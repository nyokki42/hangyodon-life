// Express server with SQLite database for pet state management
// run: node server.js (after setting LINE_ACCESS_TOKEN and optionally PORT)

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const app = express();

app.use(express.json());

// Database setup
const db = new sqlite3.Database('./hangyodon.db', (err) => {
  if (err) console.error('DB open error:', err.message);
  else console.log('Connected to SQLite database');
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS pets (
    userId TEXT PRIMARY KEY,
    hunger INTEGER DEFAULT 0,
    mood INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    money INTEGER DEFAULT 1000,
    sleeping INTEGER DEFAULT 0,
    sleepStartHour INTEGER DEFAULT 22,
    wakeUpHour INTEGER DEFAULT 6,
    meetingDate TEXT,
    lastBathDate TEXT,
    lastHungerNotificationDate TEXT,
    inventory TEXT DEFAULT '{}',
    lastJobTime INTEGER DEFAULT 0,
    lastSyncTime INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    userId TEXT,
    notificationDate TEXT,
    PRIMARY KEY (userId, notificationDate)
  )`);
});

// LINE API
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const LINE_API = 'https://api.line.me/v2/bot/message/push';

function sendLineMessage(userId, text) {
  if (!LINE_ACCESS_TOKEN) {
    console.log('LINE_ACCESS_TOKEN not set, skipping notification');
    return Promise.resolve();
  }
  return axios.post(LINE_API, {
    to: userId,
    messages: [{ type: 'text', text }]
  }, {
    headers: { Authorization: 'Bearer ' + LINE_ACCESS_TOKEN }
  });
}

// 毎分ペット状態を自動更新（機嫌-1）
setInterval(() => {
  db.all('SELECT userId FROM pets', [], (err, rows) => {
    if (err) {
      console.error('DB error:', err.message);
      return;
    }
    rows.forEach(row => {
      db.get('SELECT * FROM pets WHERE userId = ?', [row.userId], (err, pet) => {
        if (err || !pet) return;
        
        // 寝ていない場合のみ機嫌-1
        if (!pet.sleeping) {
          const newMood = Math.max(-100, pet.mood - 1);
          db.run('UPDATE pets SET mood = ? WHERE userId = ?', 
            [newMood, row.userId], (err) => {
              if (err) console.error('Update mood error:', err.message);
            });
        }
      });
    });
  });
}, 60 * 1000); // 1分ごと

// GET /api/pet - ペット状態取得
app.get('/api/pet/:userId', (req, res) => {
  const { userId } = req.params;
  db.get('SELECT * FROM pets WHERE userId = ?', [userId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      // 初回ユーザーの場合、デフォルト状態を作成
      const defaultPet = {
        userId,
        hunger: 0,
        mood: 0,
        level: 1,
        exp: 0,
        money: 1000,
        sleeping: 0,
        sleepStartHour: Math.floor(Math.random() * 5) + 22,
        wakeUpHour: Math.floor(Math.random() * 5) + 6,
        meetingDate: new Date().toISOString(),
        lastBathDate: null,
        lastHungerNotificationDate: null,
        inventory: '{}',
        lastJobTime: 0,
        lastSyncTime: Date.now()
      };
      db.run(
        `INSERT INTO pets (userId, hunger, mood, level, exp, money, sleeping, sleepStartHour, wakeUpHour, meetingDate, inventory, lastSyncTime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [defaultPet.userId, defaultPet.hunger, defaultPet.mood, defaultPet.level, defaultPet.exp, 
         defaultPet.money, defaultPet.sleeping, defaultPet.sleepStartHour, defaultPet.wakeUpHour,
         defaultPet.meetingDate, defaultPet.inventory, defaultPet.lastSyncTime],
        (err) => {
          if (err) console.error('Insert error:', err.message);
          res.json(defaultPet);
        }
      );
    } else {
      row.inventory = JSON.parse(row.inventory || '{}');
      res.json(row);
    }
  });
});

// POST /api/pet - ペット状態更新（クライアント操作後の同期）
app.post('/api/pet/:userId', (req, res) => {
  const { userId } = req.params;
  const { hunger, mood, level, exp, money, sleeping, inventory, lastBathDate, lastJobTime } = req.body;

  const inventoryStr = JSON.stringify(inventory || {});
  
  db.run(
    `UPDATE pets SET hunger = ?, mood = ?, level = ?, exp = ?, money = ?, sleeping = ?, 
                     inventory = ?, lastBathDate = ?, lastJobTime = ?, lastSyncTime = ?
     WHERE userId = ?`,
    [hunger, mood, level, exp, money, sleeping, inventoryStr, lastBathDate, lastJobTime, Date.now(), userId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// POST /api/hunger - LINE通知（空腹度が20以下になったとき）
app.post('/api/hunger', (req, res) => {
  const { userId, hunger } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const today = new Date().toDateString();

  // 1日1回のみ通知
  db.get('SELECT * FROM notifications WHERE userId = ? AND notificationDate = ?', 
    [userId, today], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // 既に通知済みなら送信しない
      if (row) {
        return res.json({ message: 'Already notified today' });
      }

      // 空腹度が20以下になったら通知を送信
      if (hunger <= 20) {
        sendLineMessage(userId, 'ハンギョドンがお腹を空かせているよ\nご飯をあげてね！')
          .then(() => {
            db.run(
              'INSERT INTO notifications (userId, notificationDate) VALUES (?, ?)',
              [userId, today],
              (err) => {
                if (err) console.error('Insert notification error:', err.message);
                res.json({ success: true });
              }
            );
          })
          .catch(err => {
            console.error('LINE API error:', err.message);
            res.status(500).json({ error: 'Failed to send message' });
          });
      } else {
        res.json({ message: 'No notification needed' });
      }
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Database: hangyodon.db');
});
