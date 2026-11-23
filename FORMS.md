# Website forms: where they go and how to change them

The site has four forms. All send their answers to **Formspree** (formspree.io), a service that emails each submission to you and keeps a copy online.

| Form               | Where it is on the site                                   | What it asks                                                                                                                                                                                                                                                                                                           | Formspree form ID |
| ------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Waitlist           | "Join the waitlist →" button                              | Name, email, city, state/country, how they heard about YXO                                                                                                                                                                                                                                                             | `mzedjjql`        |
| Workshop request   | "Request a workshop →" button                             | Name, email, city, number of students, age range, hosting space                                                                                                                                                                                                                                                        | `mvkzwwjk`        |
| Virtual registration (Dec 5) | `register-virtual.html`, opened by the cohort card's Register button | Same as Miami registration below, for any number of teens, minus the food-allergy questions. The checkbox asks the teen to stay on camera, engaged and phone-free | `xqppezva` (shared with Miami; the `cohort` line and the email subject tell them apart) |
| Alpine registration (Dec 12) | `register-alpine.html`, opened by the Alpine cohort card's Register button | Same as virtual registration, plus the food-allergy questions from Miami. The checkbox asks the teen to stay engaged and phone-free for the whole day | `xqppezva` (shared; the `cohort` line and the email subject "New YXO Alpine registration" tell them apart) |
| Miami registration (closed) | `register-miami.html`, now sends visitors on to `register-virtual.html` | Teen's name, date of birth, grade, school; parent's name, email, phone; emergency contact's name, phone and relationship; food allergies and details; medical conditions, medication or other needs and details; how they heard about YXO; the phone-free-day checkbox; optional photo consent; agreement to the Terms | `xqppezva`        |

## The Dec 5 virtual cohort

Live on Zoom, Sat, Dec 5, 2026, 10 AM to 4 PM Eastern. **$100 USD per student**, no sibling or bundle pricing.

1. A parent clicks "Register" on the cohort card. That opens `register-virtual.html`.
2. They fill in the form for their first teen. To register more, they click **+ Add another teen** and fill it in again; the parent's details, emergency contact, "how did you hear" and the Terms are asked only once. Each teen is a separate Formspree submission, with the same family reference code (like `yxo-vir-7k2p9q`) and a `teen` line ("Teen 2 in this family").
3. After **Continue to payment**, a last step lists the teens and tells the parent what quantity to choose on Stripe ("set the quantity to 3, one for each teen. Total: $300 USD"). A Payment Link can't preset the quantity, so the parent sets it on the Stripe page.
4. **Go to payment** opens the one live Payment Link, `https://buy.stripe.com/3cI3cubcq9U35CD1p59AA02` (Graceworks account), with the parent's email filled in and the reference code as `client_reference_id`. Stripe collects only email and card. Promotion codes are on.
5. After paying, Stripe sends them to `thank-you-virtual.html`, which offers a calendar invite for 10 AM to 4 PM ET and says the Zoom link comes by email. **Send the Zoom link to every family before Dec 5.**

Checking the numbers: the count of Formspree submissions with a family's reference code should match the quantity on that family's Stripe payment. If a family paid for fewer teens than they registered, follow up by email.

Canadian visitors (and others) may see the price in their own currency first. That is Stripe's Adaptive Pricing; the site always says "$100 USD per student".

Other differences from Miami: no food-allergy questions; ages are checked against Dec 5, 2026 (a date of birth from Dec 6, 2008 to Dec 5, 2013); the checkbox asks teens to stay on camera, engaged and phone-free. The old 2-student virtual link is deactivated and must not be used.

`register-miami.html` now redirects to `register-virtual.html`, keeping `?code=`, so old Miami ads and links reach the open cohort. Delete the redirect block at the top of that file to reopen it. The two Miami Payment Links are still active in Stripe, so someone with a saved Miami link can still pay $300.

## The Dec 12 Alpine, NJ cohort

In person in Alpine, NJ, Sat, Dec 12, 2026. **$300 USD per student**, no sibling or bundle pricing. Times and the exact address are not on the site yet: the thank-you page and calendar invite say they come by email.

It works exactly like the virtual cohort above (multi-teen form, one payment with quantity = number of teens), with these differences:

- Page: `register-alpine.html`. Reference codes look like `yxo-alp-7k2p9q`.
- Payment Link: `https://buy.stripe.com/14AeVcbcq3vFfdd6Jp9AA04` (`STRIPE_LINK` at the top of the script). In Stripe it must allow adjustable quantity, have promotion codes on, and send parents to `https://yxo.world/thank-you-alpine.html` after paying.
- If `STRIPE_LINK` is ever blanked, the form still saves registrations and the last step tells parents a payment link is coming by email within one business day.
- Food-allergy questions are back (in person). Allergy details are health information: see the privacy notes below.
- Ages are checked against Dec 12, 2026 (a date of birth from Dec 13, 2008 to Dec 12, 2013).
- `thank-you-alpine.html` offers an all-day calendar invite for Dec 12. Once the times are set, change it to timed `DTSTART`/`DTEND` (UTC; Eastern is UTC-5) and update the "Schedule" box.
- **Email every family the schedule, address, drop-off details and packing list before Dec 12.**

