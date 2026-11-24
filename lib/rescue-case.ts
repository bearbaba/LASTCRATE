/** Small, browser-safe helpers for unique public rescue cases. */
export function newCaseId(date:Date=new Date(),entropy:number=Math.random()):string{
 const datePart=[String(date.getUTCFullYear()).slice(2),String(date.getUTCMonth()+1).padStart(2,"0"),String(date.getUTCDate()).padStart(2,"0")].join("");
 const nonce=Math.floor(Math.max(0,Math.min(entropy,0.999999999))*16777216).toString(16).padStart(6,"0");
 return "lastcrate-"+datePart+"-"+nonce;
}
/** The GenLayer view returns either an empty string or a serialized case record. */
export function caseExistsFromReadback(raw:string):boolean{
 const value=raw.trim();
 if(!value||value==='""'||value==="null")return false;
 try{
  const parsed:unknown=JSON.parse(value);
  if(typeof parsed==="string")return parsed.trim()!=="";
  if(parsed===null)return false;
  if(typeof parsed==="object")return Object.keys(parsed).length>0;
  return true;
 }catch{
  // Unknown output is not evidence that a case ID is available.
  return true;
 }
}
