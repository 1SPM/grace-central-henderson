/* A notification is read by whoever can see the screen.
 *
 * A toast, a float or a row in the live feed appears unprompted: on a phone
 * held in a pew, on a screen mirrored to a room, in a lock-screen preview.
 * Central Henderson is the live tenant, so here those are real members. Its
 * mobile page used to put "McDonald's: +$0.26 to Youth" over Home and
 * "Sarah J. gave $25 · Tithe" in the hero -- where a member shops, what they
 * spent, and what a NAMED other member gave.
 *
 * The rule: a notification may say that something happened and which ministry
 * it helped. No amount, no merchant, no other person's name. Amounts stay where
 * the member goes to look for them: the wallet balance and the Activity list.
 *
 * This reads source text, so it proves the strings are built without those
 * fields -- not what a given render looks like.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const PAGE = 'apps/member-web/public/tenants/central-henderson/grace_central_henderson_members_card_ios_app.html';
const html = fs.readFileSync(PAGE, 'utf8');

const body = (name) => {
  const m = new RegExp(`function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`).exec(html);
  assert(m, `${name}() still exists`);
  return m[1].replace(/\/\/[^\n]*/g, '');   // comments may name what is excluded
};

// ── "someone gave" toasts: Home hero stack and the Watch screen ────────────
{
  const toast = body('showDonationToast');
  assert(!/item\.(name|amount)/.test(toast), 'the giving toast shows neither the giver nor the amount');
  assert(!/\$/.test(toast), 'no currency in the giving toast');
  assert(!/innerHTML/.test(toast), 'the toast is built with textContent, so pool data is never parsed as markup');

  const pool = /var watchDonationPool = \[([\s\S]*?)\];/.exec(html);
  assert(pool, 'the toast pool still exists');
  assert(!/\b(name|amount)\s*:/.test(pool[1]),
    'the pool holds funds only -- a name or amount that is not there cannot leak into a toast');
}

// ── the round-up float over Home ───────────────────────────────────────────
{
  const float = body('showImpactFloat');
  assert(!/item\.(merchant|impact|spend)/.test(float) && !/formatMoney/.test(float),
    'the float names the cause, not the merchant or the amount');
  const initial = /id="impact-float-text">([^<]*)</.exec(html);
  assert(initial && !/[$\d]/.test(initial[1]), `the float's placeholder text has no amount: "${initial?.[1]}"`);
}

// ── rows in the live feed the bell opens ───────────────────────────────────
{
  const row = body('renderImpactNotification');
  assert(!/item\.(merchant|spend|impact|icon|bg)/.test(row) && !/formatMoney/.test(row),
    'a feed row carries the cause and date only -- the merchant icon is a tell too');

  const card = /id="impact-notify-card">([\s\S]*?)id="gv-tx-card"/.exec(html);
  assert(card, 'the live impact card still exists');
  assert(!/\$\s?\d/.test(card[1]), 'no amounts anywhere in the live impact card, including its static rows and footer');
  for (const name of ['Sarah', 'David', 'Michael', 'Lisa']) {
    assert(!card[1].includes(name), `no member is named in the live feed: found "${name}"`);
  }
  assert(!/Walmart|McDonald|Target|Chick-fil-A/.test(card[1]), 'no merchant is named in the live feed');
  assert(!/impact-notify-month/.test(html), 'the feed footer is a count (impact-notify-count), not a monthly total');
}

// ── and the amounts are still where a member looks for them ────────────────
assert(/id="gv-tx-card"/.test(html) && /id="gv-balance-display"/.test(html),
  'the wallet balance and the Activity list are untouched');

console.log('PASS: giving toasts, the round-up float and the live feed carry no amount, merchant or member name; the wallet and Activity still do. Source text only -- renders not verified here.');
