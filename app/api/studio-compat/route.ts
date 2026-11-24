import {NextResponse} from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const RPC=process.env.GENLAYER_STUDIONET_RPC_URL||"https://studio.genlayer.com/api";
const matcher=process.env.NEXT_PUBLIC_RESCUE_MATCHER_ADDRESS||"";
const noStore={"Cache-Control":"no-store, max-age=0"};
async function call(method:string,params:unknown[]=[]){
 try{
  const response=await fetch(RPC,{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!response.ok)return {ok:false,error:"HTTP "+response.status,code:null,result:null};
  const data=await response.json() as {result?:unknown;error?:{message?:string;code?:number}};
  if(data.error)return {ok:false,error:data.error.message||"RPC rejected",code:data.error.code??null,result:null};
  return {ok:true,result:data.result??null,error:null,code:null};
 }catch(err){return {ok:false,error:err instanceof Error?err.message:"RPC unreachable",code:null,result:null};}
}
export async function GET(){
 const [chain,fees,oldConsensus,newConsensus,contract]=await Promise.all([
  call("eth_chainId"),
  call("sim_getFeeConfig"),
  call("eth_getCode",["0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575","latest"]),
  call("eth_getCode",["0x88B0F18613Db92Bf970FfE264E02496e20a74D16","latest"]),
  /^0x[0-9a-fA-F]{40}$/.test(matcher)?call("gen_getContractCode",[matcher]):Promise.resolve({ok:false,error:"unconfigured",code:null,result:null})
 ]);
 const studioLine=fees.ok&&fees.result!==null?"v0.6":fees.code===-32601?"legacy":"unknown";
 return NextResponse.json({
  chainId:chain.ok?chain.result:null,
  studioLine,
  detectedFeePolicy:fees.ok&&fees.result!==null,
  oldConsensusCodePresent:oldConsensus.ok&&typeof oldConsensus.result==="string"&&oldConsensus.result!=="0x",
  newConsensusCodePresent:newConsensus.ok&&typeof newConsensus.result==="string"&&newConsensus.result!=="0x",
  matcherReadable:contract.ok&&typeof contract.result==="string"&&contract.result.length>0,
  diagnostics:{
   feeError:fees.error,feeErrorCode:fees.code,
   oldConsensus:oldConsensus.error,newConsensus:newConsensus.error,matcher:contract.error
  },
  checkedAt:new Date().toISOString()
 },{headers:noStore});
}
