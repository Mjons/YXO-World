# Website forms: where they go and how to change them

The site has three forms. All send their answers to **Formspree** (formspree.io), a service that emails each submission to you and keeps a copy online.

| Form               | Where it is on the site                                   | What it asks                                                                                    | Formspree form ID |
| ------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| Waitlist           | "Join the waitlist →" button                              | Name, email, city, state/country, how they heard about YXO                                      | `mzedjjql`        |
| Workshop request   | "Request a workshop →" button                             | Name, email, city, number of students, age range, hosting space                                 | `mvkzwwjk`        |
| Miami registration | `register-miami.html`, opened by the Miami card's buttons | Teen's name, date of birth, grade, school, food allergies and details, how they heard about YXO | `xqppezva`        |

## How Miami registration works

1. A parent clicks "Register 1 student" or "Register 2 students" on the Miami card. That opens `register-miami.html`.
2. They fill in the form once per teen. Each submission goes to the Miami registration form in Formspree.
3. After the last teen, the page sends them to Miami's Stripe checkout ($300 or $500) to pay. Stripe collects the parent's name, email and phone.
4. Every family gets a **reference code** like `yxo-mia-7k2p9q`. It appears in each Formspree submission (`reference`) and on the Stripe payment (as `client_reference_id`, also in the Stripe CSV export). Match the two to see which forms were paid for. A form with no matching payment means the parent didn't finish checkout.

The Stripe links and the Formspree address for this form are at the top of the script in `register-miami.html` (`STRIPE_LINKS` and `FORM_ENDPOINT`).

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
