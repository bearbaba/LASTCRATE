import test from "node:test";
import assert from "node:assert/strict";
import {getInjectedProvider,isExpectedSigner,isStudionetChain,STUDIONET_CHAIN_ID} from "../lib/genlayer.ts";

test("Studionet network gate uses chain ID 61999",()=>{
 assert.equal(STUDIONET_CHAIN_ID,"0xf22f");
 assert.equal(isStudionetChain("0xf22f"),true);
 assert.equal(isStudionetChain("0xF22F"),true);
 assert.equal(isStudionetChain("0x1"),false);
 assert.equal(isStudionetChain(""),false);
});
test("wallet role signer check is case-insensitive and restrictive",()=>{
 const donor="0x4C7cb73aC8F8999af21cfc9fF4cF2333a9508Dcb";
 const kitchen="0xD6b8A3A5eB329410D9504784812b8569afA8C2aF";
 assert.equal(isExpectedSigner(donor,donor.toLowerCase()),true);
 assert.equal(isExpectedSigner(donor,kitchen),false);
 assert.equal(isExpectedSigner(kitchen,donor),false);
 assert.equal(isExpectedSigner(kitchen),true); // non-video cases: contract still enforces role
});
test("server-side rendering does not assume injected browser wallet",()=>{
 assert.equal(getInjectedProvider(),null);
});
