import test from "node:test";
import assert from "node:assert/strict";
import {caseExistsFromReadback,newCaseId} from "../lib/rescue-case.ts";

test("create a bounded fresh case ID from date and entropy",()=>{
 const id=newCaseId(new Date("2026-11-24T04:14:00Z"),0.5);
 assert.equal(id,"lastcrate-261124-800000");
 assert.ok(id.length<=64);
 assert.ok(!id.includes(":"));
});
test("an empty GenLayer get_case readback means ID remains available",()=>{
 for(const raw of ["", "  ", '""', "null", JSON.stringify("")])
   assert.equal(caseExistsFromReadback(raw),false);
});
test("never reuse a case ID with a nonempty or unrecognized on-chain record",()=>{
 const row=JSON.stringify({case_id:"already-used",offers:[]});
 assert.equal(caseExistsFromReadback(row),true);
 assert.equal(caseExistsFromReadback(JSON.stringify(row)),true);
 assert.equal(caseExistsFromReadback("UNKNOWN RESPONSE"),true);
});
