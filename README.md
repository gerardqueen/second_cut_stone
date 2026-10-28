# Second Cut Stone

Offcut shop for Second Cut Stone (part of Granite Systems, Kirkcaldy). Customers enter the size they need, pick finished edges, and see a price for every offcut it can be cut from. Staff log offcuts with a photo, size and £/m² from their phone.

Plain HTML/CSS/JS — no build step. GitHub Pages serves it as-is; Supabase stores stock, photos and enquiries.

## How pricing works

```
stone  = length(m) × width(m) × offcut £/m²
edges  = Σ (finished edge length in m × finish £/m)   // front/back use length, left/right use width
total  = stone + edges   (minimum charge applied if set)
```

Customers first choose a **shape** (rectangle, square, circle, oval, half-moon, L-shape). The shape decides which measurements are asked for (circles and half-moons take a diameter or a radius), which edges can be finished, and the area. Shaped pieces are charged on the rectangle they're cut from (`shapedPieceCharge: 'block'`) — set it to `'shape'` to charge only the finished area. `curvedEdgeFactor` adds a premium to polishing curved edges. Shapes live in `js/shapes.js`.

A piece "fits" an offcut if its bounding rectangle fits either way round, after adding `cutAllowanceMm` (default 5mm) to each dimension. Change that, the price note and the minimum charge in `js/config.js`.

## Enquiry email alerts

The site calls the `enquiry-alert` Edge Function straight after saving each enquiry (and the daily keep-alive retries any that failed). It emails the details (reply-to set to the customer). Secrets in Supabase → Edge Functions → Secrets:

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | API key from resend.com (free plan: 3,000 emails/month) |
| `ALERT_TO` | Where alerts go (comma-separate several) |
| `ALERT_FROM` | Optional. Until a domain is verified in Resend, alerts can only go to the Resend account's own email |

Once `secondcutstone.co.uk` is verified in Resend, set `ALERT_FROM` to e.g. `Second Cut Stone <alerts@secondcutstone.co.uk>` and alerts can go to any address.

## View in your room (pilot)

For rectangle and square pieces that fit, the offcut pop-up shows **View in your room**. It builds a true-size 3D slab in the browser (three.js), textured with the offcut photo, and opens it in [model-viewer](https://modelviewer.dev): iPhone → Apple AR Quick Look (a USDZ is generated on the fly), Android → WebXR in Chrome. Desktop shows the 3D slab and a QR code linking to `?ar=<offcut id>&l=<mm>&w=<mm>` so the phone opens the same piece. Libraries load from jsDelivr only when the button is pressed.

## Files

| Path | What it is |
|---|---|
| `index.html` | Customer site: cut finder, yard stock, edge pricing |
| `admin.html` | Staff page: log/edit offcuts, edge prices, enquiries |
| `js/config.js` | Supabase keys + settings (VAT note, minimum charge, cut allowance, contact) |
| `js/pricing.js` | All the pricing maths |
| `js/data.js` | Supabase calls (falls back to a browser-only demo store) |
| `js/logo.js` | Second Cut Stone logo (redrawn as SVG) |
| `supabase/schema.sql` | Tables, security rules, photo bucket, starter edge prices |
| `supabase/002_access_requests.sql` | Staff self sign-up + admin approval queue |
| `supabase/003_shapes.sql` | Stores the shape and measurements on enquiries |
| `js/shapes.js` | Shapes: measurements, area, edges, outline |
| `js/profiles.js` | Edge profile outlines shown in the finish picker |
| `supabase/004_edge_profiles.sql` | Lets each finish choose its profile picture |
| `privacy.html` | Privacy notice (linked from the footer and the enquiry form) |
| `supabase/functions/enquiry-alert/index.ts` | Edge Function: emails each new enquiry via Resend |
| `supabase/005_enquiry_alerts.sql` | Tracks which enquiries have been emailed |
| `.github/workflows/keepalive.yml` | Pings Supabase daily so the free project never pauses; retries unsent alerts |
| `js/ar.js` | *Pilot:* "View in your room" — true-size 3D slab + phone AR (rectangles/squares) |

## 1. Run it locally (demo mode)

With `js/config.js` left blank it runs on sample stock saved in your browser.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Staff page: http://localhost:8000/admin.html (no login in demo mode).

## 2. Set up Supabase (≈10 minutes)

1. Create a project at supabase.com (London region).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. **Authentication → Users → Add user** with the email/password staff will use.
4. Copy that user's **UID** and run in the SQL editor:
   ```sql
   insert into public.admins (user_id) values ('PASTE-UID-HERE');
   ```
5. Run `supabase/002_access_requests.sql` too (staff sign-up with approval).
6. **Project Settings → API**: copy the Project URL and the `anon` public key into `js/config.js`.

The anon key is meant to be public — the database rules only let admins change stock or read enquiries; the public can view unsold stock and submit enquiries.

## Adding staff

Staff go to `/admin.html` → **Create an account**. They can't see or change anything until an existing admin approves them in **Admins** tab (where admins can also be removed — you can't remove yourself, so there's always one left). Sign-ups stay switched on in Supabase for this to work; an unapproved account has no access.

## 3. Deploy on GitHub Pages

1. Push this folder to the repo's `main` branch.
2. Repo **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
3. Live at `https://<owner>.github.io/<repo>/` in a minute or two.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to that address.

## 4. Custom domain (later)

1. Add a file called `CNAME` containing just the domain, e.g. `secondcutstone.co.uk`.
2. At the domain registrar, add DNS records:
   - Apex domain: `A` records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www`: `CNAME` → `<owner>.github.io`
3. Repo **Settings → Pages → Custom domain**, enter it, tick **Enforce HTTPS** once the certificate is issued.
4. Update the Site URL in Supabase.

## Fonts

Granite Systems uses **Azo Sans** from Adobe Fonts (kit `sde0rfe`). Kits are locked to listed domains, so the site uses **Jost** (free, very close) until the new domain is added to their Adobe Fonts web project — then uncomment the Typekit line in `index.html` and `admin.html`.

## Logo

`js/logo.js` redraws the Facebook-page logo as crisp SVG. To use the original artwork instead, save it as `img/logo.png` and set `USE_IMAGE = true` at the top of `js/logo.js`.

## Optional next steps

- **Email alerts for new enquiries**: Supabase **Database → Webhooks** on `enquiries` insert → a small Edge Function that sends via Resend/Postmark.
- **Auto-hide reserved stock after N days**, cut-out pricing (sink/tap holes), or delivery charges — all slot into `js/pricing.js`.
