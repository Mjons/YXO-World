// Pulls every source into data.js, which index.html reads.
// Run from this folder:  node refresh.mjs
//
// Keys live in .env next to this file (copy .env.example). Signups come from
// Plausible goals the site fires when a form is sent, not from Formspree
// (its free plan has no export). Nothing here is sent anywhere except the
// Stripe and Plausible APIs themselves, and no names or emails are written
// to data.js.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, "config.json"), "utf8"));

if (existsSync(join(here, ".env"))) process.loadEnvFile(join(here, ".env"));

const day = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);

// ── Stripe ────────────────────────────────────────────────────────────────

async function stripeList(key, path, params = {}) {
  const rows = [];
  let after;
  for (;;) {
    const q = new URLSearchParams({ limit: "100", ...params });
    if (after) q.set("starting_after", after);
    const res = await fetch(`https://api.stripe.com/v1/${path}?${q}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error?.message || `Stripe ${res.status}`);
    rows.push(...body.data);
    if (!body.has_more) return rows;
    after = body.data.at(-1).id;
  }
}

async function loadStripe() {
  const keys = (process.env.STRIPE_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (!keys.length)
    return {
      status: "missing",
      note: "Waiting for Lily's read-only Stripe key",
      orders: [],
    };

  // Payment link URL → workshop and number of students.
  const byUrl = {};
  for (const w of config.workshops)
    for (const [url, students] of Object.entries(w.paymentLinks))
      byUrl[url] = { workshop: w.key, students };

  const orders = [];
  let unmatchedLinks = 0;
  for (const key of keys) {
    const links = await stripeList(key, "payment_links");
    const linkInfo = {};
    for (const l of links) if (byUrl[l.url]) linkInfo[l.id] = byUrl[l.url];
    unmatchedLinks += Object.keys(byUrl).length - Object.keys(linkInfo).length;

    const refunds = await stripeList(key, "refunds");
    const refundedByIntent = {};
    for (const r of refunds)
      if (r.status === "succeeded" && r.payment_intent)
        refundedByIntent[r.payment_intent] =
          (refundedByIntent[r.payment_intent] || 0) + r.amount;

    const sessions = await stripeList(key, "checkout/sessions");
    for (const s of sessions) {
      const info = linkInfo[s.payment_link];
      if (!info) continue; // something else sold from this account
      if (s.status === "open") continue; // still in progress
      const paid = s.status === "complete" && s.payment_status === "paid";
      orders.push({
        date: day(s.created),
        workshop: info.workshop,
        students: info.students,
        status: paid ? "paid" : "abandoned",
        amount: paid ? s.amount_total / 100 : 0,
        refunded: paid ? (refundedByIntent[s.payment_intent] || 0) / 100 : 0,
      });
    }
  }
  // Each key only sees its own account's links, so with one key some are expected to be missing.
  const note =
    unmatchedLinks && keys.length === 1
      ? "Connected. Some workshop links are not in this account; add a second key if they live elsewhere"
      : "Connected";
  return { status: "connected", note, orders };
}

// ── Plausible ─────────────────────────────────────────────────────────────

async function plausibleQuery(key, { metric, dimensions, goal }) {
  const res = await fetch("https://plausible.io/api/v2/query", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site_id: config.plausible.site,
      metrics: [metric],
      date_range: "all",
      dimensions,
      ...(goal ? { filters: [["is", "event:goal", [goal]]] } : {}),
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Plausible ${res.status}`);
  return body.results;
}

const perDay = (results) =>
  Object.fromEntries(
    results.map((r) => [r.dimensions[0].slice(0, 10), r.metrics[0]]),
  );

// One row per form sent, with the property the page groups by. Custom
// properties may not be on every Plausible plan; then only counts are kept.
async function goalRows(key, goal, prop) {
  try {
    const results = await plausibleQuery(key, {
      metric: "events",
      dimensions: ["time:day", `event:props:${prop}`],
      goal,
    });
    const rows = [];
    for (const r of results) {
      const value = r.dimensions[1] === "(none)" ? "" : r.dimensions[1];
      for (let i = 0; i < r.metrics[0]; i++)
        rows.push({ date: r.dimensions[0].slice(0, 10), [prop]: value });
    }
    return { rows, withProp: true };
  } catch {
    const counts = perDay(
      await plausibleQuery(key, {
        metric: "events",
        dimensions: ["time:day"],
        goal,
      }),
    );
    const rows = [];
    for (const [date, n] of Object.entries(counts))
      for (let i = 0; i < n; i++) rows.push({ date, [prop]: "" });
    return { rows, withProp: false };
  }
}

async function loadPlausible() {
  const key = process.env.PLAUSIBLE_KEY;
  if (!key)
    return {
      status: "missing",
      note: "No Plausible key in .env",
      visits: [],
      waitlist: { rows: [], withProp: false },
      requests: { rows: [], withProp: false },
    };
  const { registerGoal, waitlistGoal, requestGoal } = config.plausible;
  const visitors = perDay(
    await plausibleQuery(key, { metric: "visitors", dimensions: ["time:day"] }),
  );
  const clicks = perDay(
    await plausibleQuery(key, {
      metric: "events",
      dimensions: ["time:day"],
      goal: registerGoal,
    }),
  );
  const dates = [
    ...new Set([...Object.keys(visitors), ...Object.keys(clicks)]),
  ].sort();
  return {
    status: "connected",
    note: "Connected",
    visits: dates.map((date) => ({
      date,
      visitors: visitors[date] || 0,
      registerClicks: clicks[date] || 0,
    })),
    waitlist: await goalRows(key, waitlistGoal, "heardFrom"),
    requests: await goalRows(key, requestGoal, "city"),
  };
}

// ── Write data.js ─────────────────────────────────────────────────────────

async function safely(name, fn, fallback) {
  try {
    return await fn();
  } catch (e) {
    console.error(`${name}: ${e.message}`);
    return { status: "error", note: e.message, ...fallback };
  }
}

const stripe = await safely("Stripe", loadStripe, { orders: [] });
const plausible = await safely("Plausible", loadPlausible, {
  visits: [],
  waitlist: { rows: [], withProp: false },
  requests: { rows: [], withProp: false },
});
// Signups ride on Plausible, so they share its status.
const formSource = (goal, prop) =>
  plausible.status === "connected"
    ? {
        status: "connected",
        note: `From the "${goal}" goal`,
        withProp: plausible[prop].withProp,
      }
    : { status: plausible.status, note: "Needs Plausible", withProp: false };

const data = {
  generatedAt: new Date().toISOString(),
  today,
  sample: false,
  config: {
    workshops: config.workshops.map(({ paymentLinks, ...w }) => w),
    notes: config.notes,
    reminders: config.reminders,
  },
  sources: {
    stripe: { status: stripe.status, note: stripe.note },
    plausible: { status: plausible.status, note: plausible.note },
    waitlist: formSource(config.plausible.waitlistGoal, "waitlist"),
    requests: formSource(config.plausible.requestGoal, "requests"),
  },
  orders: stripe.orders,
  visits: plausible.visits,
  waitlist: plausible.waitlist.rows,
  requests: plausible.requests.rows,
};

writeFileSync(
  join(here, "data.js"),
  `window.YXO_DATA = ${JSON.stringify(data, null, 1)};\n`,
);
for (const [name, s] of Object.entries(data.sources))
  console.log(`${name.padEnd(10)} ${s.status.padEnd(10)} ${s.note}`);
console.log("Wrote data.js. Open index.html to see it.");
