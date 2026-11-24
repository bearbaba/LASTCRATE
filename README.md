# LASTCRATE — Rescue the food. Account for every crate.

LASTCRATE coordinates a time-sensitive donation with receiving kitchens, interprets explicit intake limits through a GenLayer Intelligent Contract, and reconciles two **wallet-signed quantity declarations**. It does not claim that blockchain data or AI independently proves physical food delivery.

**Live application:** https://lastcrate.vercel.app/  
**GenLayer network:** Studionet (test network)  
**Latest browser-wallet demo:** https://youtu.be/23loPLir3tY  
**Steward review:** [VERIFICATION.md](VERIFICATION.md) — 24 November 2026, seven browser-wallet writes  
**Historical Studio evidence log:** https://github.com/bearbaba/LASTCRATE/issues/1

## Deployed intelligent contracts

These are the two **active** contracts used by the public app. There is only one LASTCRATE product; historical redeployments are not separate product editions.

| Contract | Role | Active Studionet address |
|---|---|---|
| [RescueMatcher](contracts/RescueMatcher.py) | Seals donation cases, interprets each signed receiving note, allocates feasible quantity by a deterministic tie-breaking rule | `0xc38Ed838F7d35f7F1f9a5888de5900D47f940Af2` |
| [HandoffLedger](contracts/HandoffLedger.py) | Reads a matching allocation and reconciles one driver declaration and one chosen-kitchen declaration | `0x77C85f398afE09debc331C249E0373109c279F83` |

The ledger's public `get_handoff` readback reports `matcher_address=0xc38Ed838F7d35f7F1f9a5888de5900D47f940Af2`, demonstrating the deployed cross-contract pairing. Source-to-deployment equivalence has not been independently audited; successful test scenarios are not a third-party security audit.

## Verified Studionet case: 18 offered → 6 assigned → COMPLETE

This was observed with real wallet-signed transactions and recorded Studio public reads on **November 23, 2026**. The immutable test identifier includes an internal development suffix; it is not a LASTCRATE product version.

- `case_id`: `lastcrate-231126-v2-lateb`
- `allocation_id`: `lastcrate-231126-v2-lateb:a1`
- Donation: 18 vegetable crates; pickup 16:40; deadline 17:30.
- Kitchen A: "After 17:00, one staff member can receive at most 6 crates." ETA 17:05; reported distance 2 km. **Eligible; capacity 6.**
- Kitchen B: "We can receive up to 18 crates, but only from 17:45 onwards." ETA 17:15; reported distance 7 km. **Not eligible**: `OUTSIDE_RECEPTION_WINDOW`; feasible capacity 0.
- `get_allocation` recorded `kitchen_id=Kitchen A`, `allocated_crates=6`, `unallocated_crates=12`.
- Driver wallet reported 6; selected Kitchen A wallet reported 6, independently.
- `get_handoff` recorded `status=COMPLETE`, `planned=6`, `received=6`, `missing=0`, and the correct RescueMatcher address.

All seven write transaction reports were **FINALIZED / Consensus Accepted / GenVM SUCCESS**:

