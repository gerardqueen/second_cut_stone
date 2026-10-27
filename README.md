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
