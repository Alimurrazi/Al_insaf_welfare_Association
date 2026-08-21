# UI Improvement Plan — Non-Technical Users

Improvements discussed for making the app friendlier for the 15-member, mostly
non-technical (and mostly on-phone) audience. **Constraint: everything in this
plan works with the existing data model** — no new tables, no new columns.
Ideas that would need schema changes are parked in the "Deferred" section at
the bottom.

Suggested build order: 1 → 2 → 3 → 4 → 5 → 6, then 7–9 as follow-ups.

**Status: 1, 2, 3, 4, 6, and 7 are implemented** (test-first for the new
`src/lib` logic; unit suite + e2e specs updated and passing). Remaining:
5 (Logbook tick view), 8 (charts), 9 (batch entry).

---

## 1. Formatting pass — dates, months, amounts, labels ✅ done

Cheapest change, biggest readability payoff. The app currently "speaks
developer" in several places:

- **Dates**: ISO `2026-08-20` everywhere (passbook, deposit/top-up/expense
  rows, activity feed timestamps). Render as `20 Aug 2026` instead. Add one
  shared `formatDate` helper in `src/lib` and use it everywhere.
- **Months**: rows show `8/2026`. Use the existing `MONTH_NAMES`
  (`src/lib/month-names.ts`) so rows read `Aug 2026`.
- **Amounts**: no thousand separators — `Tk 150000.00` is hard to parse. Use
  `toLocaleString("en-IN")` for lakh-style grouping (`Tk 1,50,000`), which
  matches how Bangladeshi members read money. Consider dropping the `.00` —
  every value in this domain is whole taka, so the decimals are noise.
- **Labels**: Logbook column headers `OTP-1` / `OTP-2` are jargon (and collide
  with "one-time password"). Rename to `Top-up 1` / `Top-up 2`. Nav item
  "Manage annual top-ups" → "Top-ups" (the page title can carry "Manage").

## 2. Amount color fix ✅ done

`rowAmountClasses` in `src/components/styles.ts` colors amounts `text-accent`
— the same emerald that means "clickable" everywhere else (links, nav,
buttons). Non-technical users learn "green = tap it" and amounts are the most
prominent green text in the app, yet tapping does nothing. Also, expenses
render in the same green as deposits, and green money instinctively reads
"money in".

**Fix**: amounts become `font-semibold text-ink` (they still stand out — the
surrounding `ink-soft` muted text does the contrast work). Accent then means
only "interactive". Cheaper compromise: keep green for deposits/top-ups,
switch expense amounts to ink.

Everything else about the palette is right — keep the discipline of one
accent, gold = ADMIN badge only, danger = errors only. Don't add colors for
decoration.

## 3. Form UX — modals, feedback, sign-in polish ✅ done

Planned: move **Add** forms into modals/dialogs, Google logo on the sign-in
button, general text pass. Cautions and additions:

- **Don't break the add-another workflow.** The add-deposit form deliberately
  does not reset after submit, so an admin can record one payment covering two
  months by changing only the Month dropdown (see the comment in
  `src/app/deposits/add-deposit-form.tsx`). If the form moves into a modal:
  keep the modal open after save, show a visible "Saved ✓" confirmation, and
  offer an explicit "Add another" affordance.
