import {NextRequest,NextResponse} from "next/server";
import {isTransactionHash,normalizeSnapshot} from "../../../lib/tx-status";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const RPC=process.env.GENLAYER_STUDIONET_RPC_URL||"https://studio.genlayer.com/api";
const noCache={"Cache-Control":"no-store, max-age=0"};

async function rpc(method:string,hash:string):Promise<unknown>{
 const res=await fetch(RPC,{
  method:"POST",
  headers:{"content-type":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:1,method,params:[{txId:hash}]}),
  cache:"no-store",
  signal:AbortSignal.timeout(9000)
 });
 if(!res.ok)throw Error("GenLayer RPC returned HTTP "+res.status);
 const json=await res.json() as {result?:unknown;error?:{code?:number;message?:string}};
 if(json.error)throw Error("GenLayer RPC: "+(json.error.message||json.error.code||"unknown error"));
 return json.result??null;
}
/** Read-only correlation probe: find whether a wallet hash belongs to the EVM envelope instead of GenLayer consensus. */
async function probeRpc(method:string,params:unknown[]):Promise<{result?:unknown;error?:string}>{
 try{
  const response=await fetch(RPC,{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),cache:"no-store",signal:AbortSignal.timeout(7000)});
  if(!response.ok)return {error:"HTTP "+response.status};
  const result=await response.json() as {result?:unknown;error?:{message?:string}};
  return result.error?{error:result.error.message||"RPC error"}:{result:result.result??null};
 }catch(err){return {error:err instanceof Error?err.message:"RPC request failed"};}
}
export async function GET(request:NextRequest){
 const hash=request.nextUrl.searchParams.get("hash")||"";
 if(!isTransactionHash(hash)){
  return NextResponse.json({error:"Valid 0x + 64-hex transaction hash required."},{status:400,headers:noCache});
 }
 if(request.nextUrl.searchParams.get("probe")==="1"){
  // This never submits, signs, or resends a transaction.
  const [chainId,evmTx,evmReceipt,genStatus]=await Promise.all([
   probeRpc("eth_chainId",[]),
   probeRpc("eth_getTransactionByHash",[hash]),
   probeRpc("eth_getTransactionReceipt",[hash]),
   probeRpc("gen_getTransactionStatus",[{txId:hash}])
  ]);
  const tx=evmTx.result&&typeof evmTx.result==="object"?evmTx.result as Record<string,unknown>:null;
  const receipt=evmReceipt.result&&typeof evmReceipt.result==="object"?evmReceipt.result as Record<string,unknown>:null;
  const simulation=tx&&typeof tx.to==="string"&&typeof tx.input==="string"?
   await probeRpc("eth_call",[{from:tx.from,to:tx.to,data:tx.input,value:tx.value},"latest"]):
   {error:"No EVM transaction calldata to inspect"};
  return NextResponse.json({
   hash,studionetChainId:"0xf22f",rpcChainId:typeof chainId.result==="string"?chainId.result:null,
   evm:{found:!!tx,receiptFound:!!receipt,receiptStatus:receipt?.status??null,
    recipient:typeof tx?.to==="string"?tx.to:null,
    sender:typeof tx?.from==="string"?tx.from:null,
    inputSelector:typeof tx?.input==="string"?tx.input.slice(0,10):null,
    inputBytes:typeof tx?.input==="string"?Math.max(0,(tx.input.length-2)/2):null,
    gas:tx?.gas??null,gasPrice:tx?.gasPrice??null,gasUsed:receipt?.gasUsed??null,
    value:tx?.value??null,nonce:tx?.nonce??null,blockNumber:tx?.blockNumber??null},
   callReplay:{available:!simulation.error,error:simulation.error??null,successResult:simulation.result??null},
   genlayer:{status:genStatus.result??null},
   diagnosticErrors:{
    chainId:chainId.error??null,evmTx:evmTx.error??null,evmReceipt:evmReceipt.error??null,gen:genStatus.error??null
   },
   checkedAt:new Date().toISOString(),
   note:"Read-only check. EVM hash and GenLayer protocol transaction ID may differ; neither implies successful contract execution."
  },{headers:noCache});
 }

 let rawStatus:unknown=null,rawReceipt:unknown=null;
 let statusError="",receiptError="",dataError="";
 try{rawStatus=await rpc("gen_getTransactionStatus",hash);}
 catch(error){statusError=error instanceof Error?error.message:String(error);}
 // Some Studio nodes respond with "Transaction <hash> not found" before indexing.
 // This is not a transient server outage and must never be reported as a failed write.
 if(rawStatus===null&&/not found|does not exist|unknown transaction/i.test(statusError)){
  const missing=normalizeSnapshot(hash,{status:"Uninitialized",statusCode:0},null);
  return NextResponse.json({...missing,
   message:"Transaction not found on GenLayer Studionet yet. Confirm the wallet network and check the case record; do not blindly re-sign.",
   network:"GenLayer Studionet",checkedAt:new Date().toISOString()},{headers:noCache});
 }
 const status=rawStatus as {statusCode?:unknown;status?:unknown}|null;
 const code=Number(status?.statusCode);
 const checkReceipt=!!statusError||code===5||code===6||code===7||code===8||
  ["accepted","undetermined","finalized","canceled"].includes(String(status?.status||"").toLowerCase());
 if(checkReceipt){
  // Newer GenLayer nodes expose getTransactionData; older ones may only serve Receipt.
  try{rawReceipt=await rpc("gen_getTransactionData",hash);}
  catch(error){dataError=error instanceof Error?error.message:String(error);}
  if(rawReceipt===null){
   try{rawReceipt=await rpc("gen_getTransactionReceipt",hash);}
   catch(error){receiptError=error instanceof Error?error.message:String(error);}
  }
 }
 if(rawStatus===null&&rawReceipt===null){
  return NextResponse.json({error:"GenLayer RPC currently cannot read the transaction status."},{status:502,headers:noCache});
 }
 const normalized=normalizeSnapshot(hash,rawStatus,rawReceipt);
 const receiptUnsupported=/method not found/i.test(dataError)&&/method not found/i.test(receiptError);
 const message=normalized.finalized&&receiptUnsupported?
  "FINALIZED on Studionet. This RPC does not expose the detailed receipt. Verify the contract readback and Explorer before proceeding.":
  normalized.message;
 return NextResponse.json({...normalized,message,
  receiptAvailable:rawReceipt!==null,receiptUnsupported,
  network:"GenLayer Studionet",checkedAt:new Date().toISOString()},{headers:noCache});
}
