/** Bounded local reviewer scenario; NOT a GenLayer AI consensus result. */
export const SEED_A="After 17:00, one staff member can receive at most 6 crates.";
export const SEED_B="We can receive up to 18 crates until 17:30.";
export const LATE_B="We can only receive deliveries from 17:45 onwards.";
export type Offer={id:string;note:string;nominal:number;arrival:string;distanceKm:number};
export type Evaluation=Offer&{capacity:number;from:string;until:string;eligible:boolean;feasible:number;evidence:string};
export type Allocation={caseId:string;total:number;allocated:number;unallocated:number;selected:Evaluation|null;evaluations:Evaluation[];deadline:string};
export type HandoffStatus="PENDING"|"COMPLETE"|"PARTIAL"|"DISPUTED";
export type Handoff={status:HandoffStatus;planned:number;driver:number|null;kitchen:number|null;received:number|null;missing:number|null};
const clock=(s:string):number=>{
 const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
 return match?Number(match[1])*60+Number(match[2]):Number.POSITIVE_INFINITY;
};
const extractTime=(note:string,tag:"from"|"until")=>{
 const regex=tag==="from"?/\b(?:from|after|starting at)\s+(\d{1,2}:\d{2})/i:/\b(?:until|by|before)\s+(\d{1,2}:\d{2})/i;
 const m=note.match(regex);if(!m)return tag==="from"?"00:00":"23:59";
 return m[1].padStart(5,"0");
};
export function evaluateOffer(offer:Offer,total=18,pickup="16:40",deadline="17:30"):Evaluation{
 const from=extractTime(offer.note,"from");const until=extractTime(offer.note,"until");
 // Only numeric receiving capacity explicitly evidenced in the note counts.
 const capacityMatch=offer.note.match(/(?:at most|up to|max(?:imum)?|receive)\s+(\d+)\s+crates/i);
 const capacity=Math.min(offer.nominal,total,capacityMatch?Number(capacityMatch[1]):0);
 const eligible=clock(offer.arrival)>=clock(pickup)&&clock(offer.arrival)<=clock(deadline)&&clock(offer.arrival)>=clock(from)&&clock(offer.arrival)<=clock(until);
 return {...offer,capacity,from,until,eligible,feasible:eligible?capacity:0,evidence:offer.note};
}
export function matchOffers(offers:Offer[],total=18,deadline="17:30",pickup="16:40",caseId="rescue-01"):Allocation{
 const evaluations=offers.map(x=>evaluateOffer(x,total,pickup,deadline));
 const eligible=evaluations.filter(x=>x.feasible>0).sort((a,b)=>b.feasible-a.feasible||clock(a.arrival)-clock(b.arrival)||a.distanceKm-b.distanceKm||a.id.localeCompare(b.id));
 const selected=eligible[0]||null;const allocated=selected?.feasible||0;
 return{caseId,total,allocated,unallocated:total-allocated,selected,evaluations,deadline};
}
export function reconcile(planned:number,driver:number|null,kitchen:number|null):Handoff{
 if(driver!==null&&(driver<0||driver>planned)||kitchen!==null&&(kitchen<0||kitchen>planned))throw Error("Confirmed quantity must be between zero and allocated quantity.");
 if(driver===null||kitchen===null)return{status:"PENDING",planned,driver,kitchen,received:null,missing:null};
 if(driver!==kitchen)return{status:"DISPUTED",planned,driver,kitchen,received:null,missing:null};
 return{status:driver===planned?"COMPLETE":"PARTIAL",planned,driver,kitchen,received:driver,missing:planned-driver};
}
export const seedOffers:Offer[]=[
 {id:"Kitchen A",note:SEED_A,nominal:18,arrival:"17:05",distanceKm:2},
 {id:"Kitchen B",note:SEED_B,nominal:18,arrival:"17:15",distanceKm:7}
];
