/** Stable GenLayerJS v1.1.8 testnet wallet interface. */
import {createClient} from "genlayer-js";
import {ExecutionResult,TransactionStatus} from "genlayer-js/types";
import {studionet} from "genlayer-js/chains";
export type Provider={
 request:(args:{method:string;params?:unknown[]})=>Promise<unknown>;
 on?:(event:string,handler:(value:unknown)=>void)=>void;
 removeListener?:(event:string,handler:(value:unknown)=>void)=>void;
};
export type WalletSession={account:string;chainId:string};
export const STUDIONET_CHAIN_ID="0xf22f"; // 61999, GenLayer hosted Studionet
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
 const client=createClient({chain:studionet,account:account as never,provider});
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
 const client=createClient({chain:studionet,account:address(session.account) as never,provider});
 await client.connect("studionet");
 const current=await getWalletSession();
 if(!current||!isExpectedSigner(current.account,expectedSigner)||current.account.toLowerCase()!==session.account.toLowerCase())
  throw Error("Wallet account changed before signing. Reconnect and review the signer.");
 if(!isStudionetChain(current.chainId))throw Error("GenLayer Studionet is not selected.");
 const hash=await client.writeContract({address:address(target) as never,functionName:method,args,value:BigInt(0)});
 // The transaction ID is durable: return immediately so callers can poll and survive timeouts.
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
