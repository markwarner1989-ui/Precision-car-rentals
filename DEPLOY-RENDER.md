# Deploy to Render (free, all-in-one) — test link in ~10 minutes

This gets the whole app (frontend + backend + database) live on one URL in **mock
mode** — no real cards, no SMS keys needed. You can complete a full booking and watch
it appear in the admin panel.

The project is already configured for this. One Render service runs everything: it
builds the React frontend and serves it from the same Node server as the API.

---

## What you need first

1. A **GitHub account** (free) — Render deploys from a Git repo.
2. A **Render account** (free) — sign up at render.com with your GitHub.

---

## Step 1 — Put the code on GitHub

If you don't use Git yet, the easiest way:

1. Go to **github.com/new**, create a repo (e.g. `precision-car-rentals`), keep it
   Private, click **Create repository**.
2. On the next page, click **uploading an existing file**.
3. Unzip `precision-rentals.zip` on your computer, then drag the **contents** of the
   `precision-rentals` folder into the upload area (so `server/`, `client/`,
   `render.yaml`, and `README.md` are at the top level of the repo — not nested inside
   another `precision-rentals` folder).
4. Click **Commit changes**.

> Make sure `render.yaml` sits at the top level of the repo. That file tells Render how
> to build and run everything automatically.

---

## Step 2 — Deploy on Render

1. In Render, click **New +** → **Blueprint**.
2. Connect your GitHub and pick the `precision-car-rentals` repo.
3. Render reads `render.yaml` and shows one service, **precision-car-rentals**, on the
   free plan. Click **Apply** / **Create**.
4. Wait for the build (first build takes a few minutes — it installs both apps and
   builds the frontend). When it finishes you'll see **Live** with a URL like
   `https://precision-car-rentals.onrender.com`.

That URL is your test site:

- Booking flow: `https://precision-car-rentals.onrender.com/`
- Admin panel: `https://precision-car-rentals.onrender.com/admin`
  - Login: `admin@precisioncarrentals.us` / `changeme123`

---

## Good to know (free tier)

- **It "sleeps" when idle.** After ~15 min of no traffic the free service spins down;
  the next visit takes ~30–50 seconds to wake up. Normal for testing.
- **Data resets on redeploy/restart.** The SQLite database and any uploaded documents
  live on the instance's disk, which is wiped when the service restarts. Perfect for a
  demo, not for keeping real bookings. (For real use, we'd move to a hosted database +
  file storage — easy to add later.)
- **SMS is in mock mode**, so the "we got a text" step logs to the Render service logs
  instead of texting a phone. You can watch it under the service's **Logs** tab when a
  booking is paid. To send real texts later, set `SMS_MODE=live` plus your Twilio keys
  in the service's **Environment** settings.
- **Change the admin password**: in the Render service → **Environment**, edit
  `ADMIN_PASSWORD` to something private, then redeploy.

---

## To make it real later (when you're ready)

In the Render service's **Environment** tab, add/replace:

```
PAYMENT_MODE = live
CARDKNOX_API_KEY = <your Sola/Cardknox transaction key>
SMS_MODE = live
TWILIO_ACCOUNT_SID = <...>
TWILIO_AUTH_TOKEN = <...>
TWILIO_FROM = <your Twilio number>
```

…and swap the demo card fields for Sola iFields (see the main README). Ping me and I'll
walk you through it or wire it in.
