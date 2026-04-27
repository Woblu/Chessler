# Vercel + Railway PostgreSQL

If you see **"Can't reach database server"** when the app runs on Vercel and the database is on Railway, check the following.

## 1. Use the public connection URL

In Railway, open your Postgres service → **Connect** → **Public networking**. Use the **public** connection URL (e.g. `postgresql://...@xxx.proxy.rlwy.net:port/railway`). Do **not** use the private/internal URL; that only works inside Railway’s network.

## 2. Require SSL in the URL

Append `?sslmode=require` to the URL so Prisma connects over SSL (Railway expects this):

- If the URL has **no** query string:  
  `postgresql://USER:PASSWORD@trolley.proxy.rlwy.net:34411/railway?sslmode=require`
- If it already has query params, add:  
  `&sslmode=require`

In **Vercel**: Project → Settings → Environment Variables → set `DATABASE_URL` to that full string (Production and Preview if you use both).

## 3. Database is running

On Railway’s free tier, the database can **pause** after inactivity. In the Railway dashboard, open the Postgres service and resume it if it’s paused.

## 4. Redeploy

After changing `DATABASE_URL` on Vercel, trigger a new deployment (e.g. redeploy from the Vercel dashboard or push a commit) so the new value is used.
