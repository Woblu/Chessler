# Supabase database (free tier)

Supabase offers a **free PostgreSQL** database that doesn’t expire. Use it with Vercel (or any host) by setting `DATABASE_URL` to your Supabase connection string.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. **New project** → pick an org, name, database password (save it), and region.
3. Wait for the project to finish provisioning.

## 2. Get the connection string

**You must be inside a project**, not org/account settings. If you only see *Configuration, General, Compute and Disk, Infrastructure, Billing…* you’re in the wrong place (often **organization** settings).

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) and **click your project** (not “Organization settings”).
2. In the **left sidebar** for that project, open **Project Settings** (gear icon at the **bottom** of the sidebar).
3. In the settings **sub-menu** for the project, click **Database** (not “General” or “Billing”).
4. Or go directly to: `https://supabase.com/dashboard/project/<YOUR_PROJECT_REF>/settings/database`  
   (replace `<YOUR_PROJECT_REF>` with the short id in your project URL.)

**Alternative:** In the project sidebar, click the **Database** icon (cylinder) → look for **Connect** or connection info at the top of that page.

6. Under **Connection string**, choose **URI**.
7. Copy the URI. It looks like:
   ```text
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
8. Replace `[YOUR-PASSWORD]` with your database password (the one you set when creating the project).  
   If the password contains special characters, URL-encode them (e.g. `@` → `%40`, `#` → `%23`).

## 3. Use the pooler URL (recommended for Vercel)

For serverless (e.g. Vercel), use the **connection pooler** so you don’t exhaust connections:

- In **Connection string**, select **Transaction** (or **Session**) mode and copy the **URI**.
- It will use port **6543** (pooler). The direct URL uses port 5432; keep that for running migrations from your machine if you prefer.

Add SSL to the end of the URI (use `?` if there’s no query string, otherwise `&`):

```text
?sslmode=require
```

Example:

```text
postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

## 4. Set DATABASE_URL in your app

- **Local:** Put the same URI in `.env` as `DATABASE_URL`.
- **Vercel:** Project → Settings → Environment Variables → add `DATABASE_URL` with that value (Production and Preview if you use both).

## 5. Run migrations and deploy

From your project root (with `DATABASE_URL` in `.env` pointing at Supabase):

```bash
npx prisma db push
```

Or, if you use migrations:

```bash
npx prisma migrate deploy
```

Then deploy or redeploy your app so it uses the new `DATABASE_URL`.

## 6. Migrating from another database (e.g. Railway)

- Export data from the old DB if you need to keep it (e.g. `pg_dump` from Railway, then restore into Supabase via Supabase SQL editor or `psql`).
- Or start fresh: point `DATABASE_URL` at Supabase, run `prisma db push` (or `migrate deploy`), and re-seed if you have seed scripts (`npm run seed-shop`, etc.).

---

## Troubleshooting: `P1000: Authentication failed`

This means Postgres rejected the **password** or **username** in `DATABASE_URL`.

1. **Confirm the password**  
   In Supabase: **Project Settings** → **Database** → **Database password**.  
   If you’re not sure, use **Reset database password**, copy the new password, and update `.env` immediately.

2. **URL-encode the password**  
   The password goes inside the URL. Special characters **must** be encoded, or the connection will break or auth will fail:

   | Character | Encode as |
   |-----------|-----------|
   | `@` | `%40` |
   | `#` | `%23` |
   | `$` | `%24` |
   | `%` | `%25` |
   | `&` | `%26` |
   | `/` | `%2F` |
   | `:` | `%3A` |
   | `?` | `%3F` |
   | space | `%20` |

   Example: password `p@ss#word` → `p%40ss%23word` in the URI.

   Quick way: open browser devtools → `encodeURIComponent('your-actual-password')` and use the result as the password part of the URL.

3. **Direct vs pooler username**  
   - **Direct** (`db.xxx.supabase.co:5432`): user is usually `postgres`.  
   - **Pooler** (`*.pooler.supabase.com:6543`): user is often `postgres.[project-ref]` — copy the exact URI from the dashboard and only replace the password.

4. **No brackets**  
   Replace `[YOUR-PASSWORD]` with the real password — do **not** leave `[` or `]` in the string.

5. **Quotes in `.env`**  
   Use `DATABASE_URL="postgresql://..."` with double quotes if the URL has `#` or spaces.

---

**Free tier limits (Supabase):** 500 MB database, 1 GB file storage, 2 GB bandwidth. Plenty for a small app; you can upgrade later if needed.
