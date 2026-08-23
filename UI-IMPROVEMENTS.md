# UI Improvement Plan — Non-Technical Users

Improvements discussed for making the app friendlier for the 15-member, mostly
non-technical (and mostly on-phone) audience. **Constraint: everything in this
plan works with the existing data model** — no new tables, no new columns.
Ideas that would need schema changes are parked in the "Deferred" section at
the bottom.

Suggested build order: 1 → 2 → 3 → 4 → 5 → 6, then 7–9 as follow-ups.

**Status: 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, and 14 are implemented**
(test-first for the new `src/lib` logic; unit suite + e2e specs updated and
passing). Remaining: 8 (charts), 9 (batch entry).

The whole app was also visually redesigned against the "al-insaf" Figma file
(see §"Figma reference" below) — every screen now uses the spacing tokens in
item 10, restyled top nav (logo, underline tab indicator, avatar-initial +
role badge), and the table/card layouts described in items 11–14. Skipped
per the Deferred section below: the Land Goal stat tile and Registry Share
Value target (no stored fund goal), the password "Sign In as Admin" field,
"Notify Unpaid" reminders, fabricated activity-feed audit metadata
(Transaction Ref, Invoice Ref, Admin ID codes, etc.), and per-row "Amount
Due"/Status badges on the dashboard and Members tables (no stored per-share
price or member-active-status field to back them).

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

## 5. Logbook grid — phone-friendly tick view ✅ done

The 1400px sideways-scrolling table of `Tk 3000.00 (2026-08-15)` cells is the
most hostile screen in the app on phones.

*Implemented as tick view by default* (`src/app/ledger/page.tsx`): each cell
is a ✓ tinted `accent-soft`, or a neutral `–` when unpaid — matches the
paper-logbook mental model. More than one payment landing in the same
month/cell (a real possibility per the schema) still shows a `×N` count
rather than silently collapsing. Tap a member's name for the detailed
passbook (already existed). The current month's column is highlighted, and
the signed-in member's own row gets an `accent-soft` tint.

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

## Figma reference (`al-insaf` file) — findings from a design review, not yet built

The team's Figma file (9 frames: sign-in, dashboard-admin, deposits, top-ups,
expenses, members, logbook, my-passbook, activity-feed) was reviewed against
the current app and schema. Two rules apply to everything below:

- **Currency: never `$`.** The Figma mockups render amounts as `$127,500`
  etc. — that's a placeholder from the design tool, not a spec. Every amount
  in this app renders via the existing `formatCurrency` (`Tk 1,27,500.00`,
  `src/lib/format.ts`). Ignore `$` anywhere it appears in the designs.
- **Spacing: follow the Figma file's measurements**, not ad hoc Tailwind
  values — see the token table below, extracted directly from the file's
  node positions (`get_metadata`/`get_variable_defs` — no variables are
  defined in the file, so there are no named spacing tokens, only raw
  pixel offsets between frames).

### 10. Spacing/padding tokens extracted from Figma

Measured from the `dashboard-admin` and `sign-in` frames (consistent across
the other 7):

