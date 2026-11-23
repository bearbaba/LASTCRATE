/** Stable GenLayerJS v1.1.8 testnet wallet interface. */
import {createClient} from "genlayer-js";
import {ExecutionResult,TransactionStatus} from "genlayer-js/types";
import {studionet} from "genlayer-js/chains";
type Provider={request:(args:{method:string;params?:unknown[]})=>Promise<unknown>};
function address(value:string){if(!/^0x[0-9a-fA-F]{40}$/.test(value))throw Error("Deployed 0x contract address required.");return value;}
export async function signWrite(target:string,method:string,args:(string|number)[]){
 if(typeof window==="undefined")throw Error("Browser wallet required.");
 const provider=(window as Window&{ethereum?:Provider}).ethereum;
 if(!provider)throw Error("Connect an EIP-1193 wallet.");
 const accounts=await provider.request({method:"eth_requestAccounts"}) as string[];
 if(!accounts?.[0])throw Error("Wallet account missing.");
 const client=createClient({chain:studionet,account:address(accounts[0]) as never,provider});
 await client.connect("studionet");
 const hash=await client.writeContract({address:address(target) as never,functionName:method,args,value:BigInt(0)});
 const tx=await client.waitForTransactionReceipt({hash,status:TransactionStatus.FINALIZED});
 if(tx.txExecutionResultName!==ExecutionResult.FINISHED_WITH_RETURN)throw Error("Finalized with execution error: "+tx.txExecutionResultName);
 return hash;
}
export async function publicRead(target:string,method:string,args:(string|number)[]){
 const client=createClient({chain:studionet});
 const out=await client.readContract({address:address(target) as never,functionName:method,args});
 return typeof out==="string"?out:JSON.stringify(out);
}