## How Miami registration worked

1. A parent clicks "Register 1 student" or "Register 2 students" on the Miami card. That opens `register-miami.html`.
2. They fill in the form once per teen. The parent's details, the emergency contact, "how did you hear" and the Terms checkbox are asked only on the first teen, but are included in every submission. Allergies, medical needs and photo consent are asked for each teen. Each submission goes to the Miami registration form in Formspree.
   The form only accepts teens who are 13 to 17 on the workshop day (for Nov 7, 2026, a date of birth from Nov 8, 2008 to Nov 7, 2013). A parent whose teen is just outside that range is told to email instead. For a new cohort, change `WORKSHOP_DATE` in the script and the `min` and `max` on the date-of-birth field.
3. After the last teen, the page sends them to Miami's Stripe checkout ($300 or $500) to pay, with the parent's email already filled in.
4. Every family gets a **reference code** like `yxo-mia-7k2p9q`. It appears in each Formspree submission (`reference`) and on the Stripe payment (as `client_reference_id`, also in the Stripe CSV export). Match the two to see which forms were paid for. A form with no matching payment means the parent didn't finish checkout.

The Stripe links and the Formspree address for this form are at the top of the script in `register-miami.html` (`STRIPE_LINKS` and `FORM_ENDPOINT`).

## Terms and photo consent

