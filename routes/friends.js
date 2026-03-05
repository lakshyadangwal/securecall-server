const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

// GET /friends — get my friends list with online status
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.username, u.avatar,
         f.status,
         f.user_id as requester_id
       FROM friends f
       JOIN users u ON (
         CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END = u.id
       )
       WHERE (f.user_id = $1 OR f.friend_id = $1)
         AND f.status != 'blocked'
       ORDER BY f.status, u.username`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /friends/add — send friend request by username
router.post("/add", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    // Find target user
    const targetResult = await pool.query(
      "SELECT id, username, avatar FROM users WHERE username = $1",
      [username.toLowerCase()]
    );

    if (!targetResult.rows.length)
      return res.status(404).json({ error: "User not found" });

    const target = targetResult.rows[0];

    if (target.id === req.user.id)
      return res.status(400).json({ error: "Can't add yourself" });

    // Check if already friends or pending
    const existing = await pool.query(
      `SELECT * FROM friends
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)`,
      [req.user.id, target.id]
    );

    if (existing.rows.length)
      return res.status(409).json({ error: "Request already exists" });

    await pool.query(
      "INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending')",
      [req.user.id, target.id]
    );

    res.json({ message: "Friend request sent", target });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /friends/accept
router.post("/accept", async (req, res) => {
  const { userId } = req.body;
  try {
    await pool.query(
      `UPDATE friends SET status = 'accepted'
       WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
      [userId, req.user.id]
    );
    res.json({ message: "Friend request accepted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /friends/:userId — remove friend
router.delete("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    await pool.query(
      `DELETE FROM friends
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)`,
      [req.user.id, userId]
    );
    res.json({ message: "Friend removed" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;