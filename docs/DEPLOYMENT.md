# Running Checkmate in Production

The app uses a **custom Node server** (`server.js`) that runs both **Next.js** and **Socket.IO** on the same process. Real-time matchmaking and live games require this server.

**You cannot run production on Vercel’s default serverless setup** — Vercel does not run custom Node servers or keep WebSocket connections. Use one of the options below.

---

## Option 1: Single server (recommended)

Run the full app (Next + Socket.IO) on one host. The client will connect to the same origin for WebSockets.

### 1. Build and run

```bash
npm install
npm run build
NODE_ENV=production npm run start
```

Or use the npm script (Unix/Mac):

```bash
npm run start
```

On Windows, set `NODE_ENV=production` in your environment or use:

```bash
set NODE_ENV=production && node server.js
```

The server listens on `PORT` (default `3000`).

### 2. Environment variables

Set these in production (same as `.env` locally):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk frontend key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | e.g. `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | No | e.g. `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | No | e.g. `/` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | No | e.g. `/` |
| `PORT` | No | Default `3000` |

Clerk’s dashboard should have your production domain in “Allowed origins” and “Redirect URLs”.

### 3. Database

- Run migrations (or `prisma db push`) against the production DB before first deploy.
- Use a managed PostgreSQL. **Free option:** [Supabase](https://supabase.com) (see **docs/SUPABASE-SETUP.md**). Other options: Neon, Railway, RDS.

### 4. Hosting platforms that work well

- **Railway** – Connect repo, set env vars, use build command `npm run build` and start command `npm run start`. Set `PORT` if Railway provides it.
- **Render** – “Web Service”, build `npm install && npm run build`, start `npm run start`, set env vars and `PORT`.
- **Fly.io** – Use a Dockerfile (see Option 2) or a `fly.toml` that runs `node server.js` after build.
- **VPS (DigitalOcean, Linode, etc.)** – Install Node, clone repo, set env, run `npm run build && npm run start` under a process manager (e.g. systemd or PM2).

No extra config is needed for Socket.IO: it’s served on the same host and port, so the client’s `window.location.origin` (or `NEXT_PUBLIC_SOCKET_URL` left unset) is correct.

---

## Option 2: Docker

Run the app in a container on any Docker host (VPS, Fly.io, Railway, etc.).

Create `Dockerfile` in the project root:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

Build and run:

```bash
docker build -t checkmate .
docker run -p 3000:3000 --env-file .env checkmate
```

Pass env vars (e.g. `-e DATABASE_URL=...`) or use `--env-file` with a production `.env`.

---

## Option 3: Socket server on a different URL

If you must host the Next.js app on a platform that doesn’t support WebSockets (e.g. Vercel) and run Socket.IO elsewhere:

1. Deploy the **Socket.IO server** on a Node host (e.g. a minimal Express + Socket.IO app that uses the same `lib/socket-handler.js` and game logic). That host must have access to the same database and any APIs it needs.
2. Set **`NEXT_PUBLIC_SOCKET_URL`** in your Next.js (Vercel) project to the Socket server’s public URL (e.g. `https://socket.checkmate.quest`).
3. Ensure CORS on the Socket server allows your Next.js origin.

The client already uses `NEXT_PUBLIC_SOCKET_URL` when set, so no code change is needed.

---

## Checklist

- [ ] `DATABASE_URL` and Clerk env vars set in production
- [ ] Database migrated / pushed
- [ ] Clerk dashboard: production domain in allowed origins and redirect URLs
- [ ] Build: `npm run build`
- [ ] Start: `NODE_ENV=production npm run start` (or `npm run start` where that sets NODE_ENV)
- [ ] `PORT` set if the host provides it (e.g. Railway, Render)
- [ ] If using a separate Socket server: `NEXT_PUBLIC_SOCKET_URL` set in the Next.js app

After this, the Play lobby should connect to the matchmaking server and “Find Match” should work.