| Purpose | Value | Closest Tailwind |
|---|---|---|
| Page/content side margin (left & right) | 40px | `px-10` |
| Top padding under the nav bar | 40px | `pt-10` |
| Gap between major dashboard sections (header → stat tiles → cards) | 32px | `gap-8` |
| Card internal padding | 28px | `p-7` |
| Gap between rows *inside* a card (e.g. Assigned Shares / Total Paid / Next Payment) | 16px | `gap-4` |
| Gutter between grid tiles (the 4 stat tiles, the 2 dashboard cards) | 24px | `gap-6` |
| Nav bar height | 72px | `h-18` (arbitrary — 72 isn't a default Tailwind step) |
| Gap between nav tabs | 8px | `gap-2` |
| Nav tab horizontal text inset | 12px | `px-3` |
| Table row left inset | 16px | `pl-4` |
| Table header row height | 35px | — |
| Table data row height | 59px | — |
| Sign-in card padding | 40px | `p-10` |
| Sign-in card internal section gap (tagline → actions) | 24px–34px | `gap-6`/`gap-8` |

**Current app doesn't match this today** — every page uses `px-6 py-12`
(24px/48px) on a `max-w-5xl` centered column (`src/app/*/page.tsx`), not the
Figma's 40px side margins on what reads as a full-width layout. Worth a
deliberate decision (adopt the Figma numbers app-wide, or keep the current
centered-column convention) before doing any layout work off these designs —
don't silently drift page-by-page.

### 11. Filters — Deposits & Top-ups search/filter bar (buildable now)

Figma adds a search-by-member box to both, plus a Month/Year filter on
Deposits and an Installment Cycle filter on Top-ups. No schema change —
`listDeposits`/`listTopups` already return everything needed; filter the same
way `expenses/page.tsx` already does via `searchParams`.

### 12. Running-total columns (buildable now)

- **Expenses**: a per-row "Running Total" column (Figma shows the balance
  stepping down after each expense) — computed by summing rows in date order
  while rendering, same idea as `sumExpenseAmounts` but cumulative instead of
  total-only.
- **My Passbook**: a "Ledger Balance" column that runs up with every deposit
  and top-up. Purely a render-time cumulative sum over `ledger.deposits` +
  `ledger.topups` merged and sorted by date — nothing stored, so it doesn't
  conflict with the "never a running balance" rule in `CLAUDE.md`.

### 13. Dashboard — passbook snapshot additions (buildable now)

- **Next Payment Due**: computed (1st of next month) — no storage needed.
- **"Your contributions account for X% of the acquired baseline parcel"**:
  Figma implies a land-goal ratio we don't have (see Deferred), but an
  approximation — personal total paid ÷ group total collected — is
  computable from `getDashboardSummary` + `getMemberLedger` today. Wording
  would need to say "of total contributions," not "of the parcel."
- **Per-row "Log Payment" quick action** on the admin's unpaid-members list —
  a link/modal straight into the existing `createDeposit` action, member and
  current month pre-filled. No new capability, just a shortcut into an
  existing form.

### 14. Members — inline share-change summary (buildable now, generic only)

Figma's "Share Allocation History" panel pairs each share change with a
hand-written reason ("Approved milestone registry top-up commitment") — that
text isn't stored anywhere and is Deferred below. But a **generic** sentence
("Shares changed from 1 to 2, effective 15 Mar 2025") is buildable today,
reusing the same diff logic `describeActivityEntry` already applies to
`MemberShare` entries in the activity feed — just surfaced inline on the
Members page too.

---

## Deferred — needs data-model changes (explicitly out of scope for now)

- **Land-purchase goal progress bar** (Figma: "Land Goal" dashboard tile,
  "Registry Share Value $X Target" on My Passbook). The single most
  motivating visual ("Tk 4,20,000 of Tk 10,00,000 · 42%" as a plain
  horizontal bar at the top of the dashboard), but nothing in the schema
  stores the target amount. Needs a small admin-editable
  `settings`/`fund_goal` table (whose edits must write `activity_log`
  entries, per domain rules). Revisit when a schema change is on the table.
- **Free-text reason on a share change** (Figma: "Approved milestone
  registry top-up commitment" in the Share Allocation History panel).
  `member_shares` only stores `shareCount`/`effectiveFrom` — no note field.
  A generic auto-generated sentence is buildable now (see item 14); a real
  admin-authored reason needs a new nullable column.
- **Activity Feed's fabricated audit metadata** (Figma: Transaction Ref,
  Invoice Ref, Destination account, Dispatch Method, Authority Ref, "Admin
  ID: #02"-style codes). Checked `deposits.ts`/`expenses.ts`/
  `member-shares.ts` — the activity log only ever stores the same raw model
  fields the form collects (memberId, amount, date, note, etc.). None of
  this metadata exists anywhere; reproducing it literally would mean adding
  new columns to `expenses`/`annual_topups` (invoice ref, recipient,
  destination), not just formatting existing data.
- **Bengali/bilingual labels.** Worth deciding early so text passes aren't
  redone, but a later release.

Two more Figma elements are blocked for reasons *other* than the data model,
so they stay out of scope regardless:

- **Password-based "Sign In as Admin" field** on the sign-in screen —
  conflicts with the Google-only allow-list auth design in `CLAUDE.md`.
- **"Notify Unpaid" → SMS/email reminders** — `CLAUDE.md` lists automated
  payment reminders as explicitly out of scope for this release; would also
  need real SMS/email infrastructure (Twilio/SendGrid), not a schema change.
