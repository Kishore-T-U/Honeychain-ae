# HoneyChain-AE — frontend prototype

Role-based interface scaffold for HoneyChain-AE: Beekeeper, FPO/Collector,
Buyer/Processor, Government, and Consumer each get their own dashboard,
gated by Supabase auth + a `role` column on each user's profile.

This is a **primary-level interface** — the UI, routing, auth, and role
gating are real and working; the domain logic (ML risk scoring, the Claim
Engine, TAAC, the EVM commit) is stubbed with `TODO` comments pointing at
where each piece plugs in later.

## 1. What you need before you start

- Node.js 18.18+ (check with `node -v`)
- A free [Supabase](https://supabase.com) account
- VS Code + the "ES7+ React/Redux" and "Tailwind CSS IntelliSense" extensions (optional but helpful)
- A GitHub account, and a [Vercel](https://vercel.com) account (sign in with GitHub — it's free for this)

## 2. Set up Supabase (do this first)

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick any
   name/region, set a database password (save it somewhere).
2. Once the project is ready, open **SQL Editor** → **New query**, paste
   in the entire contents of [`supabase/schema.sql`](supabase/schema.sql)
   from this repo, and run it. This creates the `profiles`, `hive_evidence`,
   `harvest_events`, and `claims` tables, plus row-level-security policies
   and the auto-profile-creation trigger.
3. Go to **Settings → API**. You'll need two values from here in the next step:
   - **Project URL** — looks like `https://xxxxxxxx.supabase.co`
   - **anon / public** key — a long string under "Project API keys"

## 3. Open the project in VS Code

```bash
cd honeychain-ae
npm install
cp .env.local.example .env.local
```

Open `.env.local` in VS Code and fill in the two values from step 2:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Then run it locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Create an
account**, pick a role, and you should land on that role's dashboard. The
Beekeeper dashboard has a "Log simulated reading" button that writes a
real row to Supabase — check the `hive_evidence` table in the Supabase
dashboard (Table Editor) to confirm it landed.

> **If you get stuck here**, the most common issue is `.env.local` not
> being filled in, or the SQL from step 2 not having been run yet. Both
> show up as a console error mentioning "Missing Supabase env vars" or a
> failed table query.

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Initial HoneyChain-AE frontend scaffold"
```

Create a new empty repo on GitHub (no README/license — this project
already has one), then:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

`.env.local` is in `.gitignore`, so your Supabase keys are **not** pushed —
good, the anon key is safe to expose in the browser anyway, but keep this
habit for the service-role key later.

## 5. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new), import the GitHub repo
   you just pushed.
2. Vercel auto-detects Next.js — no build settings to change.
3. Before deploying, open **Environment Variables** and add the same two
   values from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. Every push to `main` after this redeploys
   automatically.

## Project structure

```
app/
  page.tsx                 Landing page
  login/page.tsx            Sign in / sign up (role picked at signup)
  dashboard/
    beekeeper/page.tsx      Hive evidence (live Supabase read + write demo)
    fpo/page.tsx             Harvest intake
    buyer/page.tsx           Lot eligibility / claims
    government/page.tsx      Ecosystem view (placeholder)
    consumer/page.tsx        HoneyPass (story / technical view toggle)
components/
  DashboardShell.tsx        Role check + header, wraps every dashboard page
lib/
  supabaseClient.ts          Browser Supabase client  <-- needs your keys
  supabaseServer.ts          Server-side Supabase client
  auth.ts                    Profile fetch + role-to-path helper
middleware.ts                 Redirects signed-out users away from /dashboard
supabase/schema.sql            Run this in the Supabase SQL editor
```

## Where the important gaps are (marked `TODO` in code)

- **`app/dashboard/beekeeper/page.tsx`** — the "Log simulated reading"
  button stands in for the real ESP32-S3 sensor pipeline.
- **`app/dashboard/fpo/page.tsx`** — no intake form yet; needs the
  stable-weight rule from HarvestTrust-Lite before it writes real rows.
- **`app/dashboard/buyer/page.tsx`** and **`government/page.tsx`** — read
  directly from the `claims` table; swap this for the real Claim
  Engine/TAAC service once it exists.
- **`app/dashboard/consumer/page.tsx`** — no QR scanning yet; both views
  are static placeholders.
- **Role-based RLS policies** in `supabase/schema.sql` are intentionally
  loose (any signed-in user can read most tables) — tighten these once
  the per-role access rules are finalized.

## Next steps to discuss

- Do you want email confirmation required on signup, or should accounts
  work immediately (Supabase: Authentication → Providers → Email)?
- Should FPO/Collector and Buyer/Processor be able to create accounts
  freely, or should those be invite-only / assigned by an admin?
