// ============================================================
// Second Cut Stone — site settings
// ============================================================
// Paste your Supabase project details here (Dashboard → Project Settings → API).
// The anon key is designed to be public; security is enforced by the database rules
// in supabase/schema.sql. Leave both blank to run in DEMO MODE with sample stock
// saved only in your own browser.
export const SUPABASE_URL = 'https://bzgnlzsdyjwjfpsexquz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6Z25senNkeWp3amZwc2V4cXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwODk3ODEsImV4cCI6MjEwODY2NTc4MX0.UunT_CdsnPyMeRzuIoom6n1R2mBzNnlY5Bwh9v_0NjA';

export const SETTINGS = {
  currency: 'GBP',
  // Shown under every price so customers know what's included.
  priceNote: 'Prices include VAT. Collection from our Kirkcaldy yard.',
  // Minimum charge for any single piece (0 = off).
  minimumCharge: 0,
  // Circles, ovals, half-moons and L-shapes: 'block' charges the stone on the rectangle the
  // piece is cut from (the waste can't be resold); 'shape' charges only the finished area.
  shapedPieceCharge: 'block',
  // Multiplier on edge finishing for curved edges, which take longer to polish (1 = same price).
  curvedEdgeFactor: 1,
  // Extra mm added to each side when checking whether a piece fits an offcut
  // (allow for saw blade and squaring up). 0 = exact fit allowed.
  cutAllowanceMm: 5,
  contact: {
    phone: '01592 654386',
    email: 'sales@granitesystems.co.uk',
    address: ['Unit 6 Randolph Court', 'Randolph Industrial Estate', 'Kirkcaldy, Fife', 'KY1 2YY'],
    facebook: 'https://www.facebook.com/profile.php?id=61579114190367',
    parent: 'https://www.granitesystems.co.uk',
  },
};

export const DEMO_MODE = !SUPABASE_URL || !SUPABASE_ANON_KEY;
