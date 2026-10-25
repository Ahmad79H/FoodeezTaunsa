# Foodeez – Deploy to Render (Free)

> **Render is the recommended platform.** Persistent process, SSE works, no cold-start data loss on live traffic.

---

## 🚀 One-Click Deploy to Render

### Step 1 – Push to GitHub
1. Create a new (empty) GitHub repo, e.g. `foodeez`.
2. In this folder, open a terminal and run:
   ```bash
   git init
   git add .
   git commit -m "Initial deploy"
   git remote add origin https://github.com/YOUR_USERNAME/foodeez.git
   git push -u origin main
   ```

### Step 2 – Connect Render
1. Go to [https://render.com](https://render.com) → sign up / log in (free).
2. Click **New → Web Service**.
3. Connect your GitHub account and select the `foodeez` repo.

### Step 3 – Configure the Service
Render will auto-detect Node.js. Confirm these settings:

| Setting | Value |
|---|---|
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | Free |

### Step 4 – Add Environment Variables
In Render → your service → **Environment**, add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(click "Generate" for a random secret)* |
| `SEED_OWNER_EMAIL` | `owner@foodeez.pk` *(or your email)* |
| `SEED_OWNER_PASS` | `YourStrongPassword123!` |
| `DEMO_HISTORY_DAYS` | `0` |

> **Do NOT set `PORT`** — Render sets it automatically.

### Step 5 – Deploy
Click **Create Web Service**. Render will build and deploy automatically.  
Your site will be live at `https://foodeez.onrender.com` (or similar).

---

## ⚠️ Free Tier Notes

- **Spin-down**: Free services sleep after ~15 min of inactivity. First request after sleep takes ~30 seconds. Upgrade to a paid plan (\$7/mo) to keep it always-on.
- **Database**: SQLite data resets on each deploy/restart on the free tier (ephemeral disk). This is fine for demos — the seed data re-populates on startup. For a real production app with persistent data, upgrade to Render's **Persistent Disk** add-on, or use the free **Render PostgreSQL** database.

---

## 🔄 Redeploy After Changes

Push new commits to GitHub — Render auto-redeploys:
```bash
git add .
git commit -m "Your change description"
git push
```

---

## Alternative Platforms

These also work with the same `npm install && npm run build` + `npm start` setup:

| Platform | Free Tier | Notes |
|---|---|---|
| [Railway](https://railway.app) | \$5 credit/mo | Easiest, fastest deploys |
| [Koyeb](https://koyeb.com) | Free instance | Good EU coverage |
| [Fly.io](https://fly.io) | Free allowance | Requires `flyctl` CLI |
| Vercel | Functions only | ❌ SSE breaks, DB resets — not recommended |

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | ✅ | Set to `production` |
| `JWT_SECRET` | ✅ | Random secret for auth tokens (min 32 chars) |
| `SEED_OWNER_EMAIL` | ✅ | Email for the owner/admin account |
| `SEED_OWNER_PASS` | ✅ | Password for the owner/admin account |
| `DEMO_HISTORY_DAYS` | Optional | Days of fake order history to seed (0 = none) |
| `PORT` | Auto | Set by Render automatically — do not override |
