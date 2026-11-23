# LASTCRATE — Rescue the food. Account for every crate.

LASTCRATE coordinates a time-sensitive donation with receiving kitchens, interprets explicit intake limits through a GenLayer Intelligent Contract, and reconciles two **wallet-signed quantity declarations**. It does not claim that blockchain data or AI independently proves physical food delivery.

**Live application:** https://lastcrate.vercel.app/  
**GenLayer network:** Studionet (test network)  
**Evidence log:** https://github.com/bearbaba/LASTCRATE/issues/1

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

## Review in three minutes

1. Open https://lastcrate.vercel.app/. The opening **On-chain evidence** section documents the completed signed test. Select **Read allocation** and **Read handoff** for fresh, read-only queries to the active contracts. Network access is required; no wallet signature is needed.
2. Select **Review scenario** for the explicitly labeled *local preview*. Kitchen B initially receives 18 despite Kitchen A being closer. Click **Move B to 17:45**; Kitchen B becomes ineligible and Kitchen A receives only 6, leaving 12 unallocated. Local preview is not consensus evidence.
3. Select **Live GenLayer** to open a **new**, unique donation case and submit signer-bound writes: donor opens, each kitchen signs its offer, donor seals and matches, then driver and chosen kitchen separately attest their actual declared quantities. Read the resulting allocation and handoff.
4. Do **not** resubmit writes for the documented completed allocation. The UI disables writes when the recorded case ID is selected.

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

- `app/page.tsx` — proof-first UI, local scenario and GenLayer wallet-signed actions.
- `lib/evidence.ts` — immutable, explicitly dated Studio evidence plus Explorer links and readback formatting.
- `lib/genlayer.ts` — Studionet client, read-only calls, and **consensus-aware** transaction validation.
- `lib/demo.ts` — deterministic local preview; never presented as a live contract result.
- `contracts/` — the two deployed Intelligent Contracts.

Official documentation: https://docs.genlayer.com/developers/decentralized-applications/writing-data
