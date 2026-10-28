// Second Cut Stone — email alert for new enquiries.
// Deployed as a Supabase Edge Function called "enquiry-alert" (Verify JWT: on — the public
// anon key is enough to call it). The website calls it straight after saving an enquiry, and
// the daily keep-alive workflow calls it too, which retries anything that failed.
//
// It ignores whatever it is sent and only emails enquiries that haven't been emailed yet,
// so calling it can never send anything other than a real, unsent enquiry.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY  API key from resend.com
//   ALERT_TO        where alerts go, e.g. sales@granitesystems.co.uk (comma-separate several)
//   ALERT_FROM      optional; defaults to Resend's test sender until a domain is verified
//   SITE_URL        optional; link to the admin page in the email
import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const gbp = (n: unknown) => (n == null ? '—' : `£${Number(n).toFixed(2)}`);

Deno.serve(async () => {
  const key = Deno.env.get('RESEND_API_KEY');
  const to = (Deno.env.get('ALERT_TO') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!key || !to.length) return json({ ok: false, reason: 'RESEND_API_KEY or ALERT_TO not set yet' });

  const from = Deno.env.get('ALERT_FROM') ?? 'Second Cut Stone <onboarding@resend.dev>';
  const site = Deno.env.get('SITE_URL') ?? 'https://gerardqueen.github.io/second_cut_stone/';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY'))!);

  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const { data: rows, error } = await db
    .from('enquiries')
    .select('*, offcuts(name, material, thickness_mm, photo_url)')
    .is('notified_at', null)
    .gte('created_at', since)
    .order('created_at')
    .limit(20);
  if (error) return json({ ok: false, error: error.message }, 500);

  const sent: string[] = [], failed: string[] = [];
  for (const e of rows ?? []) {
    // Claim the row first so two calls at once can't both email it.
    const { data: claimed } = await db
      .from('enquiries').update({ notified_at: new Date().toISOString() })
      .eq('id', e.id).is('notified_at', null).select('id');
    if (!claimed?.length) continue;

    const o = e.offcuts ?? {};
    const piece = e.dims?.summary ?? `${e.length_mm} × ${e.width_mm}mm`;
    const edges = Object.entries(e.edges ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    const stone = [o.name, o.material, o.thickness_mm ? `${o.thickness_mm}mm` : null].filter(Boolean).join(' · ');
    const subject = `New offcut request: ${e.offcut_ref ?? ''} ${o.name ?? ''} – ${gbp(e.quoted_total)}`.replace(/\s+/g, ' ');

    const rowsHtml = [
      ['Customer', esc(e.customer_name)],
      ['Email', `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>`],
      ['Phone', e.phone ? `<a href="tel:${esc(e.phone)}">${esc(e.phone)}</a>` : '—'],
      ['Offcut', `${esc(e.offcut_ref ?? '')} ${esc(stone)}`],
      ['Piece', esc(piece)],
      ['Stone needed', `${esc(e.length_mm)} × ${esc(e.width_mm)}mm`],
      ['Edges', edges.length ? edges.map(esc).join('<br>') : 'No finished edges'],
      ['Quoted total', `<strong>${gbp(e.quoted_total)}</strong>`],
      ['Message', e.message ? esc(e.message).replace(/\n/g, '<br>') : '—'],
    ].map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 0">${v}</td></tr>`).join('');

    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;max-width:560px">
      <h2 style="color:#4d4d4e;margin:0 0 12px">New offcut request</h2>
      <table style="border-collapse:collapse">${rowsHtml}</table>
      <p style="margin-top:18px">Reply to this email to answer the customer directly, or
      <a href="${esc(site)}admin.html">open the admin page</a> to mark it done.</p>
    </div>`;
    const text = `New offcut request\n\nCustomer: ${e.customer_name}\nEmail: ${e.email}\nPhone: ${e.phone ?? '-'}\n` +
      `Offcut: ${e.offcut_ref ?? ''} ${stone}\nPiece: ${piece}\nEdges: ${edges.join('; ') || 'none'}\n` +
      `Quoted: ${gbp(e.quoted_total)}\nMessage: ${e.message ?? '-'}\n\nAdmin: ${site}admin.html`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, reply_to: e.email, subject, html, text }),
    });
    if (res.ok) sent.push(e.id);
    else {
      failed.push(`${e.id}: ${res.status} ${await res.text()}`);
      await db.from('enquiries').update({ notified_at: null }).eq('id', e.id); // retry next time
    }
  }
  return json({ ok: failed.length === 0, sent: sent.length, failed });
});
