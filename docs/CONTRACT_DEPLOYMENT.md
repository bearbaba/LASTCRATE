# LASTCRATE — Contract verification and deployment

## Exactly two contracts

1. [RescueMatcher](../contracts/RescueMatcher.py) — source-grounded GenLayer AI interpretation of signed intake notes, then deterministic allocation, immutable version 1.
2. [HandoffLedger](../contracts/HandoffLedger.py) — reads the first contract by contract interface and checks two distinct signer confirmations. Stored receipt includes matcher address, allocation version and declared wallets.

## Test tiers

* TypeScript local preview tests: npm run test. NOT GenLayer consensus.
* Python syntax: python -m py_compile contracts/RescueMatcher.py contracts/HandoffLedger.py.
* Full GenVM compatibility: genvm-lint check contracts/RescueMatcher.py and genvm-lint check contracts/HandoffLedger.py.
* SDK direct-mode with mocked LLM and simulated contract read: pytest -q tests/contracts. NOT real network validation.
* Real hosted Studio: deploy both contracts, submit the sample cases using wallet signatures, wait for FINALIZED and check get_allocation/get_handoff plus actual explorer transactions.

Direct tests currently use genlayer-test 0.29.2. That version expects the legacy artifact name genvm-universal.tar.xz on GenVM v0.3.0-rc7. CI first runs genvm-lint check, which downloads the official runner; the workflow copies that official artifact into gltest's direct-mode cache. This is a test tool workaround, not a modification to contract behavior.

## Deployment sequence — hosted Studionet (network 61999)

Never paste a private key or recovery phrase into this repository or a website.

1. In https://studio.genlayer.com upload RescueMatcher.py exactly as committed, choose Studionet, deploy with **no constructor arguments** using a wallet you control and record the address and transaction hash. A deployment initiation is NOT final success.
2. Upload HandoffLedger.py; its constructor accepts the **actual deployed RescueMatcher address**, not a donor address. Deploy and record the transaction and second address.
3. Check contract code in explorer and test cross-contract HandoffLedger get_handoff on a known allocated case (cross-contract read). The cross-call is not proved by direct tests and needs actual network inspection.
4. Configure the two **public only** environment variables on Vercel: NEXT_PUBLIC_RESCUE_MATCHER_ADDRESS and NEXT_PUBLIC_HANDOFF_LEDGER_ADDRESS. Redeploy only after both source contracts are tested.
5. Test the original case: donor opens, two independent kitchen wallets submit A and B offers, donor seals, donor matches. Read case:a1. B wins 18 because A is capped at 6.
6. New case ID, modify ONLY B's note to say delivery from 17:45 while retaining 18 nominal capacity. The selected recipient becomes A for 6 and 12 unallocated.
7. New case ID with original offers, have driver and selected kitchen each confirm 16. Read PARTIAL, received 16, missing 2.
8. Another new case ID with original offers, driver reports 18, selected kitchen reports 16. Read DISPUTED with both counts and no fabricated agreed received quantity.
9. Negative tests: wrong wallet, same driver and kitchen wallet, duplicate kitchen signer, over-reporting, second confirmation, no eligible kitchen.
10. Archive finalized transaction hashes, contract addresses, explorer URLs and readback JSON under docs/evidence only after each is independently verified.

### CLI alternative

From repository root using the locally authenticated GenLayer CLI and the **correct intended network**:

    genlayer network set studionet
    genlayer network info
    genlayer deploy --contract contracts/RescueMatcher.py
    genlayer deploy --contract contracts/HandoffLedger.py --args 0x<ACTUAL_MATCHER_ADDRESS>

The second command must use the address printed from a finalized successful first deployment. Never invent or prefill an address. The code uses the pinned SDK header and synchronous cross-contract .view() calls supported by GenLayer documentation.

### Scope / limitations

* Unit tests and direct-mode mocks do NOT establish live AI consensus; LLM interpretations can vary and require adversarial network runs.
* Arrival and distance are declared by kitchens, not independently measured. The time is same-day HH:MM.
* HandoffLedger stores statements by two wallets; it cannot independently establish physical transfer, quality or safety.
* This repo does not claim finalization or contract addresses until real explorer readbacks exist.

## Studionet incident 2026-11-23: 16-crate case and AI interpretation rollback

Transaction `0x7d0aa0ec736dffd87162f3c6c721bccfaecff1feac1a71f2df3884cbc87ce215` finalized **with GenVM ERROR**, consensus **Undetermined**, `Unsupported kitchen interpretation`, rotation 3. Finality is not execution success.

The existing RescueMatcher source rejected any interpreter capacity greater than `min(nominal_capacity, lot_crates)`. For a 16-crate lot and a kitchen that explicitly accepts 18, an otherwise valid AI interpretation `capacity=18` therefore fails validation. The actual rejected candidate is not fully revealed in the user-supplied EP outputs, so this is a plausible source-level failure mechanism, not proven as that exact transaction's only cause. Another shown candidate had a reception start of 00:00 despite a note saying 'After 17:00', indicating additional semantic disagreement.

Fix: interpret **intake capability** independent of lot quantity (still capped by the signed kitchen's nominal capacity), then deterministically cap actual allocation by lot quantity. Added direct-mode regression test covering 16 in inventory and 18 receivable, expected 16 allocated.

**Deployment warning:** editing GitHub source does NOT change the existing deployed contract at `0xb26b2C9b2aa91D275055B32b861D5276dC3D0347`. To deploy patched code, create a NEW RescueMatcher and a NEW HandoffLedger whose constructor is the new matcher address. The earlier successful 18→16 PARTIAL proof remains at the original pair. A failed `match_case` rollback does not create a new allocation. Re-running on the old contract may behave differently due to LLM nondeterminism, but may fail again and consume more test GEN.


## Studionet incident 2026-11-23: late Kitchen B consensus undetermined twice

The first matching transaction for sealed case `lastcrate-231126-lateb`,
`0xada119cf799312a1deff9053577d7eeeafe9ebb04b9457dbc4a438919e774655`,
and the second attempt
`0x93ca44d66263987af9f67805ea0dd9a3a53a4cb8a448f47404a6d26fac300c62`,
were FINALIZED with GenVM SUCCESS **but consensus Undetermined (rotation 3)**.
These are *not* accepted allocations. The user provided a `get_case` readback
showing `sealed=true, matched=false, allocation_id=""`.

The EP trace for Kitchen A, whose signed note explicitly said
"After 17:00, one staff member can receive at most 6 crates.", gave
`capacity=6, from=00:00`, an unsupported opening time. Kitchen B's
"but only from 17:45 onwards" was interpreted as `capacity=0, from=17:45`
at planned arrival 17:15. The different interpretations are a plausible
source of validator disagreements; the exact validator votes are not
provided, so this is not a proven unique root cause.

The proposed source remediation is a **conservative bounded grammar**
for clear English "after", "until" and "but only from ... onwards" intake
notes with numeric crate caps. It requires the *whole note* to match,
so it does not drop unknown caveats like "except today". Explicit windows
and capacity become deterministic on that narrow path; all other
receiving notes still use GenLayer nondeterministic LLM interpretation
with independent validation. This trades AI calls on simple prose for
consistent treatment of high-stakes temporal restrictions, and should
be described as a hybrid matcher, not an all-LLM interpreter.

**Important:** unit/direct-mode tests and local grammar coverage are NOT
evidence that 5-validator GenLayer consensus will accept the newly
versioned source. The deployed original matcher and its linked ledger
remain unchanged. Redeploy and verify a NEW pair, and preserve existing
PARTIAL/DISPUTED readbacks from the old pair.
