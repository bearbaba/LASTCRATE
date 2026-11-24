import {isTransactionHash} from "./tx-status";

/** Public transaction metadata stored only in this browser, never private wallet material. */
export const TX_HISTORY_KEY="lastcrate:transactionHistory:v1";
export const LEGACY_PENDING_KEY="lastcrate:pendingGenLayerTx";
export type TxOutcome="pending"|"verified"|"unverified"|"failed";
export type SavedTx={
 hash:string;
 method:string;
 caseId:string;
 submittedAt:string;
 status:string;
 outcome:TxOutcome;
 message:string;
 checkedAt?:string;
};
const outcomes=new Set<TxOutcome>(["pending","verified","unverified","failed"]);
export function parseTxHistory(raw:string|null):SavedTx[]{
 if(!raw)return [];
 try{
  const data:unknown=JSON.parse(raw);
  if(!Array.isArray(data))return [];
  const safe:SavedTx[]=[];
  for(const value of data){
   if(!value||typeof value!=="object")continue;
   const tx=value as Partial<SavedTx>;
   if(typeof tx.hash!=="string"||!isTransactionHash(tx.hash)||typeof tx.method!=="string"||
      typeof tx.caseId!=="string"||typeof tx.submittedAt!=="string"||
      typeof tx.status!=="string"||typeof tx.message!=="string"||
      !outcomes.has(tx.outcome as TxOutcome))continue;
   safe.push({hash:tx.hash,method:tx.method.slice(0,100),caseId:tx.caseId.slice(0,64),
    submittedAt:tx.submittedAt,status:tx.status.slice(0,70),outcome:tx.outcome as TxOutcome,
    message:tx.message.slice(0,500),
    ...(typeof tx.checkedAt==="string"?{checkedAt:tx.checkedAt}:{})});
  }
  return mergeTxHistory([],safe);
 }catch{return [];}
}
export function mergeTxHistory(previous:SavedTx[],additions:SavedTx[]):SavedTx[]{
 const byHash=new Map<string,SavedTx>();
 for(const tx of [...previous,...additions]){
  if(isTransactionHash(tx.hash))byHash.set(tx.hash.toLowerCase(),tx);
 }
 // Most recent submissions first, always bounded to limit local storage growth.
 return Array.from(byHash.values()).sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt)).slice(0,60);
}
export function changeTxStatus(previous:SavedTx[],hash:string,values:Pick<SavedTx,"status"|"message"|"outcome"|"checkedAt">):SavedTx[]{
 return previous.map(tx=>tx.hash.toLowerCase()===hash.toLowerCase()?{...tx,...values}:tx);
}
export function newestPendingTx(previous:SavedTx[]):SavedTx|undefined{
 return previous.find(tx=>tx.outcome==="pending");
}
