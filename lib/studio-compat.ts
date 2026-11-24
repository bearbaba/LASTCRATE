/** Fail-closed compatibility checks shared by browser signing and regression tests. */
export type StudioLine="v0.6"|"legacy";
export const STUDIONET_HEX_CHAIN_ID="0xf22f";
export function assertStudioCompatible(report:{chainId?:unknown;studioLine?:unknown}):StudioLine{
 if(report.chainId!==STUDIONET_HEX_CHAIN_ID){
  throw Error("GenLayer Studio RPC chain ID differs from 61999; signing blocked.");
 }
 if(report.studioLine==="v0.6"||report.studioLine==="legacy"){
  return report.studioLine;
 }
 throw Error("Studio consensus version is unknown. No wallet transaction was sent.");
}
export function confirmedFeeOptions<TDistribution,TAllocations>(quote:{
 feeValue?:bigint;distribution?:TDistribution;messageAllocations?:TAllocations
}){
 if(typeof quote.feeValue!=="bigint"||quote.feeValue<BigInt(0)||!quote.distribution){
  throw Error("GenLayer v0.6 fee estimate unavailable. Signing stopped before MetaMask.");
 }
 return {
  distribution:quote.distribution,
  feeValue:quote.feeValue,
  ...(quote.messageAllocations?{messageAllocations:quote.messageAllocations}:{})
 };
}
export function formatFeeInTestGen(wei:bigint):string{
 if(wei<BigInt(0))throw Error("Invalid negative fee estimate");
 const base=BigInt("1000000000000000000");
 const units=wei/base;
 const remainder=(wei%base).toString().padStart(18,"0").slice(0,9).replace(/0+$/,"");
 return units.toString()+(remainder?"."+remainder:"");
}
