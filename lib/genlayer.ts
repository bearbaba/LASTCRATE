/** Stable GenLayerJS v1.1.8 testnet wallet interface. */
import {createClient} from "genlayer-js";
import {ExecutionResult,TransactionStatus} from "genlayer-js/types";
import {studionet} from "genlayer-js/chains";
import {createClient as createV06Client} from "genlayer-js-v2";
import {studionet as studionetV06} from "genlayer-js-v2/chains";
export type Provider={
 request:(args:{method:string;params?:unknown[]})=>Promise<unknown>;
 on?:(event:string,handler:(value:unknown)=>void)=>void;
 removeListener?:(event:string,handler:(value:unknown)=>void)=>void;
};
export type WalletSession={account:string;chainId:string};
export const STUDIONET_CHAIN_ID="0xf22f"; // 61999, GenLayer hosted Studionet
export type StudioLine="v0.6"|"legacy";
/** Probe the server against the exact Studio RPC before each write. Fail closed on unknown node versions. */
export async function checkStudioCompatibility():Promise<StudioLine>{
 const response=await fetch("/api/studio-compat",{cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error("Cannot verify the active GenLayer Studio network; signing is disabled.");
 const data=await response.json() as {studioLine?:string;chainId?:string};
 if(data.chainId!==STUDIONET_CHAIN_ID)throw Error("GenLayer Studio RPC chain ID differs from 61999; signing blocked.");
 if(data.studioLine==="v0.6"||data.studioLine==="legacy")return data.studioLine;
 throw Error("Unable to determine Studio consensus version. No wallet transaction was sent.");
}

export function getInjectedProvider():Provider|null{
 if(typeof window==="undefined")return null;
 return (window as Window&{ethereum?:Provider}).ethereum||null;
}
function firstAccount(value:unknown):string{
 if(!Array.isArray(value)||typeof value[0]!=="string")return "";
 return /^0x[0-9a-fA-F]{40}$/.test(value[0])?value[0]:"";
}
export function isExpectedSigner(account:string,expected?:string):boolean{
 return !expected||account.toLowerCase()===expected.toLowerCase();
}
export function isStudionetChain(chainId:string):boolean{
 return chainId.toLowerCase()===STUDIONET_CHAIN_ID;
}
export async function getWalletSession():Promise<WalletSession|null>{
 const provider=getInjectedProvider();
 if(!provider)return null;
 const account=firstAccount(await provider.request({method:"eth_accounts"}));
 if(!account)return null;
 const chainId=await provider.request({method:"eth_chainId"});
 return {account,chainId:String(chainId)};
}
export async function connectWallet():Promise<WalletSession>{
 const provider=getInjectedProvider();
 if(!provider)throw Error("No browser wallet detected. Install/unlock a compatible wallet, then reload the page.");
 const account=firstAccount(await provider.request({method:"eth_requestAccounts"}));
 if(!account)throw Error("Wallet connection was not approved.");
 const line=await checkStudioCompatibility();
 const client=line==="v0.6"?
  createV06Client({chain:studionetV06,account:account as never,provider}):
  createClient({chain:studionet,account:account as never,provider});
 await client.connect("studionet");
 const session=await getWalletSession();
 if(!session)throw Error("Wallet disconnected during network selection.");
 if(!isStudionetChain(session.chainId))throw Error("Please switch wallet to GenLayer Studionet (chain 61999).");
 return session;
}
type CommittedReceipt={result?:number|string;resultName?:string;txExecutionResultName?:string;statusName?:string};
/** A FINALIZED transaction can still have Undetermined consensus. Fail closed. */
export function assertAcceptedExecution(tx:CommittedReceipt):void{
 const consensusName=String(tx.resultName||"").replace(/[^a-z]/gi,"").toLowerCase();
 const agreed=tx.result===1||consensusName==="majorityagree";
 if(!agreed)throw Error("Consensus was not Accepted: "+(tx.resultName||tx.result||"unknown"));
 const execution=String(tx.txExecutionResultName||"").replace(/[^a-z]/gi,"").toLowerCase();
 if(execution!=="finishedwithreturn"&&tx.txExecutionResultName!==ExecutionResult.FINISHED_WITH_RETURN)
  throw Error("GenVM execution was not successful: "+(tx.txExecutionResultName||"unknown"));
}
function address(value:string){if(!/^0x[0-9a-fA-F]{40}$/.test(value))throw Error("Deployed 0x contract address required.");return value;}
export async function submitWrite(target:string,method:string,args:(string|number)[],expectedSigner?:string){
 if(typeof window==="undefined")throw Error("Browser wallet required.");
 const provider=getInjectedProvider();
 if(!provider)throw Error("Connect an EIP-1193 browser wallet first.");
 const session=await getWalletSession();
 if(!session)throw Error("Connect Wallet before submitting a transaction.");
 if(!isExpectedSigner(session.account,expectedSigner))throw Error("Wrong wallet: switch to "+expectedSigner+" before signing "+method+".");
 if(!isStudionetChain(session.chainId))throw Error("Switch wallet to GenLayer Studionet (chain 61999) before signing.");
 const line=await checkStudioCompatibility();
 const sender=address(session.account);
 const chain=line==="v0.6"?studionetV06:studionet;
 const client=line==="v0.6"
  ?createV06Client({chain:studionetV06,account:sender as never,provider})
  :createClient({chain:studionet,account:sender as never,provider});
 await client.connect("studionet");
 const current=await getWalletSession();
 if(!current||!isExpectedSigner(current.account,expectedSigner)||current.account.toLowerCase()!==session.account.toLowerCase())
  throw Error("Wallet account changed before signing. Reconnect and review the signer.");
 if(!isStudionetChain(current.chainId))throw Error("GenLayer Studionet is not selected.");
 const call={address:address(target) as `0x${string}`,functionName:method,args,value:0n};
 if(line==="v0.6"){
  // A v0.6 Studio may charge protocol fees. Estimate for this exact call
  // instead of sending a legacy fee-less transaction that always reverts.
  const quote=await client.estimateTransactionFeesForWrite(call);
  if(!quote||quote.feeValue===undefined||!quote.distribution)
   throw Error("GenLayer v0.6 fee estimate unavailable. Signing stopped before MetaMask.");
  const hash=await client.writeContract({
   ...call,fees:{
    distribution:quote.distribution,
    feeValue:quote.feeValue,
    ...(quote.messageAllocations?{messageAllocations:quote.messageAllocations}:{})
   }
  });
  return hash;
 }
 const hash=await client.writeContract(call);
 return hash;
}
/** Backwards-compatible blocking helper; live UI uses submitWrite + status polling. */
export async function signWrite(target:string,method:string,args:(string|number)[],expectedSigner?:string){
 const hash=await submitWrite(target,method,args,expectedSigner);
 const reader=createClient({chain:studionet});
 const tx=await reader.waitForTransactionReceipt({hash,status:TransactionStatus.FINALIZED});
 try{assertAcceptedExecution(tx as CommittedReceipt);}
 catch(error){throw Error("Submitted transaction "+hash+" not verified: "+(error instanceof Error?error.message:String(error)));}
 return hash;
}
export async function publicRead(target:string,method:string,args:(string|number)[]){
 const client=createClient({chain:studionet});
 const out=await client.readContract({address:address(target) as never,functionName:method,args});
 return typeof out==="string"?out:JSON.stringify(out);
}
