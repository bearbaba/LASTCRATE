import {NextRequest,NextResponse} from "next/server";
import {publicRead} from "../../../lib/genlayer";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noCache={"Cache-Control":"no-store, max-age=0"};
const matcher=process.env.NEXT_PUBLIC_RESCUE_MATCHER_ADDRESS||"";
export async function GET(request:NextRequest){
 const id=request.nextUrl.searchParams.get("id")||"";
 if(!/^[A-Za-z0-9_-]{1,64}$/.test(id))
  return NextResponse.json({error:"Valid case ID required."},{status:400,headers:noCache});
 if(!/^0x[a-fA-F0-9]{40}$/.test(matcher))
  return NextResponse.json({error:"Matcher contract is not configured."},{status:503,headers:noCache});
 try{
  let row:unknown=await publicRead(matcher,"get_case",[id]);
  for(let i=0;i<3&&typeof row==="string";i++){
   if(!row.trim()){row=null;break;}
   try{row=JSON.parse(row);}catch{row=null;break;}
  }
  const rec=row&&typeof row==="object"&&!Array.isArray(row)?row as Record<string,unknown>:null;
  const found=rec?.case_id===id;
  return NextResponse.json({caseId:id,exists:found,
   sealed:found&&rec?.sealed===true,
   matched:found&&rec?.matched===true,
   offers:found&&Array.isArray(rec?.offers)?rec.offers.length:0,
   donor:found&&typeof rec?.donor==="string"?rec.donor:null,
   driver:found&&typeof rec?.driver==="string"?rec.driver:null,
   checkedAt:new Date().toISOString(),
   note:"This is public matcher contract storage, not a receipt for any specific transaction."},{headers:noCache});
 }catch{
  return NextResponse.json({error:"Unable to read matcher contract on Studionet."},{status:502,headers:noCache});
 }
}
