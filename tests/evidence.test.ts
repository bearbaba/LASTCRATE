import test from "node:test";
import assert from "node:assert/strict";
import {proof,transactions,explorerTx,prettyReadback} from "../lib/evidence.ts";
import {assertAcceptedExecution} from "../lib/genlayer.ts";

test("documented public case is consistent from allocation to receipt",()=>{
 assert.equal(proof.planned+proof.unallocated,proof.requested);
 assert.equal(proof.driverReport,proof.kitchenReport);
 assert.equal(proof.received,proof.planned);
 assert.equal(proof.missing,0);
 assert.equal(proof.status,"COMPLETE");
 assert.equal(proof.allocationId,proof.caseId+":a1");
 assert.equal(proof.matcher.length,42);
 assert.equal(proof.ledger.length,42);
});
test("all documented hashes are distinct, complete and use official Studio Explorer",()=>{
 assert.equal(transactions.length,7);
 assert.equal(new Set(transactions.map(t=>t.hash)).size,transactions.length);
 for(const tx of transactions){
  assert.match(tx.hash,/^0x[0-9a-f]{64}$/);
  assert.equal(explorerTx(tx.hash),"https://explorer-studio.genlayer.com/tx/"+tx.hash);
 }
});
test("decode both regular and double-encoded JSON from public contract reads",()=>{
 const raw=JSON.stringify({planned:6,status:"COMPLETE"});
 const expected=JSON.stringify({planned:6,status:"COMPLETE"},null,2);
 assert.equal(prettyReadback(raw),expected);
 assert.equal(prettyReadback(JSON.stringify(raw)),expected);
 assert.equal(prettyReadback("not-json"),"not-json");
});
test("accept only committed majority agreement with successful GenVM execution",()=>{
 assert.doesNotThrow(()=>assertAcceptedExecution({result:1,resultName:"MajorityAgree",txExecutionResultName:"FinishedWithReturn",statusName:"Finalized"}));
 assert.doesNotThrow(()=>assertAcceptedExecution({resultName:"MAJORITY_AGREE",txExecutionResultName:"FINISHED_WITH_RETURN",statusName:"Finalized"}));
 assert.throws(()=>assertAcceptedExecution({result:5,resultName:"NoMajority",txExecutionResultName:"FinishedWithReturn",statusName:"Finalized"}),/Consensus was not Accepted/);
 assert.throws(()=>assertAcceptedExecution({result:1,resultName:"MajorityAgree",txExecutionResultName:"FinishedWithError",statusName:"Finalized"}),/GenVM execution/);
 assert.throws(()=>assertAcceptedExecution({txExecutionResultName:"FinishedWithReturn"}),/Consensus was not Accepted/);
});
