import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync("app/page.tsx","utf8");
test("single workspace replaces separate long app tabs",()=>{
 assert.match(page,/className="lcApp"/);
 assert.match(page,/aria-label="Rescue workflow steps"/);
 assert.match(page,/stage==="donation"/);
 assert.match(page,/stage==="kitchens"/);
 assert.match(page,/stage==="allocation"/);
 assert.match(page,/stage==="handoff"/);
 assert.doesNotMatch(page,/setTab\(|tab==="proof"|tab==="dispatch"|tab==="chain"/);
});
test("wallet actions, readbacks, tracking and historical proof remain accessible",()=>{
 for(const action of ["open_case","submit_offer","seal_case","match_case","confirm_dispatch","confirm_receipt","get_case","get_allocation","get_handoff"])
  assert.ok(page.includes(action),action+" absent");
 for(const feature of ["TX_HISTORY_KEY","pendingTx","txHistory","Recorded proof and contract addresses","proof.allocationId"])
  assert.ok(page.includes(feature),feature+" absent");
});
