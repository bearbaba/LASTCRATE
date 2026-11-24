import test from "node:test";
import assert from "node:assert/strict";
import {isTransactionHash,normalizeSnapshot} from "../lib/tx-status.ts";
const HASH="0xc89b26b53deffcb952109cd683f531b388212404fdd8b9dd8a8cec78129385da";
test("accept only complete 32-byte GenLayer transaction hashes",()=>{
 assert.equal(isTransactionHash(HASH),true);
 assert.equal(isTransactionHash("0x1234"),false);
 assert.equal(isTransactionHash("not-a-hash"),false);
});
test("pending and proposing are not failures or successes",()=>{
 for(const [statusCode,status] of [[1,"Pending"],[2,"Proposing"],[3,"Committing"],[4,"Revealing"],[5,"Accepted"]] as const){
  const snap=normalizeSnapshot(HASH,{statusCode,status},null);
  assert.equal(snap.verified,false);
  assert.equal(snap.terminalFailure,false);
  assert.equal(snap.finalized,false);
 }
});
test("FINALIZED alone is not proof of execution success",()=>{
 const snap=normalizeSnapshot(HASH,{status:"Finalized",statusCode:7},null);
 assert.equal(snap.finalized,true);
 assert.equal(snap.verified,false);
 assert.equal(snap.terminalFailure,false);
 assert.match(snap.message,/Receipt outcome not confirmed/);
});
test("accepted GenVM success and finalized is verified",()=>{
 const s=normalizeSnapshot(HASH,{status:"Finalized",statusCode:7},{result:1,resultName:"MajorityAgree",txExecutionResult:1,txExecutionResultName:"FinishedWithReturn"});
 assert.equal(s.verified,true);assert.equal(s.terminalFailure,false);
 assert.match(s.message,/CONSENSUS ACCEPTED/);
});
test("FINALIZED with failed GenVM execution is a terminal non-success",()=>{
 const s=normalizeSnapshot(HASH,{status:"FINALIZED",statusCode:7},{result:1,resultName:"MajorityAgree",txExecutionResult:2,txExecutionResultName:"FinishedWithError"});
 assert.equal(s.verified,false);
 assert.equal(s.terminalFailure,true);
});
test("UNDETERMINED consensus is not reported as final verified success",()=>{
 const s=normalizeSnapshot(HASH,{status:"Undetermined",statusCode:6},{result:5,resultName:"NoMajority",txExecutionResult:1,txExecutionResultName:"FinishedWithReturn"});
 assert.equal(s.verified,false);
 assert.equal(s.terminalFailure,true);
});
test("missing status fields must not produce NaN or fabricated consensus",()=>{
 const s=normalizeSnapshot(HASH,{statusCode:"NaN"},null);
 assert.equal(s.statusCode,null);
 assert.equal(s.verified,false);
 assert.equal(s.terminalFailure,false);
});
