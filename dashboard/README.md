# YXO dashboard

A local page with the KPIs from the dashboard plan: visitors, signups, checkouts, paid students, revenue and seats left.

## See it

Open `index.html` in a browser. Until a source is connected it shows sample numbers under a yellow "Sample numbers, not real" banner.

## Load real numbers

1. Copy `.env.example` to `.env` and paste in the keys you have.
2. Run `node refresh.mjs` from this folder, then reload `index.html`.

Run step 2 again whenever you want fresh numbers. Each source is shown as connected, missing or failed at the top of the page.

## Lily's Stripe key

In Stripe, go to **Developers → API keys → Create restricted key**. Give it **Read** for Checkout Sessions, Payment Links and Refunds, and **None** for everything else. The key can read orders but never charge or refund anyone.

The dashboard only counts payments made through the workshop links in `config.json`. Anything else sold from the same account is ignored.

## Plausible

The site is set up in `config.json` as `yxo.world`. Plausible gives the visitors and three goals the site sends:

| Goal               | Sent when                         | Property            |
| ------------------ | --------------------------------- | ------------------- |
| `Register click`   | someone heads to Stripe checkout  | `seats`             |
| `Waitlist signup`  | the waitlist form is sent         | `heardFrom`, `city` |
| `Workshop request` | the workshop request form is sent | `city`              |

Each goal has to be added in Plausible (Site settings → Goals → Custom event) before it shows up.

Signups come from these goals, not from Formspree, because Formspree's free plan has no export. Formspree still emails every submission, and those emails are the only record of signups from before the goals went live. No names or emails are sent to Plausible.

## Kept off GitHub

`.env` and `data.js` are listed in `.gitignore`. They hold keys and real numbers and are never committed. This folder is inside the website repo, so anything committed here would also be published on yxo.world.
