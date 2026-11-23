import test from "node:test";
import assert from "node:assert/strict";
import {matchOffers,seedOffers,LATE_B,reconcile} from "../lib/demo.ts";
test("B wins despite longer distance when A is limited to six",()=>{
 const m=matchOffers(seedOffers);
 assert.equal(m.selected?.id,"Kitchen B");
 assert.equal(m.allocated,18);assert.equal(m.unallocated,0);
 assert.equal(m.evaluations[0].feasible,6);
});
test("B opens at 17:45: only six to A and twelve unallocated",()=>{
 const offers=seedOffers.map(x=>x.id==="Kitchen B"?{...x,note:LATE_B}:x);
 const m=matchOffers(offers);
 assert.equal(m.selected?.id,"Kitchen A");
 assert.equal(m.allocated,6);assert.equal(m.unallocated,12);
 assert.equal(m.evaluations[1].feasible,0);
});
test("two reports of 16 produce partial 16 received, 2 missing",()=>{
 assert.deepEqual(reconcile(18,16,16),{status:"PARTIAL",planned:18,driver:16,kitchen:16,received:16,missing:2});
});
test("driver 18 vs kitchen 16 is disputed, not a fabricated receipt",()=>{
 const m=reconcile(18,18,16);assert.equal(m.status,"DISPUTED");assert.equal(m.received,null);
});
test("reject over-receipts; pending cannot be called complete",()=>{
 assert.throws(()=>reconcile(18,19,16));
 assert.equal(reconcile(18,16,null).status,"PENDING");
});
