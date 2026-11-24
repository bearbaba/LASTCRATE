/** Normalize GenLayer Node JSON-RPC status and receipt fields without guessing outcomes. */
export const isTransactionHash=(hash:string):boolean=>/^0x[0-9a-fA-F]{64}$/.test(hash);
export type ChainSnapshot={
 hash:string;
 statusCode:number|null;
 status:string;
 consensus:string|null;
 execution:string|null;
 finalized:boolean;
 verified:boolean;
 terminalFailure:boolean;
 message:string;
};
const object=(value:unknown):Record<string,unknown>|null=>
 typeof value==="object"&&value!==null&&!Array.isArray(value)?value as Record<string,unknown>:null;
const code=(value:unknown):number|null=>{
 if(typeof value==="number"&&Number.isFinite(value))return value;
 if(typeof value==="string"&&/^\d+$/.test(value))return Number(value);
 return null;
};
const label=(value:unknown):string=>typeof value==="string"?value.trim():"";
const flat=(value:string)=>value.replace(/[^a-z]/gi,"").toLowerCase();
export function normalizeSnapshot(hash:string,rawStatus:unknown,rawReceipt:unknown):ChainSnapshot{
 const status=object(rawStatus),receipt=object(rawReceipt);
 const statusCode=code(status?.statusCode)??code(receipt?.status);
 const statusName=label(status?.status)||label(receipt?.statusName)||(
  statusCode===7?"Finalized":statusCode===5?"Accepted":statusCode===8?"Canceled":statusCode===6?"Undetermined":"Unknown"
 );
 const consensusCode=code(receipt?.result),executionCode=code(receipt?.txExecutionResult);
 const consensus=label(receipt?.resultName)||(
  consensusCode===1?"MajorityAgree":consensusCode===null?"":String(consensusCode));
 const execution=label(receipt?.txExecutionResultName)||(
  executionCode===1?"FinishedWithReturn":executionCode===null?"":String(executionCode));
 const finalized=statusCode===7||flat(statusName)==="finalized";
 const accepted=consensusCode===1||flat(consensus)==="majorityagree";
 const executed=executionCode===1||flat(execution)==="finishedwithreturn";
 const verified=finalized&&accepted&&executed;
 const canceled=statusCode===8||flat(statusName)==="canceled";
 const undetermined=statusCode===6||flat(statusName)==="undetermined";
 const receiptEvaluable=receipt!==null&&(consensusCode!==null||!!consensus)&&(executionCode!==null||!!execution);
 const terminalFailure=canceled||undetermined||(finalized&&receiptEvaluable&&!verified);
 const message=verified?"FINALIZED · CONSENSUS ACCEPTED · EXECUTION SUCCESS":
  terminalFailure?"Transaction reached a terminal non-success status. Do not treat it as a completed write.":
  finalized?"FINALIZED · Receipt outcome not confirmed; checking again.":
  statusCode===null?"Network status unavailable; transaction outcome is not yet verified.":
  statusCode===0?"Not yet found on the network; checking again.":
  "Transaction is "+statusName+"; checking until finalization.";
 return {hash,statusCode,status:statusName,consensus:consensus||null,execution:execution||null,finalized,verified,terminalFailure,message};
}
