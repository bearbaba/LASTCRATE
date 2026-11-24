# LASTCRATE — Steward verification guide

**Recorded browser-wallet demonstration: 24 November 2026 | GenLayer Studionet (chain ID 61999)**

## 1. Quick review

- Website: https://lastcrate.vercel.app/
- Demo video: https://youtu.be/23loPLir3tY
- [Open the completed case](https://lastcrate.vercel.app/?case=lastcrate-261124-85ad2e)
- Case ID: `lastcrate-261124-85ad2e`
- Allocation ID: `lastcrate-261124-85ad2e:a1`
- [RescueMatcher source](contracts/RescueMatcher.py) · [HandoffLedger source](contracts/HandoffLedger.py)

The recorded demo shows seven browser-wallet submissions from three distinct participating wallets (the donor also acts as driver). The workflow ends in a COMPLETE ledger record. It is a test-network demonstration, not a claim of real food delivery or a production mainnet deployment.

## 2. Active contracts

| Intelligent Contract | Studionet explorer |
| --- | --- |
| RescueMatcher | [0xc38Ed838F7d35f7F1f9a5888de5900D47f940Af2](https://explorer-studio.genlayer.com/address/0xc38Ed838F7d35f7F1f9a5888de5900D47f940Af2) |
| HandoffLedger | [0x77C85f398afE09debc331C249E0373109c279F83](https://explorer-studio.genlayer.com/address/0x77C85f398afE09debc331C249E0373109c279F83) |

## 3. Reproduce the verification without signing a write

1. Open the completed-case URL above in a compatible browser with a test wallet. Connect Wallet and select GenLayer Studionet. The deep link selects the signing workspace and the existing case ID. Do not select New ID or replay any of the writes.
2. In **Donor opens**, click **Read case**. Expand **View raw contract response** if needed. Verify the case ID, 18 crates, pickup 16:40, deadline 17:30, two offers, sealed=true and matched=true.
3. In **Consensus match**, click **Read allocation**. Verify Kitchen A, allocated_crates=6, unallocated_crates=12 and the per-kitchen evaluations. Kitchen B's receiving window begins after the donation deadline.
4. In **Signed handoff**, click **Read handoff**. Verify status=COMPLETE, planned=6, driver_report=6, kitchen_report=6, received=6 and missing=0. Expand the raw response to inspect the allocation ID and signer bindings.
5. Inspect the [opening transaction](https://explorer-studio.genlayer.com/tx/0xfd59ee63444289090a96e2f76cc97aa24a572099a3c48b2fb404eed890cfb9cf) and [final handoff transaction](https://explorer-studio.genlayer.com/tx/0x23614973904580e38442d54115c0f2b24977e44cf9a860e05efc3c6fc8c4f3a2) on GenLayer Explorer. The final demo records FINALIZED, Accepted consensus and successful execution.

These contract views are read-only. No new transaction or test GEN expenditure is required for review. Saved transaction history is browser-local; a reviewer on a different device should use the case readbacks, video and Explorer links rather than expect the original browser's history to appear.

## 4. Recorded workflow and expected state

| Step | Contract method | Signer role | State to inspect |
| --- | --- | --- | --- |
| 1 | open_case | Donor | Case exists; 18 crates |
| 2 | submit_offer | Kitchen A | First offer stored |
| 3 | submit_offer | Kitchen B | Second offer stored |
| 4 | seal_case | Donor | sealed=true |
| 5 | match_case | Donor | Allocation stored; 6 assigned, 12 unallocated |
| 6 | confirm_dispatch | Driver | driver_report=6 |
| 7 | confirm_receipt | Kitchen A | kitchen_report=6; COMPLETE |

The seven steps are shown in the linked video. The two transaction links above belong to this recorded browser case; the separate [23 November Studio verification log](https://github.com/bearbaba/LASTCRATE/issues/1) documents an earlier case and must not be confused with the browser case.

## 5. Why GenLayer is central

RescueMatcher interprets natural-language receiving conditions under bounded constraints. Where nondeterministic interpretation is needed, GenLayer validator equivalence checks govern the proposed result. The contract then applies deterministic capacity, time-window and tie-breaking rules. HandoffLedger reads the allocation and enforces the authorized driver and selected kitchen signers; neither party can silently substitute its own report for the other's.

## 6. Evidence and limitations

- A transaction being FINALIZED does not alone establish successful execution. Inspect consensus and execution in Explorer.
- The hosted RPC may omit detailed transaction receipts. The app separately checks contract state after finalization and labels observed state as such; that observation is not independent proof of causation by a particular transaction hash.
- Local scenario previews are not live consensus outcomes. The live signing workspace uses public contract reads for its verified summary.
- COMPLETE means both authorized parties declared the full planned quantity. It is not independent proof of physical delivery, food quality or safety.
- This project is a Studionet prototype. It has not undergone an independent security audit.
- Do not bypass wallet security warnings. Use dedicated test accounts and verify the site, network, contract addresses and transaction details before approving any write.

## 7. Source and automated checks

See [README](README.md) for setup and architecture. Run `npm run test`, `npm run typecheck`, and `npm run build`. The [GitHub Actions history](https://github.com/bearbaba/LASTCRATE/actions) contains frontend and GenLayer contract checks. Mocked/direct-mode tests complement but do not replace live network evidence.