| Step | Transaction |
|---|---|
| Donor opens donation | [open_case](https://explorer-studio.genlayer.com/tx/0x7cb21dafd14436ad7e6aad5c88979b867bb50f5dc0ff3c841589e153f4138add) |
| Kitchen A submits offer | [submit_offer A](https://explorer-studio.genlayer.com/tx/0x775b1a9a24006e614acd3b78b129372079418e2e6c992f52405cf8c79a0b9409) |
| Kitchen B submits offer | [submit_offer B](https://explorer-studio.genlayer.com/tx/0x9dcfa95c756df61b0e8e94b0130fd836ac2b0cab12c94bae2cfcc7dab8b9682b) |
| Donor seals case | [seal_case](https://explorer-studio.genlayer.com/tx/0x720e311ac40d885ca612a974d2abc27f52b595d377c96910060a6b01db8acdd7) |
| Donor performs allocation | [match_case](https://explorer-studio.genlayer.com/tx/0x17391ac1c95059be9968ab333b7317b7fd1929be4f47b8dfb82ea59560d28f11) |
| Driver signs report | [confirm_dispatch](https://explorer-studio.genlayer.com/tx/0xa4154e1f104d5bae1d3c52f47e38e2f0e79ad4e64ab7e011f9801558b6414431) |
| Kitchen A signs report | [confirm_receipt](https://explorer-studio.genlayer.com/tx/0x5cc8c8dff97fcecb657969275a2475e54b825c7d89642656d9a00d744b9bb603) |

Additional separately tested reconciliations: **PARTIAL** (both report 16 of a planned 18, missing 2) and **DISPUTED** (driver 18 versus kitchen 16, with no invented agreed receipt). Historical test evidence is preserved in [Issue #1](https://github.com/bearbaba/LASTCRATE/issues/1).

## Classic LASTCRATE homepage and dedicated signing tab

The original LASTCRATE branding, hero section, proof review, and deterministic local scenario are restored. On first load the public landing page selects **01 / On-chain evidence**, showing the recorded GenLayer case. **02 / Review scenario** provides the existing local-only preview. **03 / Sign on GenLayer** is a dedicated tab that appears only when selected; it is not expanded below the other pages.

Inside the signing tab the compact four-stage workspace remains:

1. **Donor opens:** enter a fresh Case ID, 18 crates, pickup 16:40, deadline 17:30 and driver wallet, then request the signed `open_case` transaction. The app checks `get_case` for existing IDs before signing.
2. **Kitchen offers:** each kitchen signs its own offer, with editable capacity and receiving-window notes.
3. **Consensus match:** the donor signs `seal_case` and `match_case` separately, then reads the actual allocation.
4. **Signed handoff:** driver and selected kitchen separately sign their quantities, then read the real `HandoffLedger` result.

The signing tab keeps its GenLayer status and saved transaction history in a side rail. On desktop only that panel or rail needs internal scrolling when the window is short; the other original product pages retain natural scrolling. Wallet signatures must always be approved by the user. A GenLayer transaction is automatically saved and followed in the same browser after its hash is returned, and saved pending transactions can be resumed explicitly after reconnecting.

All seed data remains editable. Deterministic local estimates are not represented as real consensus, and signed delivery counts are not independent physical delivery proof.

## Studionet consensus version, fee safety and browser wallet status

On **November 24, 2026**, read-only `sim_getFeeConfig` confirmed that the stable Studio RPC at `https://studio.genlayer.com/api` is running the **Consensus v0.6** line on chain ID **61999**. Before this update, two wallet-submitted EVM envelopes reverted (`eth_getTransactionReceipt.status=0x0`), and no corresponding Intelligent Contract transaction was created. Their cases were absent from RescueMatcher. A MetaMask confirmation screen or a returned EVM hash is not proof that an Intelligent Contract write succeeded.

LASTCRATE now probes the active Studio version and the chain identity **before signing**. An unknown or unreachable RPC blocks the write rather than falling back to a potentially incompatible SDK.

- **v0.6 Studio:** uses `genlayer-js-v2`, pinned to `2.0.0-rc.2`, and estimates fees for the **exact contract method and arguments** before any wallet transaction. The quote's distribution and fee value are passed unchanged to `writeContract`. The sender account and chain are checked again after estimation. The UI shows the estimated test-GEN deposit while awaiting wallet confirmation.
- **Legacy Studio:** uses the existing `genlayer-js` 1.1.x client. It is selected **only** if the RPC explicitly reports that `sim_getFeeConfig` does not exist.
- **RPC failure or unexpected chain/version:** signing is blocked and no transaction is submitted. No write is silently retried.

A read-only fee quotation for `RescueMatcher.open_case` using the pinned v0.6 SDK succeeded on the hosted Studionet on November 24, 2026, with a nonzero test-GEN budget. The temporary quotation test endpoint was removed after validation. **Update (24 November 2026):** a separate browser-wallet case completed all seven writes through the web application, with allocation and handoff readbacks and final Explorer evidence. See [VERIFICATION.md](VERIFICATION.md). The earlier Studio case remains separate historical evidence.

## Connect Wallet and sign a rescue case

1. Open the live site and click **Connect Wallet** in the header.
2. Approve the browser wallet connection and select **GenLayer Studionet (chain 61999)**.
3. Create a unique case ID, select your wallet role, and submit only the transaction permitted for your account. The donor opens and seals; each kitchen signs its own offer; the selected kitchen and driver sign separate quantity reports.
4. After each transaction, verify **FINALIZED + Accepted consensus + successful GenVM execution**. Public allocation and handoff reads do not require wallet access.
5. Account or network changes are reflected in the connection status. The contract enforces signer permissions.

Wallet connection does not submit a transaction or require private keys. Any wallet approval must be initiated and confirmed by the user.

## Automatic transaction status and recovery

The **Live GenLayer → Verification console** automatically follows the exact transaction that the connected wallet just signed. As soon as GenLayerJS returns a transaction hash, LASTCRATE saves the case ID, method, hash, submission time, latest status and any later on-chain updates in this browser's local storage. Users **do not** paste transaction IDs or click a separate Follow button.

While the browser tab is open, a visible loading indicator shows that the site checks the same-origin read-only endpoint `/api/tx-status` approximately every seven seconds. The status can progress through pending, proposing, committing, accepted and finalized. After a reload, a fresh case is selected unless a case-specific URL is supplied. Saved history is hidden by default and can be inspected after connecting and selecting Check saved transactions; unfinished hashes can be resumed without re-signing. Earlier pending hashes from the former single-hash storage key are migrated. The history is bounded to 60 recent hashes and stores public metadata only; no private keys or wallet secrets.

If the SDK throws an error containing a 32-byte transaction hash, the app also saves that hash and follows it instead of treating a timeout as a rejected transaction. If the wallet never returns a usable hash, the app explains that it cannot reconstruct one from nothing. Storage is **local to the same browser/device**; clearing browser data or using another device loses that local history. It is not a hosted database or a background notification service.

The follower reports verified receipt success only on FINALIZED with accepted consensus and successful execution. It also automatically reads the relevant contract state. The current Studionet RPC can return FINALIZED without exposing a detailed receipt; in that case LASTCRATE distinguishes observed contract state from verified receipt success. Inspect the public case, allocation or handoff readback and Explorer. Unknown network status, missing transactions and RPC errors must not be presented as definitive failures. No wallet write is automatically retried.

## Trust boundaries

- Source notes, ETA, distance, driver counts and kitchen counts are **claims supplied by participants**. No GPS, sensors, scale readings, or proof of food quality is included.
- A `FINALIZED` transaction with GenVM `SUCCESS` may still have **Undetermined** consensus. The frontend requires **majority agreement and successful execution** before reporting verified write completion. If a transaction fails verification after a hash was issued, inspect its Explorer record; do not blindly retry.
- `COMPLETE` means both signer-bound quantity reports equal the planned allocation. `PARTIAL` means both reports agree on fewer crates. `DISPUTED` means they differ; neither side's number is silently accepted as ground truth.
- The contract accepts up to 10 kitchens per same-day donation case. Explicit, bounded receiving grammar has deterministic safe handling; other supported notes use GenLayer nondeterministic evaluation with validator equivalence. Interpretation remains fallible.
- The website is hosted on Vercel, the contracts are on **Studionet**, not a public mainnet release. No paid AI service or hosted database is needed for the local preview. Real GenLayer test writes may require test GEN.

## Development and CI

```bash
npm install --no-audit --no-fund
npm run test
npm run typecheck
npm run build
```

Node.js 22+ recommended. Python CI compiles both contracts, runs GenVM lint/check and GenLayer SDK direct-mode tests (mock LLM/validator fixtures). Direct-mode tests do not prove live consensus. Frontend regression tests check the bounded preview, signer receipt reconciliation, and documented proof integrity.

- `app/page.tsx` — single-screen, four-step wallet-signed donation and handoff, compact automatic transaction status, collapsible historical evidence.
- `lib/evidence.ts` — immutable, explicitly dated Studio evidence plus Explorer links and readback formatting.
- `lib/rescue-case.ts` — fresh case identifiers and protection against duplicate openings.
- `lib/genlayer.ts` — Studionet client, read-only calls, and **consensus-aware** transaction validation.
- `lib/demo.ts` — deterministic local preview; never presented as a live contract result.
- `contracts/` — the two deployed Intelligent Contracts.

Official documentation: https://docs.genlayer.com/developers/decentralized-applications/writing-data
