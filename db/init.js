const pool = require("../db");

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        username    VARCHAR(32) UNIQUE NOT NULL,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        avatar      VARCHAR(4) DEFAULT '🧑',
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS friends (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        friend_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status      VARCHAR(16) DEFAULT 'pending',  -- pending | accepted | blocked
        created_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, friend_id)
      );
    `);
    console.log("✅ Database tables ready");
  } catch (err) {
    console.error("DB init error:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

initDB();