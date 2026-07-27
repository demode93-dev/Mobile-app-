# Lockhart Surface Solutions — Estimator

Mobile-friendly Next.js app for building a seal coating / striping quote
from lump-sum material and labor costs plus a markup, and exporting a
branded PDF for the client. No external API keys required.

- **Estimator** (the whole main screen) — type in the lot's square
  footage and address, enter lump-sum material/labor costs and a markup
  (% or flat $), and override the suggested Final Quote Price to round it
  to a clean number. The "Internal Costs" card is marked **HIDDEN FROM
  CLIENT** as a reminder — it's on the same screen as everything else
  since only the Estimator ever uses this app.
- **Property Owner** — never opens the app. They only ever see the
  exported PDF: company branding, numbered service line items, and the
  Final Quote Price. No labor rate, material cost, or markup appears on
  it.

## 1. Local setup

```bash
npm install
npm run dev
```

That's it — no environment variables or API keys needed.

## 2. Deploy for free (Netlify)

This repo already includes a `netlify.toml` (build command `npm run build`,
publish directory `out`).

1. Push this repo to GitHub if it isn't already there.
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** →
   **Import an existing project** → pick this repo → branch
   `claude/lockhart-quote-generator-3wzade`.
3. Build settings should auto-detect from `netlify.toml` — leave them as
   found.
4. Deploy. You'll get a URL like `https://your-site-name.netlify.app`.

Every future push to this branch redeploys automatically.

### Alternative: Vercel

Same idea — [vercel.com/new](https://vercel.com/new), import the repo,
deploy. No environment variables needed there either.

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
