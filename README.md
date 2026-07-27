# Lockhart Surface Solutions — Estimator

Mobile-friendly Next.js app for tracing a parking lot on satellite view,
building a quote from lump-sum material/labor costs plus a markup, and
exporting a branded PDF for the client.

- **Estimator** (the whole main screen) — trace the lot on the map to
  auto-calculate square footage, enter lump-sum material/labor costs and a
  markup (% or flat $), and override the suggested Final Quote Price to
  round it to a clean number. The "Internal Costs" card is marked **HIDDEN
  FROM CLIENT** as a reminder — it's on the same screen as everything else
  since only the Estimator ever uses this app.
- **Property Owner** — never opens the app. They only ever see the
  exported PDF: company branding, the traced lot snapshot, numbered service
  line items, and the Final Quote Price. No labor rate, material cost, or
  markup appears on it.

## 1. Local setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. In
[Google Cloud Console](https://console.cloud.google.com/apis/credentials),
create (or reuse) an API key and enable these APIs for that project:

- **Maps JavaScript API** — renders the satellite map (Drawing and Geometry
  libraries ship with it, nothing extra to enable)
- **Places API** — the address search bar
- **Static Maps API** — the polygon snapshot embedded in the PDF

Then run the dev server:

```bash
npm run dev
```

## 2. Deploy for free (Netlify)

This repo already includes a `netlify.toml` (build command `npm run build`,
publish directory `out`).

1. Push this repo to GitHub if it isn't already there.
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** →
   **Import an existing project** → pick this repo → branch
   `claude/lockhart-quote-generator-3wzade`.
3. Build settings should auto-detect from `netlify.toml` — leave them as
   found.
4. Before the first deploy, add the environment variable: **Site
   configuration → Environment variables** → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   = your key from step 1.
5. Deploy. You'll get a URL like `https://your-site-name.netlify.app`.
6. Back in Google Cloud Console, edit the API key's **Application
   restrictions** → **HTTP referrers** and add that `.netlify.app` domain
   (and `localhost` for local dev). This stops anyone else from using your
   key.

Every future push to this branch redeploys automatically.

### Alternative: Vercel

Same idea — [vercel.com/new](https://vercel.com/new), import the repo,
add the `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` environment variable before
deploying, then lock the key down to the resulting `.vercel.app` domain.

## 3. Hand the link to your Estimator (PWA install)

Once deployed, the app is installable as a Progressive Web App — no app
store needed. Text the link and have them:

**iPhone (Safari):** open the link → tap the **Share** icon → **Add to Home
Screen** → **Add**.

**Android (Chrome):** open the link → tap the **⋮** menu → **Add to Home
screen** (or tap the install banner if Chrome shows one) → **Add**.

The app then opens full-screen from the home screen icon, exactly like a
native app.

> PWA installability requires HTTPS — both Netlify and Vercel provide this
> automatically on their default domains.