The Terms and Conditions live at `terms.html` (https://yxo.world/terms), linked from every page's footer. A parent can't continue to payment without ticking the Terms checkbox, so nobody reaches Stripe without agreeing.

Each registration email records:

- `agreedToTerms`: "Yes, terms dated November 17, 2026". The date is the "Last updated" date on the terms page, so you can tell which version a family agreed to.
- `photoConsent`: "Yes" or "No", per teen. Only use identifiable photos of teens whose form says "Yes". A parent can withdraw consent by email at any time.

**When you change the terms:** update the "Last updated" date in `terms.html` and the `TERMS_VERSION` line at the top of the script in `register-virtual.html` so the two match. The terms say changes don't affect registrations already paid for.

## Privacy policy

The Privacy Policy lives at `privacy.html` (https://yxo.world/privacy). It is linked next to "Terms" in every footer, under each of the three forms, and from section 9 of the Terms.

It describes exactly what the site does today: the Formspree forms, Stripe checkout (through Graceworks International Inc.'s account), Zoom, Plausible, the Meta Pixel and its events, Gmail, and GitHub Pages hosting. **Update it whenever a form asks a new question, a tracking script is added or removed, or a provider changes**, and move the "Last updated" date.

Still to confirm before it is final (also listed in a comment at the top of `privacy.html`):

- The mailing address for OpenExo Inc in section 1 is a highlighted placeholder. Search the file for `todo`.
- The retention periods in section 7 (allergy details 90 days, registration details 2 years, payment records 7 years) are proposals, not yet agreed. Note that Formspree stores each registration as one submission, so deleting allergy details earlier than the rest means exporting registrations without that column and deleting the Formspree copies.
- Section 6 promises that nothing typed into a form is sent to Meta. Every page now sets the pixel's `autoConfig` to false before it starts, which stops it collecting button text and page details on its own. **Automatic Advanced Matching** is a separate switch in Meta Events Manager and must stay off for the pixel, or that sentence becomes untrue.
- Who on the team can see Formspree submissions and the Gmail inbox. Allergy details are health information, so keep that list short.
- The draft suggested a cookie notice once the pixel went live. None has been added; that is a decision for the team and the reviewer.

## Discount codes

Discount codes are made in Stripe, not on the website. Adding or changing a code never needs a website change.

### Miami codes (Nov 7 cohort, now expired)

| Code       | What the parent pays | Works on            | Expires                       |
| ---------- | -------------------- | ------------------- | ----------------------------- |
| `MIAMI75`  | $75 instead of $300  | 1-student link only | Nov 8, 2026, 11:59 PM Eastern |
| `MIAMI200` | $200 instead of $300 | 1-student link only | Nov 8, 2026, 11:59 PM Eastern |

Stripe coupons are "dollars off", so these are really a $225 coupon and a $100 coupon, each limited to the 1-student product. On the 2-student link Stripe rejects them ("doesn't apply to items in your order"). Because of that, a parent who opens the site with a code sees only the 1-student option, plus a note to fill the form in and pay once per teen. A family with two teens using a code therefore does two separate $75 (or $200) checkouts.

If a future code should work on both packages, set `CODES_ONE_STUDENT_ONLY` to `false` at the top of the script in `register-miami.html`, and the seat picker comes back.

In Stripe the live coupons are `aJfPKtwv` ("Miami $75 ticket (1 student)") and `G8gR61vE` ("Miami $200 ticket (1 student)"). Two older coupons, `x3qZrZry` and `vxhIDAVk`, are archived with no codes attached and can be deleted under **Product catalog**, then **Coupons**. "Allow promotion codes" is already switched on for both Miami payment links.

### Making a new code

1. In Stripe, with **Test mode** switched off, go to **Product catalog**, then **Coupons**, then **New**. Choose a fixed amount and type the dollars off. For a "parent pays $X" code, enter $300 minus X and tick **Apply to specific products**, choosing the 1-student product. Set duration to **Once**, and set a **Redeem by** date so the code stops working after the workshop.
2. On that coupon, add a **Promotion code**. This is the word parents type, for example `MIAMI75`. Codes are not case-sensitive.
3. To check it without paying, open the live 1-student link, enter the code, and look at the total. To test a real charge, pay with your own card and refund it under **Payments** in Stripe. The processing fee (about $2.50) is not returned.

### Sending a code to parents

Parents can type the code on the Stripe payment page. Or send them a link that applies it for them:

- `https://yxo.world/register-miami.html?code=MIAMI75`
- `https://yxo.world/?code=MIAMI75` (the home page; the code follows them to the registration form)

The registration form then shows "Discount code MIAMI75 will be applied on the payment page", and Stripe fills it in at checkout. If the code is misspelt or has expired, Stripe quietly ignores it and the parent sees full price.

To see who used a code: each registration email has a `discountCode` line, and in Stripe each payment shows the promotion code that was applied. The Meta Pixel reports the full $300 as the purchase value even when a code was used, so ad results will look better than the money actually collected on those sales.

**The website code does not decide whose inbox gets the emails.** That is set inside the Formspree account that created the form. Both forms are now in our own Formspree account. (They used to be in Oliver's, under the IDs `mbdzoqln` and `xeergvol`; older submissions are still stored there.)

To change the "How did you hear about YXO?" choices, search `index.html` for `wl-source` and edit the `<option>` lines. Keep the `Other` option, because picking it shows the type-your-own box.

---

## Option A: Get the emails yourself (recommended)

You make your own Formspree forms and point the website at them. This takes about 5 minutes.

1. Go to **https://formspree.io** and sign up with the email address that should receive the signups.
2. Click **+ New Form**. Name it `YXO Waitlist`. Leave the email as your own.
3. Formspree shows an endpoint like `https://formspree.io/f/abcd1234`. Copy it.
4. Repeat for a second form called `YXO Workshop Requests` if you also want those emails.
5. Open `index.html` and search for `FORM_ENDPOINTS`. You'll find:

   ```js
   var FORM_ENDPOINTS = {
     workshop: "https://formspree.io/f/xeergvol",
     waitlist: "https://formspree.io/f/mbdzoqln",
   };
   ```

   Replace each address with your new one. Keep the quotes and the comma.

6. Save the file, then commit and push. The live site updates a minute or two after you push.
7. **Test it:** open the live site, join the waitlist with your own details, and check your inbox. The very first submission to a new Formspree form sends you a confirmation email. Click the link in it, or later submissions won't be delivered.

> Past signups stay in Oliver's Formspree account. Ask him to export them (in Formspree: open the form, go to **Submissions**, then **Export CSV**) so you don't lose anyone.

## Option B: Keep Oliver's forms, but also get the emails

Ask Oliver to log in to Formspree, open each form, go to **Settings**, then **Email notifications**, and add your address. Nothing on the website needs to change. (Extra recipients may need a paid Formspree plan.)

---

## Adding or changing a question on the waitlist form

Each question takes two edits in `index.html`.

**1. Add the box people type into.** Search for `wl-region`. Under that block, copy it and change the `for`, `id`, label and placeholder:

```html
<div class="form-group">
  <label for="wl-kids">Number of children</label>
  <input type="text" id="wl-kids" placeholder="e.g. 2" />
</div>
```

Add `required` inside the `<input ... />` if people must fill it in.

**2. Send the answer to Formspree.** Search for `function submitWaitlist`. Add a line to the list of answers:

```js
var data = {
  name: document.getElementById("wl-name").value,
  ...
  kids: document.getElementById("wl-kids").value,   // ← new line
  _subject: "New YXO waitlist signup",
};
```

The word before the colon (`kids`) is the label you'll see in the email. The `id` in step 1 and the `getElementById("...")` in step 2 must match exactly.

The workshop form works the same way. Its boxes start with `ws-` and its answers are listed in `function submitWorkshop`.

## Changing the email subject line

In `function submitWaitlist`, edit the text after `_subject:`. Formspree uses it as the subject of each notification email.
