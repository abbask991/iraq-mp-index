# MPII Community Platform — Phase 1 setup

A Next.js + Supabase app that lets citizens **rate (1–5★) and comment** on MPs.

> **Phase 1 principle:** ratings and comments are **collected and displayed
> only**. They do **NOT** affect the official MPII ranking yet. The Python
> engine remains the single source of truth for scores. Phase 2 adds phone-OTP
> identity + anti-abuse, then verified ratings feed the 10% voter dimension.

## What you need first
- **Node.js 18+** (`node -v` to check; install from nodejs.org)
- A free **Supabase** account (supabase.com)

## Steps

### 1. Create the Supabase project
1. supabase.com → **New project** (pick a name + DB password + region).
2. Open **SQL Editor → New query**, paste `supabase/schema.sql`, **Run**.
3. New query again, paste `supabase/seed_mps.sql`, **Run** (loads the 329 MPs).

### 2. Get your API keys
Supabase → **Project Settings → API**. Copy:
- **Project URL**
- **anon public** key

### 3. Configure the app
```bash
cd platform
cp .env.example .env.local        # then paste your URL + anon key into .env.local
npm install
npm run dev                       # opens http://localhost:3000
```

### 4. Enable login (email magic link)
Supabase → **Authentication → Providers → Email** is on by default. Sign in
from `/login` with your email, click the link, and you can rate/comment.

### 5. Moderate comments
New comments are saved with `status = 'pending'` and are hidden from the public
until approved. To approve: Supabase → **Table editor → comments** → set
`status` to `approved` (a small admin screen can be added later).

## How scores stay safe
- `lib/scoreGate.ts` holds the **quorum** (min ratings before an average shows)
  and the **Bayesian average** used for display now and for Phase-2 scoring.
- Free-text comments are **never** scored — display only, moderated.

## Deploy (later)
Push `platform/` to Vercel (vercel.com), set the two env vars in the Vercel
dashboard, and you get a permanent public URL.

## Phase 2 (not built yet)
- Phone-OTP verification (one real person = one vote)
- Anomaly/abuse detection (spike & IP-cluster quarantine)
- A scheduled job that reads **verified** ratings and feeds the Bayesian
  community score into the Python engine's 10% voter dimension.
