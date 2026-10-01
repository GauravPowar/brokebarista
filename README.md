# ☕ Broke Barista

A personal coffee tracking web app built on Cloudflare Pages + D1 — because great espresso deserves great data.

![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)
![D1 Database](https://img.shields.io/badge/Cloudflare-D1-F38020?logo=cloudflare&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?logo=javascript&logoColor=black)

---

## What is this?

Broke Barista tracks every coffee purchase, brew session, and bean on my shelf — from the first French Press pour in May 2025 to daily Dedica Duo espresso in 2026. It answers the question every home barista eventually asks: *"How much am I actually saving vs going to a café?"*

## Features

### 📋 Purchase Log
Track every coffee-related purchase — beans, gear, and accessories. Each entry captures vendor, price, category, size, process, and roast level. Combo orders split costs automatically.

### 📓 Brew Journal
Log every brew session with full parameters:
- **Brewer** (Dedica Duo, V60, KaldiPress, AeroPress, etc.)
- **Bean** linked to purchase log
- **Dose / Yield / Time / Temp / Grind** — full espresso or pour-over recipe
- **Rating** (1–5 stars)
- **Tasting notes** from a curated flavor wheel
- **Grinder** tracking (1Zpresso Q Air → KINGrinder K6 migration)

### 🫙 Shelf Manager
Track what's on the shelf right now:
- Roast date, delivery date, open date, finish date
- Per-session gram tracking to know exactly when a bag will run out
- Rest day calculations
- Finished/active status

### 📊 Stats Dashboard
Interactive charts and insights computed from your data — brews per day, bean rotation, spending trends, flavor profile evolution.

### 🎞️ Monthly Recaps
Full-screen editorial slide decks for each month — animated, swipeable, with Chart.js visualizations. Each recap covers:
- Session count & active days
- Brewer split (espresso vs pour-over)
- Bean rotation & bag transitions
- Flavor palette (top tasting notes)
- Standout moments (best & worst shots)
- Grind dialling-in chart
- Daily activity heatmap
- Money saved vs café equivalent

**Available recaps:** April–September 2026, Q2 2026

### ➕ Quick Add
Fast entry form for logging new purchases and brew sessions.

### 🔄 Process View
Coffee processing method reference and filtering.

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Vanilla HTML/CSS/JS, Chart.js, Google Fonts (DM Sans, DM Serif Display, Playfair Display) |
| **Backend** | Cloudflare Pages Functions (serverless) |
| **Database** | Cloudflare D1 (SQLite at the edge) |
| **Hosting** | Cloudflare Pages |
| **Build** | Zero-build — static files served directly |

## Project Structure

```
brokebarista-main/
├── index.html          # Stats dashboard (home page)
├── log.html            # Purchase log viewer
├── journal.html        # Brew journal viewer
├── shelf.html          # Shelf/bag manager
├── add.html            # Quick add form
├── process.html        # Process reference
├── styles.css          # Global design system
├── app.js              # Core application logic & API layer
├── schema.sql          # D1 database schema
├── wrangler.toml       # Cloudflare Workers config
├── functions/          # Cloudflare Pages serverless functions
├── public/             # Static assets
└── recap/              # Monthly recap slide decks
    ├── index.html      # Recap archive hub
    ├── april_2026.html
    ├── may_2026.html
    ├── june_2026.html
    ├── july_2026.html
    ├── august_2026.html
    ├── september_2026.html
    ├── q2_2026.html    # Quarterly recap
    └── slides.html     # Auto-generated recap fallback
```

## Database Schema

Four tables power the app:

- **`orders`** — Purchase orders (vendor, date, combo pricing)
- **`logs`** — Individual items per order (beans, gear, accessories with full metadata)
- **`journal`** — Brew sessions (recipe, rating, tasting notes, grinder)
- **`shelf_meta`** — Bean shelf lifecycle (roast/open/finish dates, gram tracking)

See [`schema.sql`](schema.sql) for the full DDL.

## Local Development

```bash
# Install wrangler
npm install -g wrangler

# Run locally with D1
npx wrangler pages dev .

# Query the remote database
npx wrangler d1 execute coffeeforgaurav --remote --command="SELECT COUNT(*) FROM journal"
```

## The Numbers (as of September 2026)

| Metric | Value |
|--------|-------|
| Total brews logged | 300+ |
| Months tracked | 7 (Mar–Sep 2026) |
| Beans tried | 40+ |
| Roasters explored | 20+ |
| Equipment pieces | 10+ |
| Estimated savings | ₹40,000+ vs café |

---

*Built by a broke barista who'd rather spend on beans than café markup.* ☕
