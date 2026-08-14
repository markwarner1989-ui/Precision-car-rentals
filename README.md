# Precision Car Rentals — Online Booking & Deposit Platform

A complete self-service car rental booking system built for Precision Car Rentals
by **Meta Creative Designer**.

Customers choose a **vehicle class** (never a specific car), upload their license and
insurance documents, see transparent pricing, and pay a **fixed category deposit**
online. The business gets a text the moment a deposit is paid, and approves each
reservation from an admin panel.

---

## What's in the box

```
precision-rentals/
├── server/        Node + Express API, SQLite database
└── client/        React + Vite frontend (customer booking flow + admin panel)
```

### Key features

- **Category-based booking** — customers pick a class (Economical, Sedan, SUV,
  Performance, Luxury); the team assigns the actual vehicle at approval. No
  specific-car selection anywhere.
- **Fixed deposit per category** — auto-applied, never manually entered.
- **Insurance-driven document rules** — Liability = 1 photo, Full Coverage = 2 photos,
  enforced on the server.
- **Transparent pricing** — clear "Due now (deposit)" vs "Due at pickup (rental +
  insurance)" breakdown.
- **Cardknox / Sola payments** — real gateway integration for the deposit charge, with
  a mock mode so you can test the whole flow before adding live keys.
- **Instant SMS to the business** when a deposit is paid (Twilio; mock mode logs to
  console).
- **Customer confirmation** with the exact required wording (one-hour approval during
  business hours; license + card in their name at pickup).
- **Admin panel** — review documents, approve/decline, assign a vehicle, block vehicle
  classes for specific date ranges, and see deposits collected.

---

## Quick start (local)

You need **Node.js 18+** installed.

### 1. Start the backend

```bash
cd server
npm install
cp .env.example .env        # then edit .env (see below)
npm run seed                # creates the database + sample categories
npm start                   # API on http://localhost:4000
```

### 2. Start the frontend (in a second terminal)

```bash
cd client
npm install
npm run dev                 # site on http://localhost:5173
```

- Customer booking flow: **http://localhost:5173/**
- Admin panel: **http://localhost:5173/admin**
  (default login is in your `.env` — `ADMIN_EMAIL` / `ADMIN_PASSWORD`)

The app ships in **mock mode**, so you can complete a full booking with no real card
and no live keys. Use card number `4111 1111 1111 1111`. To test a failed payment,
put the word `decline` in the card field.

---

## Going live — the 3 things you provide

Everything runs in mock mode until you switch these on in `server/.env`.

### 1. Cardknox / Sola (deposit payments)

```
PAYMENT_MODE=live
CARDKNOX_API_KEY=your_transaction_key_here
```

Get the key from the Sola / Cardknox Merchant Portal:
**Account Settings → Keys → Create a Key** (type: *API / Transaction Key*).

> **Card security (PCI):** in production the card fields on the payment step should be
> replaced with **Sola iFields**, which tokenize the card in the browser so raw card
> numbers never touch your server. The backend already expects that token — see
> `server/lib/payments.js`. Cardknox provides the iFields script; drop it into
> `client/src/pages/Booking.jsx` at the payment step. Until then, mock mode is safe for
> testing.

### 2. SMS notifications (Twilio)

```
SMS_MODE=live
BUSINESS_SMS_TO=+17046481760      # where the alert texts go
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+1...                 # your Twilio number
```

(Any SMS provider works — the send logic is a single function in `server/lib/sms.js`.)

### 3. Admin credentials & secret

```
ADMIN_EMAIL=you@precisioncarrentals.us
ADMIN_PASSWORD=choose-a-strong-one
JWT_SECRET=paste-a-long-random-string
```

### Hosting

Hosting is arranged by the client. Two common setups:

- **Single server:** run the API with `npm start` behind a process manager (e.g. pm2),
  build the client with `cd client && npm run build`, and serve the `client/dist`
  folder from any static host or the same server.
- **Split:** API on a Node host (Render, Railway, a VPS), client `dist` on any static
  host (Netlify, Vercel, cPanel). Set `CLIENT_ORIGIN` in `.env` to the client's URL,
  and point the client's `/api` calls at the API URL (in `client/vite.config.js` for
  dev, or a small env swap for production).

---

## Managing categories, prices & deposits

Edit the starting values in `server/lib/seed.js` and re-run `npm run seed`, **or**
manage them live through the admin API (`/api/admin/categories`). Each category has a
daily rate and a fixed deposit. Insurance daily rates live in
`server/lib/pricing.js` (`INSURANCE`).

Blocking a class for dates (when nothing's available) is done in the admin panel under
**Availability** — blocked classes are greyed out for customers and can't be booked or
quoted for those dates.

---

## How the money works (example)

SUV, 3 days, Full Coverage:

| Item | Amount |
|---|---|
| Rental (3 × $89) | $267 |
| Full Coverage insurance (3 × $35) | $105 |
| **Due at pickup** | **$372** |
| **Deposit (fixed, due now)** | **$300** |

The deposit is charged online now; the balance is collected at pickup.

---

## Tech notes

- **Backend:** Node/Express, better-sqlite3 (file database at `server/data/precision.db`),
  JWT admin auth, multer file uploads (stored in `server/uploads/`).
- **Frontend:** React 18 + Vite, React Router. Design system in `client/src/styles.css`.
- **No build tooling lock-in** — plain ESM, standard npm scripts.

Built by Meta Creative Designer · metacreativedesigner.com