- **Add success/error feedback — currently there is none.** A failed server
  action drops the user on Next's error screen. Add a toast/inline message for
  both success ("Deposit saved for Karim — Aug 2026") and failure ("Couldn't
  save — try again"), using the existing `danger`/`danger-soft` tokens for
  errors.
- **Edit forms can stay inline.** The expand-in-place pattern in
  `deposit-row.tsx` / `member-row.tsx` etc. is fine; modals earn their keep on
  the Add forms.
- **Sign-in page**: alongside the Google logo, add one sentence of context —
  e.g. "Member portal for tracking deposits and the land fund — only
  registered members can sign in."
- **Amount inputs**: placeholder like "e.g. 3000" and `inputMode="numeric"`
  so phones open the number keypad.

## 4. Dashboard: answer "am I paid?" ✅ done

The #1 question a member has is *"have I paid this month?"*. The current
dashboard shows only totals. Add:

- **Member status strip**: the 12 months of the current year with ✓/– per
  month, or simply "Paid through July 2026 · August due". Derivable entirely
  from existing `monthly_deposits` rows.
- **Admin variant**: "3 members haven't paid for August yet."

Status color rules (applies here and to the Logbook tick view below):

- Paid = `accent-soft` background with a ✓. **Never color alone** — always
  pair with a symbol (color-blind users).
- **"Unpaid" is not red.** `danger` means errors, and painting a member's late
  month in error-red in a shared view is socially loaded in a small
  association. Use a neutral empty cell. (A soft amber would need a new
  `warn` token — gold is reserved for the ADMIN badge — so stay neutral for
  now.)

## 5. Logbook grid — phone-friendly tick view

The 1400px sideways-scrolling table of `Tk 3000.00 (2026-08-15)` cells is the
most hostile screen in the app on phones. In order of preference:

1. **Tick view by default**: each cell is just ✓ (tinted `accent-soft`) or
   empty — matches the paper-logbook mental model. Tap a member's name for the
   detailed passbook (already exists). The grid then needs far fewer pixels.
2. At minimum: short amounts (`3,000`) without dates in cells — paid dates
   live in the passbook.

Either way:

- **Highlight the current month's column** header so the eye lands where the
  action is.
- **Highlight the signed-in member's own row** (`accent-soft` background) —
  "find yourself in the table" is the first thing every member does.

## 6. Activity feed — sentences, not database records ✅ done

The feed currently renders `2026-08-20 09:14 · Razi · CREATE ·
MONTHLY_DEPOSIT` plus `key: old → new` lines — an audit table, not a feed.
Render each entry as a sentence:

> "Razi added a deposit of Tk 3,000 for Karim (Aug 2026) — 2 hours ago"

with the raw field diff collapsed/secondary (shown mainly for edits). This is
display-layer work like the existing `ChangeLine` parsing — the tested
string shape of `summarizeActivityEntry` can stay. Use relative or friendly
timestamps instead of ISO.

*Implemented as `describeActivityEntry` + `getShareEntryMemberIds` in
`src/lib/activity.ts`, and `formatRelativeTime` in `src/lib/format.ts`
(falls back to the friendly absolute date/time at 7+ days old). The raw
diff moved into a collapsed native `<details>` element under each sentence.*

## 7. Navigation on phones ✅ done

Eight links wrap into a messy two-line header on phones. Group the three
admin links under one "Manage ▾" item, or collapse to a hamburger below `sm:`.

*Implemented: the three admin-only links (Members/Deposits/Top-ups) are now
one "Manage ▾" dropdown in `src/components/top-nav-links.tsx`, closing on
outside click, Escape, or selecting a link — cuts the admin header from 8
top-level items to 6.*

## 8. Charts (existing data only)

One or two simple charts **on the dashboard** — not a separate analytics page.
All data below is derivable from existing rows with group-by-month sums.

- **Monthly collections bar chart** (per selected year): deposits in `accent`,
  top-ups distinguished (stacked or split). Note: with 15 members paying fixed
  amounts this chart is nearly flat by design — its signal is dips (missed
  payments) and top-up spikes. Mainly an admin diagnostic.
- **Cumulative "balance in hand over time" line**: collections push the line
  up, each expense visibly steps it down. The most information-dense chart
  available from this data.
- **Skip**: a monthly *expense* chart (expenses are sporadic/lumpy — mostly
  empty columns and one giant bar, which misleads); any per-member chart (the
  Logbook grid already is the per-member month-wise view).

Implementation notes: datasets are tiny (12 bars), so server-rendered SVG
styled with the existing CSS tokens beats adding a chart library — no JS
needed, dark mode inherited from the CSS variables. Label values directly on
the marks in `font-mono tabular-nums` — phones don't hover.

## 9. Collection-day batch entry (bigger feature)

The admin's real monthly task is entering ~15 deposits after collection day —
fifteen round-trips through a 6-field form is the most painful thing in the
app. A "Record August deposits" screen: every member listed, amount pre-filled
from their last deposit, a checkbox per row, one save.

Fits the existing model exactly: each checked row writes an independent
`monthly_deposits` row plus its own `activity_log` entry — no schema change.

---

## Deferred — needs data-model changes (explicitly out of scope for now)

- **Land-purchase goal progress bar.** The single most motivating visual
  ("Tk 4,20,000 of Tk 10,00,000 · 42%" as a plain horizontal bar at the top of
  the dashboard), but nothing in the schema stores the target amount. Needs a
  small admin-editable `settings`/`fund_goal` table (whose edits must write
  `activity_log` entries, per domain rules). Revisit when a schema change is
  on the table.
- **Bengali/bilingual labels.** Worth deciding early so text passes aren't
  redone, but a later release.
