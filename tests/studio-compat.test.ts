import test from "node:test";
import assert from "node:assert/strict";
import {assertStudioCompatible,confirmedFeeOptions,formatFeeInTestGen} from "../lib/studio-compat";

test("v0.6 upgraded Studionet selects fee-aware SDK only on verified chain",()=>{
 assert.equal(assertStudioCompatible({chainId:"0xf22f",studioLine:"v0.6"}),"v0.6");
 assert.equal(assertStudioCompatible({chainId:"0xf22f",studioLine:"legacy"}),"legacy");
 assert.throws(()=>assertStudioCompatible({chainId:"0xf22f",studioLine:"unknown"}),/unknown/);
 assert.throws(()=>assertStudioCompatible({chainId:"0xf22e",studioLine:"v0.6"}),/61999/);
 assert.throws(()=>assertStudioCompatible({studioLine:"v0.6"}),/61999/);
});

test("v0.6 transaction fee estimate must be complete, non-negative and passed through",()=>{
 const dist={leader:3};
 const extras={extra:2};
 const fees=confirmedFeeOptions({
  feeValue:BigInt("377414400010352"),distribution:dist,messageAllocations:extras
 });
 assert.deepEqual(fees,{distribution:dist,feeValue:BigInt("377414400010352"),messageAllocations:extras});
 assert.throws(()=>confirmedFeeOptions({distribution:dist}),/fee estimate unavailable/);
 assert.throws(()=>confirmedFeeOptions({feeValue:BigInt(-1),distribution:dist}),/fee estimate unavailable/);
 assert.throws(()=>confirmedFeeOptions({feeValue:BigInt(0)}),/fee estimate unavailable/);
 assert.equal(confirmedFeeOptions({feeValue:BigInt(0),distribution:dist}).feeValue,BigInt(0));
});
test("quoted test-GEN deposit formats without floating point precision loss",()=>{
 assert.equal(formatFeeInTestGen(BigInt("377414400010352")),"0.000377414");
 assert.equal(formatFeeInTestGen(BigInt("1000000000000000000")),"1");
 assert.throws(()=>formatFeeInTestGen(BigInt(-1)),/negative/);
});
