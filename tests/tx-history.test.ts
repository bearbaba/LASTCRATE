import test from "node:test";
import assert from "node:assert/strict";
import {parseTxHistory,mergeTxHistory,changeTxStatus,newestPendingTx} from "../lib/tx-history.ts";
const first="0x"+"a".repeat(64),second="0x"+"b".repeat(64);
const tx=(hash:string,when:string)=>({hash,method:"open_case",caseId:"lastcrate-test",submittedAt:when,
 status:"Submitted",outcome:"pending" as const,message:"Awaiting network"});
test("read only valid public transaction records from browser storage",()=>{
 const raw=JSON.stringify([tx(first,"2026-11-24T06:00:00Z"),{hash:"bad"}]);
 assert.equal(parseTxHistory(raw).length,1);
 assert.equal(parseTxHistory(null).length,0);
 assert.equal(parseTxHistory("{broken").length,0);
});
test("upsert by hash, latest first, without duplicates",()=>{
 const one=tx(first,"2026-11-24T06:00:00Z"),two=tx(second,"2026-11-24T07:00:00Z");
 const merged=mergeTxHistory([one],[two,{...one,status:"Finalized"}]);
 assert.deepEqual(merged.map(x=>x.hash),[second,first]);
 assert.equal(merged[1].status,"Finalized");
});
test("receipt polling updates a saved hash and preserves historical transactions",()=>{
 const previous=[tx(second,"2026-11-24T07:00:00Z"),tx(first,"2026-11-24T06:00:00Z")];
 const next=changeTxStatus(previous,second,{status:"FINALIZED",outcome:"unverified",
  message:"Receipt unavailable",checkedAt:"2026-11-24T07:01:00Z"});
 assert.equal(next[0].outcome,"unverified");
 assert.equal(next[1].outcome,"pending");
 assert.equal(newestPendingTx(next)?.hash,first);
});
test("history is bounded without dropping recent entries",()=>{
 const arr=Array.from({length:75},(_,i)=>tx("0x"+i.toString(16).padStart(64,"0"),
  new Date(Date.UTC(2026,10,24,0,i)).toISOString()));
 assert.equal(mergeTxHistory([],arr).length,60);
 assert.equal(mergeTxHistory([],arr)[0].hash,arr[74].hash);
});
