# Onboarding & Guided Setup Plan

This document plans the initial-setup flow and in-app guidance for new users.

---

## Implemented: Optional guided tour (first login only)

- **First login:** After login or create-account, the user is asked **"Would you like to take a short tour?"** (only once per person; choice is persisted).
- **If Yes:** Tour starts: user is sent to **Transactions**, then guided through **Bank Accounts**, **Categories**, **Classification**, **Transfer linking rules**, **ML Status**, **Import** (upload demo CSV), back to **Transactions**, **External Accounts**, **Analytics**, and **Themes**. A strip under the header shows the next step and a "Go to X" link. **Guides disappear once followed** (step is marked complete when the user visits the page or completes the action).
- **Demo data:** Tour directs users to upload the demo CSV (e.g. docs example + "Docs demo (German CSV)" profile). Accounts and external accounts created during the tour are tracked; if the user creates something off-prompt, a warning explains that demo data can be removed at the end.
- **End tour:** An **"End tour"** button in the top bar is available throughout. When clicked, the user is asked whether to **delete all demo data** (accounts and transactions created during the tour) for a fresh slate, or to keep the data.
- **Redirect:** Redirect to `/transactions` after import only when the user is in the tour; otherwise behaviour is unchanged.
- See the plan file in `.cursor/plans/` for the full step table, "Followed when" criteria, and technical notes.

---

## 1. Goals (original)

- After **login**, send users to the **Transactions** page so they are led naturally to **importing CSV data**.
- Use **small exclamation-mark notifications** on important buttons to draw attention.
- On **hover** over a notification, show a **banner** that explains what the button does and **why this step is recommended**.
- **Flow**: Login → Transactions → Import (first upload) → back to Transactions; then surface guidance on External Accounts, Bank Accounts, and Analytics.

---

## 2. Current State (Summary)

| Area | Current behavior |
|------|------------------|
| **Post-login** | Redirect to `from \|\| "/"` → **Dashboard** (`/`). |
| **Transactions** | Has "Import Data" button (links to `/import`). Main CTA for empty state is effectively "Import Data". |
| **Import page** | `/import` has Upload + Profiles tabs; **UploadPage** does CSV upload and shows toast on success; **no redirect** after upload. |
| **Sidebar** | Main: Dashboard, Analytics, Budgets, Transactions, Trips. Accounts: Bank Accounts, External Accounts. Config: Categories, Classification, Transfer Linking Rules, **Import**, People, ML Status. |
| **First-time detection** | Not implemented. Can derive "no transactions yet" from API or store a `setupCompleted` (e.g. localStorage or backend). |

---

## 3. Proposed UI Flow

### 3.1 Post-login redirect

- **Option A (simple):** Always redirect to **`/transactions`** after login (and after create-account success), instead of `/`.
- **Option B (smart):** Redirect to `/transactions` only when "first time" (e.g. no transactions for current person, or `!setupCompleted`); otherwise keep `from \|\| "/"` (Dashboard).

**Recommendation:** Start with **Option A** so every login lands on Transactions and the path to Import is obvious. We can add Option B later using a "has any transactions" check or a persisted setup flag.

**Files to change:** `frontend/src/pages/LoginPage.tsx` — change `navigate(from || "/", ...)` to `navigate(from || "/transactions", ...)` (and same for create-account success).

### 3.2 Default route for authenticated users

- **Optional:** When user hits `/` and is in "setup mode" (e.g. no transactions), redirect `/` → `/transactions` so Dashboard is only default once they have data. This can be done in `App.tsx` or a wrapper around `DashboardPage`.

### 3.3 After first import (Upload success)

- When user completes an upload on **Import** page (Upload tab), **redirect to `/transactions`** so they see their newly imported data.
- **Optional:** Only redirect when we consider this "onboarding" (e.g. first time they’ve imported, or opened Import from a guided flow). Otherwise keep current behavior (stay on Import, show toast).

**Files to change:** `frontend/src/pages/UploadPage.tsx` (or `ImportPage.tsx` if we pass a prop). Use `useNavigate()` and after successful `uploadFile` + toast, call `navigate("/transactions", { replace: true })`. Optionally gate on a prop like `redirectToTransactionsOnSuccess` or on a "setup mode" context.

---

## 4. Guide Notifications (Exclamation + Hover Banner)

### 4.1 Concept

- **Where:** On or next to specific buttons/links (sidebar items or page-level CTAs).
- **Visual:** Small **exclamation mark** icon (or "notification dot") that is visible but not overwhelming.
- **Interaction:** **Hover** over the notification (or the button that has the notification) → show a **banner** (tooltip/popover) with:
  - **What** the button does (one short line).
  - **Why** it’s a recommended step (one short line).

### 4.2 Placement (priority order for setup)

1. **Transactions → "Import Data"**  
   - Message: e.g. "Upload a CSV of your bank transactions so you can track and categorize spending."  
   - Why: "Importing data is the first step to see your finances in one place."

2. **Sidebar: Import**  
   - Same idea as above; can reuse copy if user didn’t start from Transactions.

3. **Sidebar: External Accounts**  
   - What: "Track investments, savings accounts, or other balances outside your main bank."  
   - Why: "Linking external accounts gives you a full picture of net worth and funding flows."

4. **Sidebar: Bank Accounts**  
   - What: "Add and manage the bank accounts you import from."  
   - Why: "You need at least one account before you can import transactions."

