import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync("app/page.tsx","utf8");
const css=readFileSync("app/globals.css","utf8");

test("classic LASTCRATE home and evidence are the default; signing requires a tab selection",()=>{
 assert.match(page,/useState<Tab>\("proof"\)/);
 assert.match(page,/className="hero"/);
 assert.match(page,/className="proofHero"/);
 assert.match(page,/tab==="dispatch"&&/);
 assert.match(page,/03 \/ Sign on GenLayer/);
 assert.match(page,/tab==="chain"&&<div className="lcSignPane"/);
 assert.match(css,/\.lcSignPane\{height:calc\(100dvh/);
});
test("signing tab keeps all four compact wallet action stages",()=>{
 for(const stage of ["donation","kitchens","allocation","handoff"]){
  assert.ok(page.includes('stage==="'+stage+'"'),stage+" tab action missing");
 }
 assert.match(page,/aria-label="Rescue workflow steps"/);
 for(const action of ["open_case","submit_offer","seal_case","match_case","confirm_dispatch","confirm_receipt","get_case","get_allocation","get_handoff"])
  assert.ok(page.includes(action),action+" absent");
});
test("background-in-tab status tracking, saved hashes and recorded evidence remain visible",()=>{
 for(const feature of ["TX_HISTORY_KEY","pendingTx","txHistory","Recorded proof and contract addresses","proof.allocationId"])
  assert.ok(page.includes(feature),feature+" absent");
 assert.doesNotMatch(page,/Existing transaction hash|Follow transaction/);
});
