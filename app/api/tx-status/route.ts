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
export async function GET(request:NextRequest){
 const hash=request.nextUrl.searchParams.get("hash")||"";
 if(!isTransactionHash(hash)){
  return NextResponse.json({error:"Valid 0x + 64-hex transaction hash required."},{status:400,headers:noCache});
 }
 let rawStatus:unknown=null,rawReceipt:unknown=null;
 let statusError="",receiptError="";
 try{rawStatus=await rpc("gen_getTransactionStatus",hash);}
 catch(error){statusError=error instanceof Error?error.message:String(error);}
 const status=rawStatus as {statusCode?:unknown;status?:unknown}|null;
 const code=Number(status?.statusCode);
 const checkReceipt=!!statusError||code===5||code===6||code===7||code===8||
  ["accepted","undetermined","finalized","canceled"].includes(String(status?.status||"").toLowerCase());
 if(checkReceipt){
  // Newer GenLayer nodes expose getTransactionData; older ones may only serve Receipt.
  try{rawReceipt=await rpc("gen_getTransactionData",hash);}
  catch(error){receiptError=error instanceof Error?error.message:String(error);}
  if(rawReceipt===null){
   try{rawReceipt=await rpc("gen_getTransactionReceipt",hash);}
   catch(error){receiptError=error instanceof Error?error.message:String(error);}
  }
 }
 if(rawStatus===null&&rawReceipt===null){
  if(/transaction\\s+0x[0-9a-f]+\\s+not found/i.test(statusError)){
   const missing=normalizeSnapshot(hash,{status:"Uninitialized",statusCode:0},null);
   return NextResponse.json({...missing,
    message:"Transaction not found on GenLayer Studionet yet. Check the hash and wallet network; do not re-sign without verifying the case.",
    network:"GenLayer Studionet",checkedAt:new Date().toISOString()},{headers:noCache});
  }
  return NextResponse.json({error:"GenLayer RPC currently cannot read the transaction status."},{status:502,headers:noCache});
 }
 const normalized=normalizeSnapshot(hash,rawStatus,rawReceipt);
 return NextResponse.json({...normalized,receiptAvailable:rawReceipt!==null,
  receiptCheckPending:rawReceipt===null&&!!receiptError,
  network:"GenLayer Studionet",checkedAt:new Date().toISOString()},{headers:noCache});
}
