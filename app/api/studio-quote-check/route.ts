import {NextResponse} from "next/server";
import {createClient} from "genlayer-js-v2";
import {studionet} from "genlayer-js-v2/chains";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(){
 const contract="0xc38Ed838F7d35f7F1f9a5888de5900D47f940Af2";
 const address="0x4C7cb73aC8F8999af21cfc9fF4cF2333a9508Dcb";
 try{
  const client=createClient({chain:studionet,account:address as never});
  const quote=await client.estimateTransactionFeesForWrite({
   address:contract,functionName:"open_case",
   args:["lastcrate-readonly-fee-estimate","Vegetable crates",18,"16:40","17:30",address],
   value:BigInt(0)
  });
  return NextResponse.json({
   estimateAvailable:true,
   feeValue:quote.feeValue.toString(),
   distributionAvailable:!!quote.distribution,
   messageAllocationsAvailable:!!quote.messageAllocations,
   checkedAt:new Date().toISOString(),
   note:"A read-only fee quotation. No wallet signatures or contract writes were executed."
  },{headers:{"Cache-Control":"no-store"}});
 }catch(err){
  return NextResponse.json({estimateAvailable:false,error:err instanceof Error?err.message:String(err)},{status:502,headers:{"Cache-Control":"no-store"}});
 }
}
