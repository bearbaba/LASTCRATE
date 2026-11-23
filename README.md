# LASTCRATE — Match the rescue, reconcile the crates

**One-liner:** LASTCRATE matches time-sensitive food donations with kitchens that can receive them, then verifies what actually changed hands.

## Exactly two GenLayer Intelligent Contracts

1. **contracts/RescueMatcher.py** — Donor opens and seals a bounded food donation case. Each kitchen account submits a natural-language reception note with its own signature. GenLayer interprets time/capacity constraints, checks exact source quotations and obtains independent validator assessment. After interpretations, deterministic code selects the kitchen that can receive **the most crates before the deadline**. Tie breakers: earliest ETA, shortest declared distance, kitchen ID. Unallocated crates stay explicit. Allocation record is readable by ID.
2. **contracts/HandoffLedger.py** — Reads the allocation **directly** from RescueMatcher. Only the linked driver and selected kitchen wallets may confirm their respective quantities, each only once. COMPLETE = both agree on full quantity; PARTIAL = both agree on lower quantity; DISPUTED = differing claims; PENDING until both confirmations.

The ledger establishes what parties said, **not that physical delivery was independently observed**.

## Steward scenario (3-minute walkthrough)

In **Review scenario**:

1. Start with 18 vegetable crates available at 16:40, deadline 17:30.
2. Kitchen A (closer) says "After 17:00, one staff member can receive at most 6 crates." Kitchen B (farther) says "We can receive up to 18 crates until 17:30."
3. Inspect Kitchen B selected for 18 crates, with A's 6-crate limit highlighted as source evidence.
4. Click **Move B to 17:45**. Its advertised 18-crate capacity stays constant; only the reception start window changes. Kitchen B becomes ineligible, A receives 6 and **12 crates remain UNALLOCATED**.
5. Restore the seed case. Enter driver 16, kitchen 16: PARTIAL, 16 received and 2 missing. Enter driver 18, kitchen 16: DISPUTED with two distinct quantities; no fabricated agreed delivery count.
6. Change kitchen note directly and inspect the bounded local preview.

The preview is a **non-consensus test fixture**. On-chain source interpretation is performed inside RescueMatcher and needs real GenLayer transactions.

## Actual GenLayer review

**No live GenLayer addresses or successful transactions have been verified yet.**

1. Deploy RescueMatcher (no constructor arguments), then HandoffLedger with actual RescueMatcher address as constructor argument.
2. Configure **NEXT_PUBLIC_RESCUE_MATCHER_ADDRESS** and **NEXT_PUBLIC_HANDOFF_LEDGER_ADDRESS** in Vercel or local environment.
3. Donor wallet calls **open_case** with case ID, item name, quantity, pickup, deadline and driver wallet. Each kitchen switches to its own wallet and calls **submit_offer**. Donor calls **seal_case** and **match_case**.
4. Publicly read **get_allocation(case_id:a1)**. Inspect every offer, exact quote, parsed reception window, capacity, selected wallet and unallocated quantity.
5. Switch to driver wallet to call **confirm_dispatch**. Switch to the selected kitchen wallet to call **confirm_receipt**. Read **get_handoff** and check PARTIAL or DISPUTED.
6. Every write must reach **FINALIZED and successful execution** before it becomes evidence. Create a new case ID for the alternative 17:45 experiment; a sealed case cannot be edited.

## Local development

Node 22+ recommended: **npm install**, **npm run dev**, **npm run test**, **npm run typecheck**, **npm run build**.

- **app/page.tsx** compact donation and handoff lab, plus wallet-signed on-chain workflow.
- **lib/demo.ts** bounded deterministic preview; **lib/genlayer.ts** stable GenLayerJS wallet client.
- **fixtures/review.json** editable scenario and expected results.
- **tests/demo.test.ts** exercises quantity maximize, cutoff, missing crates, disputes and invalid receipts.
- **.github/workflows/ci.yml** checks tests, TypeScript, Next.js build and Python syntax.

No hosted backend, API keys, paid AI model or custody required for reviewer preview. Live GenLayer calls may require test GEN and compatible network support.

## Limitations and honest claims

- Distance and arrival are caller-submitted declarations, not map-verified routes or measured travel.
- Data is bounded to same-day handoffs, integer crates and up to 10 receiving offers.
- No temperature, safety, legal, refrigeration or quality certification is performed.
- Intake interpretations are independently checked via GenLayer validator logic but still subject to model and consensus errors; production use requires adversarial E2E testing.
- **Unverified:** deployed contracts, cross-contract GenVM execution, finalization receipts and real delivery measurements. Never claim source code or local fixture tests prove these.

Official GenLayer documentation: https://docs.genlayer.com/developers/intelligent-contracts/examples/snippets