5. **Sidebar: Analytics**  
   - What: "View spending trends, category breakdowns, and insights."  
   - Why: "Best after you have imported and categorized some transactions."

### 4.3 When to show notifications

- **Option A:** Show on all the above targets until user **dismisses** a step (e.g. "Don’t show again" or "Got it" per step), stored in localStorage (e.g. `onboarding_dismissed_import`, `onboarding_dismissed_external_accounts`, etc.).
- **Option B:** Show only in **"setup mode"** (e.g. no transactions yet, or a short list of "completed" steps). Once they’ve imported once, hide "Import" hint; once they’ve opened External Accounts, hide that hint; etc.
- **Option C:** Combine: show in setup mode, and allow dismiss so returning users don’t see hints they’ve already seen.

**Recommendation:** Start with **Option A** (dismissible per step, localStorage). Add Option B/C later if we add a formal "setup completed" or step tracking.

### 4.4 Implementation approach

- **GuideBadge component:**  
  - Renders a small exclamation icon (e.g. `AlertCircle` or custom) next to the target (e.g. next to "Import Data", or in sidebar next to "Import" / "External Accounts" / "Bank Accounts" / "Analytics").  
  - Wraps or sits beside the button/link; on hover (or focus), shows a **banner** (popover/hover card) with title, "What", and "Why".  
  - Optional: "Don’t show again" / "Got it" that sets localStorage and hides this badge.

- **Banner content:**  
  - Short title (e.g. "Import transactions").  
  - Body: 1–2 sentences (what + why).  
  - Optional CTA: "Go to Import" or rely on the existing button.

- **UI components:** Use or add a **Popover** or **HoverCard** (e.g. Radix-based if already in the project) for the banner; ensure it’s keyboard- and screen-reader friendly.

- **Where to integrate:**  
  - **TransactionsPage:** Wrap or augment the existing "Import Data" `Button` with `GuideBadge` (content for "Import").  
  - **Sidebar:** For nav items "Import", "Bank Accounts", "External Accounts", "Analytics", add a small badge (e.g. next to the label when expanded) with the same hover banner; respect "dismissed" state so we don’t show badge after "Got it".

---

## 5. Technical Notes

- **First-time / setup state:**  
  - Can be derived from `getTransactions({ page_size: 1 })` → `total === 0`, or from a backend flag (e.g. `user.has_completed_initial_import`).  
  - For minimal change, use **redirect and dismissible badges only**; add "setup mode" later.

- **Redirect after upload:**  
  - `UploadPage` is used inside `ImportPage` as embedded. So redirect can be done in `UploadPage` with `useNavigate()` when `embedded` is true and upload succeeds; or pass a callback from `ImportPage` (e.g. `onUploadSuccess={() => navigate("/transactions")}`).

- **Accessibility:**  
  - Notifications should have `aria-label` and the banner should be reachable by keyboard (focus management) and announced to screen readers.

---

## 6. Other Options to Consider (Discussion)

- **Checklist / progress:** A small "Setup checklist" (e.g. in sidebar or Dashboard when no data): "Add account → Import CSV → (optional) External accounts → View Analytics." Steps can be checked off when done (e.g. "Import" checked when `total transactions > 0`).
- **Empty-state CTAs:** On Dashboard when there’s no data, show a single prominent CTA: "Import your first transactions" → `/import` or `/transactions`.
- **First-visit tour:** One-time, step-by-step overlay (e.g. "This is Transactions; next you’ll import data") — more intrusive but very clear. Can be optional or behind a "Show tour" link.
- **Inline tips:** Short tips inside Import page (e.g. "Use a CSV with date, amount, and description columns") in a collapsible or dismissible block.
- **Video or short doc:** Link from Import or Transactions to a 30-second video or a "How to export from your bank" doc.
- **Smart order of hints:** After import, automatically show a hint for "Run ML on Unclassified" or "Review categories" on the Transactions page, then External Accounts, then Analytics.
- **Dismiss-all:** One "I’ve used the app before" that hides all onboarding badges at once (e.g. in a small "Skip setup tips" in the header or sidebar).

---

## 7. Implementation Order (Suggested)

1. **Post-login redirect** to `/transactions` (LoginPage + create-account path).
2. **Redirect after upload** from Import → `/transactions` (UploadPage or ImportPage).
3. **GuideBadge component** (exclamation + hover banner with What/Why; optional dismiss).
4. **Transactions page:** Add GuideBadge to "Import Data" button.
5. **Sidebar:** Add GuideBadge to Import, Bank Accounts, External Accounts, Analytics (with per-step dismiss).
6. **(Optional)** Default route `/` → `/transactions` when no transactions.
7. **(Optional)** Setup checklist or empty-state CTA on Dashboard.

---

## 8. Copy (Draft)

| Target | What (short) | Why (recommended step) |
|--------|----------------|------------------------|
| Import Data (Transactions) | Upload a CSV of your bank transactions to track and categorize spending. | Importing data is the first step to see your finances in one place. |
| Sidebar: Import | Same as above. | Same. |
| Sidebar: Bank Accounts | Add and manage the bank accounts you import from. | You need at least one account before you can import transactions. |
| Sidebar: External Accounts | Track investments, savings, or other balances outside your main bank. | Linking external accounts gives you net worth and funding flow insights. |
| Sidebar: Analytics | View spending trends, category breakdowns, and insights. | Most useful after you’ve imported and categorized some transactions. |

---

*Document created for planning; implementation can follow this order and adjust copy as needed.*
