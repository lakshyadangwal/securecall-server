const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

const AVATARS = ["🧑","👩","🧔","👱","🧕","👨‍💻","👩‍💻","🧑‍🚀","🦊","🐺","🐻","🐼"];

// POST /auth/register
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ error: "All fields required" });

  if (username.length < 3 || username.length > 32)
    return res.status(400).json({ error: "Username must be 3–32 characters" });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    const hashed = await bcrypt.hash(password, 12);
    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

    const result = await pool.query(
      `INSERT INTO users (username, email, password, avatar)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, avatar`,
      [username.toLowerCase(), email.toLowerCase(), hashed, avatar]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user });
  } catch (err) {
    if (err.code === "23505") {
      const field = err.detail.includes("username") ? "Username" : "Email";
      return res.status(409).json({ error: `${field} already taken` });
    }
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /auth/me
router.get("/me", require("../middleware/auth"), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, email, avatar FROM users WHERE id = $1",
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;