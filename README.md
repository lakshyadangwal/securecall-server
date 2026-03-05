# SecureCall — Server

Backend for SecureCall — a privacy-first P2P encrypted video calling app.

## Tech Stack
- Node.js + Express
- Socket.io (signaling, presence, direct messages)
- PostgreSQL (users + friends)
- JWT authentication + bcrypt

## Local Setup

**1. Install dependencies**
```bash
npm install
```

**2. Create .env file**
```bash
cp .env.example .env
```

Fill in `.env`:
```
PORT=5000
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/securecall
JWT_SECRET=your_random_64_char_secret
```

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**3. Set up PostgreSQL**
```bash
sudo -u postgres psql -c "CREATE DATABASE securecall;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

**4. Initialize tables**
```bash
node db/init.js
```

**5. Run**
```bash
node server.js
```

Runs on http://localhost:5000

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | /auth/register | Register |
| POST | /auth/login | Login |
| GET | /auth/me | Current user |
| GET | /friends | Friends list |
| POST | /friends/add | Send friend request |
| POST | /friends/accept | Accept request |
| DELETE | /friends/:userId | Remove friend |
| GET | /ice-config | STUN/TURN config |
| GET | /health | Health check |

---

## Socket.io Events

### Client → Server
| Event | Description |
|---|---|
| get-presence | Check which friends are online |
| direct-message | Send a DM |
| typing | Typing indicator |
| call-user | Start a call |
| call-accepted | Accept incoming call |
| call-rejected | Reject call |
| join-room | Join WebRTC room |
| offer / answer / ice-candidate | WebRTC signaling |

### Server → Client
| Event | Description |
|---|---|
| all-online-users | All online user IDs (sent on connect) |
| presence-list | Response to get-presence |
| user-online / user-offline | Presence updates |
| direct-message | Incoming DM |
| message-sent / message-offline | DM delivery status |
| peer-typing | Friend is typing |
| incoming-call | Someone calling you |
| call-accepted / call-rejected / call-failed | Call status |
| user-joined / user-left | WebRTC room events |

---

## Deploy on Railway (Free Trial)

1. Push to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select `securecall-server`
4. Add **PostgreSQL** plugin
5. Set environment variables:

```
NODE_ENV=production
JWT_SECRET=<64 char hex>
CLIENT_URL=https://your-vercel-app.vercel.app
DATABASE_URL=<auto-set by Railway PostgreSQL>
```

6. Open Railway Shell tab → run:
```bash
node db/init.js
```

7. Settings → Networking → Generate Domain → copy the URL

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| PORT | No | Defaults to 5000 |
| DATABASE_URL | Yes | PostgreSQL connection string |
| JWT_SECRET | Yes | 64-char random hex |
| CLIENT_URL | Yes | Vercel frontend URL (for CORS) |
| TURN_URL | No | Optional paid TURN server |
| TURN_USERNAME | No | TURN username |
| TURN_CREDENTIAL | No | TURN password |
