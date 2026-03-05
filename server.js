require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

app.use("/auth", require("./routes/auth"));
app.use("/friends", require("./routes/friends"));

app.get("/ice-config", require("./middleware/auth"), (req, res) => {
  res.json({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
    ]
  });
});

app.get("/health", (req, res) =>
  res.json({ status: "online", onlineUsers: presence.size })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", credentials: true },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// presence: userId (number) -> { socketId, username }
const presence = new Map();
const rooms = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("No token"));
  try { socket.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { next(new Error("Invalid token")); }
});

io.on("connection", (socket) => {
  const userId = Number(socket.user.id);
  const username = socket.user.username;

  // Always replace old socket with new one
  presence.set(userId, { socketId: socket.id, username });
  console.log(`[+] ${username} (${userId}) online. Total: ${presence.size}`);

  // Send ALL online user IDs to this new client immediately
  socket.emit("all-online-users", Array.from(presence.keys()));

  // Tell everyone else this user is online
  socket.broadcast.emit("user-online", { userId, username });

  // ── Presence: client sends friend IDs, server returns which are online ──
  socket.on("get-presence", (friendIds) => {
    if (!Array.isArray(friendIds) || friendIds.length === 0) return;
    const onlineIds = friendIds.map(Number).filter((id) => presence.has(id));
    console.log(`[PRESENCE] ${username} asked ${friendIds.length} friends → ${onlineIds.length} online`);
    socket.emit("presence-list", onlineIds);
  });

  // ── Direct Messages ──────────────────────────────────────────────────────
  socket.on("direct-message", ({ toUserId, message, tempId }) => {
    const target = presence.get(Number(toUserId));
    const ts = Date.now();
    socket.emit("message-sent", { tempId, ts });
    if (target) {
      io.to(target.socketId).emit("direct-message", { fromUserId: userId, fromUsername: username, message, tempId, ts });
      console.log(`[DM] ${username} → ${toUserId} ✓`);
    } else {
      socket.emit("message-offline", { tempId });
    }
  });

  socket.on("typing", ({ toUserId, isTyping }) => {
    const target = presence.get(Number(toUserId));
    if (target) io.to(target.socketId).emit("peer-typing", { fromUserId: userId, isTyping });
  });

  // ── Calls ────────────────────────────────────────────────────────────────
  socket.on("call-user", ({ targetUserId, roomId }) => {
    const target = presence.get(Number(targetUserId));
    if (!target) { socket.emit("call-failed", { reason: "User is offline" }); return; }
    io.to(target.socketId).emit("incoming-call", { from: { userId, username }, roomId });
  });

  socket.on("call-accepted", ({ targetUserId, roomId }) => {
    const target = presence.get(Number(targetUserId));
    if (target) io.to(target.socketId).emit("call-accepted", { roomId });
  });

  socket.on("call-rejected", ({ targetUserId }) => {
    const target = presence.get(Number(targetUserId));
    if (target) io.to(target.socketId).emit("call-rejected", { username });
  });

  // ── WebRTC ───────────────────────────────────────────────────────────────
  socket.on("join-room", (roomId) => {
    if (socket.rooms.has(roomId)) {
      socket.emit("room-joined", { userCount: (rooms.get(roomId) || []).length, roomId });
      return;
    }
    const room = rooms.get(roomId) || [];
    if (room.length >= 2) { socket.emit("room-full"); return; }
    room.push(socket.id);
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.to(roomId).emit("user-joined", { socketId: socket.id, username, userId });
    socket.emit("room-joined", { userCount: room.length, roomId });
  });

  socket.on("offer", ({ offer, roomId }) => socket.to(roomId).emit("offer", { offer }));
  socket.on("answer", ({ answer, roomId }) => socket.to(roomId).emit("answer", { answer }));
  socket.on("ice-candidate", ({ candidate, roomId }) => socket.to(roomId).emit("ice-candidate", { candidate }));

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const current = presence.get(userId);
    if (current?.socketId === socket.id) {
      presence.delete(userId);
      socket.broadcast.emit("user-offline", { userId });
      console.log(`[-] ${username} offline. Total: ${presence.size}`);
    }
    const roomId = socket.data.roomId;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId).filter((id) => id !== socket.id);
      if (room.length === 0) rooms.delete(roomId);
      else { rooms.set(roomId, room); socket.to(roomId).emit("user-left", { username, userId }); }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`\n🔐 SecureCall on port ${PORT}\n`));