"use client";
import {useEffect,useMemo,useState} from "react";
import {LATE_B,seedOffers,matchOffers,reconcile,type Offer} from "../lib/demo";
import {connectWallet,getInjectedProvider,getWalletSession,isStudionetChain,submitWrite,publicRead} from "../lib/genlayer";
import {proof,transactions,explorerTx,prettyReadback} from "../lib/evidence";
import {caseExistsFromReadback,newCaseId} from "../lib/rescue-case";
import {isTransactionHash,type ChainSnapshot} from "../lib/tx-status";
type PendingTransaction={hash:string;method:string;caseId:string};
const PENDING_KEY="lastcrate:pendingGenLayerTx";
type Tab="proof"|"dispatch"|"chain";
const matcher=process.env.NEXT_PUBLIC_RESCUE_MATCHER_ADDRESS||"";
const ledger=process.env.NEXT_PUBLIC_HANDOFF_LEDGER_ADDRESS||"";
const shortWallet=(address:string)=>address.slice(0,6)+"…"+address.slice(-4);
export default function Home(){
 const [tab,setTab]=useState<Tab>("chain");
 const [offers,setOffers]=useState<Offer[]>(()=>seedOffers.map(offer=>offer.id==="Kitchen B"?{...offer,note:LATE_B}:offer));
 const [total,setTotal]=useState(18);const [deadline,setDeadline]=useState("17:30");
 const [driverCount,setDriverCount]=useState(6);const [kitchenCount,setKitchenCount]=useState(6);
 const [caseId,setCaseId]=useState("lastcrate-241126-rescue-01");const [driverWallet,setDriverWallet]=useState("");
 const [busy,setBusy]=useState("");const [feedback,setFeedback]=useState("");const [output,setOutput]=useState("");
 const [walletAddress,setWalletAddress]=useState("");const [walletChainId,setWalletChainId]=useState("");
 const [walletError,setWalletError]=useState("");
 const [sessionTxs,setSessionTxs]=useState<{method:string;hash:string}[]>([]);
 const [pendingTx,setPendingTx]=useState<PendingTransaction|null>(null);
 const [txProgress,setTxProgress]=useState<ChainSnapshot|null>(null);
 const [txLastError,setTxLastError]=useState("");
 const [trackHash,setTrackHash]=useState("");
 const result=useMemo(()=>matchOffers(offers,total,deadline,"16:40",caseId),[offers,total,deadline,caseId]);
 const chosen=result.selected;const validReport=!!chosen&&driverCount>=0&&kitchenCount>=0&&driverCount<=result.allocated&&kitchenCount<=result.allocated;
 const handoff=validReport?reconcile(result.allocated,driverCount,kitchenCount):null;
 const addressesReady=!!matcher&&!!ledger;
 const existingCase=caseId===proof.caseId;
 const walletReady=!!walletAddress&&isStudionetChain(walletChainId);
 function signerReady():boolean{return walletReady;}
 useEffect(()=>{
  const provider=getInjectedProvider();
  if(!provider)return;
  let active=true;
  const refresh=()=>{
   getWalletSession().then(session=>{if(active){setWalletAddress(session?.account||"");setWalletChainId(session?.chainId||"");if(session?.account)setDriverWallet(old=>old||session.account);}})
    .catch(()=>{if(active){setWalletAddress("");setWalletChainId("");}});
  };
  const changed=(_value:unknown)=>refresh();
  const disconnected=(_value:unknown)=>{if(active){setWalletAddress("");setWalletChainId("");}};
  refresh();
  provider.on?.("accountsChanged",changed);
  provider.on?.("chainChanged",changed);
  provider.on?.("disconnect",disconnected);
  return()=>{active=false;provider.removeListener?.("accountsChanged",changed);provider.removeListener?.("chainChanged",changed);provider.removeListener?.("disconnect",disconnected);};
 },[]);
 useEffect(()=>{
  // Continue monitoring an already-submitted transaction after reloading or reopening this tab.
  try{
   const saved=window.localStorage.getItem(PENDING_KEY);
   if(!saved)return;
   const parsed:unknown=JSON.parse(saved);
   if(typeof parsed!=="object"||!parsed)return;
   const tx=parsed as Partial<PendingTransaction>;
   if(typeof tx.hash==="string"&&isTransactionHash(tx.hash)&&typeof tx.caseId==="string"&&typeof tx.method==="string"){
    setPendingTx({hash:tx.hash,caseId:tx.caseId,method:tx.method});
    setCaseId(tx.caseId);setTrackHash(tx.hash);
    setFeedback("Restored transaction "+tx.hash+". Checking on-chain status without re-signing.");
   }
  }catch{window.localStorage.removeItem(PENDING_KEY);}
 },[]);
 useEffect(()=>{
  if(!pendingTx)return;
  const transaction=pendingTx;
  let cancelled=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const hash=pendingTx.hash;
  async function poll(){
   try{
    const response=await fetch("/api/tx-status?hash="+encodeURIComponent(hash),{cache:"no-store"});
    const snapshot=await response.json() as ChainSnapshot&{error?:string;receiptUnsupported?:boolean};
    if(!response.ok)throw Error(snapshot.error||"Unable to fetch transaction status");
    if(cancelled)return;
    setTxProgress(snapshot);setTxLastError("");
    if(snapshot.verified||snapshot.terminalFailure||(snapshot.finalized&&snapshot.receiptUnsupported)){
     window.localStorage.removeItem(PENDING_KEY);
     setPendingTx(null);
     if(snapshot.verified){
      setFeedback("FINALIZED · CONSENSUS ACCEPTED · EXECUTION SUCCESS / "+transaction.method+" / "+hash);
     }else if(snapshot.finalized&&snapshot.receiptUnsupported){
      setFeedback("FINALIZED ON GENLAYER STUDIONET / "+hash+" · This node does not expose a detailed consensus/GenVM receipt. Check the case or allocation readback before continuing. Do not blindly retry.");
     }else{
      setFeedback("TRANSACTION FINISHED WITHOUT VERIFIED SUCCESS / "+hash+" / "+snapshot.status+" · Check Explorer and contract readback; do not blindly retry.");
     }
     return;
    }
   }catch(err){
    if(cancelled)return;
    setTxLastError(err instanceof Error?err.message:String(err));
   }
   if(!cancelled)timer=setTimeout(poll,7000);
  }
  void poll();
  return()=>{cancelled=true;if(timer)clearTimeout(timer);};
 },[pendingTx]);
 function followTransaction(tx:PendingTransaction){
  setTxProgress(null);setTxLastError("");setTrackHash(tx.hash);
  window.localStorage.setItem(PENDING_KEY,JSON.stringify(tx));
  setPendingTx(tx);
  setFeedback("TRANSACTION SUBMITTED / "+tx.hash+" · Monitoring GenLayer consensus and finalization; do not send another write while pending.");
 }
 function stopFollowing(){
  if(!pendingTx)return;
  window.localStorage.removeItem(PENDING_KEY);
  setPendingTx(null);
  setTxLastError("");
  setFeedback("Stopped monitoring "+pendingTx.hash+". Transaction outcome remains unverified; stopping tracking does not cancel the blockchain transaction. Check Explorer and the case record before any new write.");
 }
 function followEnteredHash(){
  const hash=trackHash.trim();
  if(!isTransactionHash(hash)){setTxLastError("Enter a full 0x + 64-character GenLayer transaction hash.");return;}
  if(pendingTx&&pendingTx.hash.toLowerCase()!==hash.toLowerCase()){
   setTxLastError("Another transaction is already being monitored. Resolve it before switching hashes.");return;
  }
  followTransaction({hash,caseId,method:"tracked transaction"});
 }
 async function connectWalletUI(){
  setBusy("wallet_connect");setWalletError("");
  try{const session=await connectWallet();setWalletAddress(session.account);setWalletChainId(session.chainId);setDriverWallet(old=>old||session.account);}
  catch(err){setWalletError(err instanceof Error?err.message:String(err));
   const session=await getWalletSession().catch(()=>null);setWalletAddress(session?.account||"");setWalletChainId(session?.chainId||"");
  }finally{setBusy("");}
 }
 const allocationId=caseId+":a1";
 function changeCaseId(value:string){
  if(pendingTx){setFeedback("Wait for the submitted transaction to be resolved before changing Case ID.");return;}
  setCaseId(value);setFeedback("");setOutput("");setSessionTxs([]);
 }
 function freshCaseId(){changeCaseId(newCaseId());}
 function update(id:string,key:keyof Offer,value:string|number){
  setOffers(curr=>curr.map(x=>x.id===id?{...x,[key]:value}:x));
 }
 async function write(to:"matcher"|"ledger",method:string,args:(string|number)[]){
  if(pendingTx){setFeedback("A transaction is still being monitored. Do not submit a duplicate.");return;}
  setBusy(method);setFeedback("");
  try{
   if(!signerReady())throw Error("Connect a wallet on GenLayer Studionet before signing.");
   if(method==="open_case"){
    const caseRecord=await publicRead(matcher,"get_case",[caseId]);
    if(caseExistsFromReadback(caseRecord))throw Error("This Case ID already exists on GenLayer. Check its status or choose New Case ID.");
   }
   // Return immediately with a hash. The background-in-page poller verifies the outcome.
   const hash=await submitWrite(to==="matcher"?matcher:ledger,method,args);
   setSessionTxs(old=>[...old,{method,hash}]);
   followTransaction({hash,method,caseId});
  }
  catch(e){setFeedback("TRANSACTION NOT SUBMITTED OR HASH NOT AVAILABLE / "+(e instanceof Error?e.message:String(e))+" · Check wallet and Explorer before trying again.");}
  finally{setBusy("");}
 }
 async function read(to:"matcher"|"ledger",method:string,args:(string|number)[]){
  setBusy(method);setFeedback("");setOutput("");
  try{setOutput(prettyReadback(await publicRead(to==="matcher"?matcher:ledger,method,args)));setFeedback("Public contract readback completed.");}
  catch(e){setFeedback("READ FAILED / "+(e instanceof Error?e.message:String(e)));}finally{setBusy("");}
 }
 return <main><header className="header"><div className="brand"><div className="mark">L<span>✳</span></div><div>LASTCRATE<small>FOOD RESCUE / GENLAYER</small></div></div><div className="headerActions"><div className="headerTags"><span>02 INTELLIGENT CONTRACTS</span><span>{addressesReady?"ADDRESSES CONFIGURED":"DEPLOYMENT UNVERIFIED"}</span></div><div className="walletTop"><button className={walletReady?"walletConnected":"walletConnect"} disabled={!!busy} onClick={connectWalletUI}>{busy==="wallet_connect"?"Connecting…":walletReady?shortWallet(walletAddress):walletAddress?"Switch to Studionet":"Connect Wallet"}</button>{walletAddress&&<small>{walletReady?"Studionet · Connected":"Wrong network"}</small>}</div></div></header>
 <section className="hero"><div><span className="eyebrow">THE LAST MILE SHOULDN&apos;T BE A GUESS.</span><h1>Rescue the food.<br/><em>Account for every crate.</em></h1><p>Interpret real kitchen intake limits, allocate before the cutoff, and reconcile what both sides actually report receiving.</p></div><div className="heroNumber"><span>CASE / 001</span><strong>18</strong><small>CRATES · LAST-MILE HANDOFF</small></div></section>
 <nav className="tabs" aria-label="Project sections"><button className={tab==="chain"?"active":""} onClick={()=>setTab("chain")}>01 / Live GenLayer</button><button className={tab==="dispatch"?"active":""} onClick={()=>setTab("dispatch")}>02 / Review scenario</button><button className={tab==="proof"?"active":""} onClick={()=>setTab("proof")}>03 / On-chain evidence</button></nav>

 {tab==="proof"&&<div className="workspace">
  <section className="proofHero"><div><span className="eyebrow">GENLAYER STUDIO · RECORDED 23 NOV 2026</span><h2>From intake limits to a signed handoff.</h2><p>One complete food rescue case, seven finalized transactions and public contract readbacks. No staged numbers presented as a live feed.</p></div><span className="proofChip">COMPLETE · DECLARED BY BOTH SIDES</span></section>
  <div className="proofStats"><div><strong>{proof.requested}</strong><span>Crates offered</span></div><div><strong>{proof.planned}</strong><span>Assigned to Kitchen A</span></div><div><strong>{proof.unallocated}</strong><span>Left unallocated</span></div><div><strong>{proof.received}</strong><span>Agreed handoff count</span></div></div>
  <div className="topGrid">
   <section className="panel proofStory"><span className="eyebrow">RESCUEMATCHER · BOUNDED DECISION</span><h2>Capacity beats proximity. A missed window never counts.</h2><p className="muted">Cutoff {proof.window.deadline} · Kitchen A arrives 17:05 · Kitchen B arrives 17:15 but cannot receive before 17:45.</p>
    <div className="proofKitchen"><div><b>Kitchen A <span className="proofYes">SELECTED</span></b><strong>6 crates</strong></div><q>After 17:00, one staff member can receive at most 6 crates.</q><small>Receiving from {proof.window.kitchenAFrom} · eligible · 2 km declared</small></div>
    <div className="proofKitchen"><div><b>Kitchen B <span className="proofNo">OUTSIDE RECEPTION WINDOW</span></b><strong>0 feasible</strong></div><q>We can receive up to 18 crates, but only from 17:45 onwards.</q><small>Receiving from {proof.window.kitchenBFrom}, after the deadline · 7 km declared</small></div>
    <div className="proofOutcome"><strong>12 crates remain explicitly unallocated.</strong><span>No allocation is fabricated to satisfy the full donation amount.</span></div>
   </section>
   <aside className="panel console"><span className="eyebrow">LIVE READ / GENLAYER STUDIONET</span><h2>Check the recorded case yourself.</h2><p className="muted">These read-only calls query the deployed contracts. They require network access but not a wallet signature.</p><label>Allocation ID</label><code>{proof.allocationId}</code><div className="actions"><button disabled={!addressesReady||!!busy} onClick={()=>read("matcher","get_allocation",[proof.allocationId])}>Read allocation</button><button className="secondary" disabled={!addressesReady||!!busy} onClick={()=>read("ledger","get_handoff",[proof.allocationId])}>Read handoff</button></div><div className="feedback" role="status">{busy?"Reading "+busy+"…":feedback||"Select a public read to fetch the latest stored contract result."}</div><pre aria-label="Public on-chain readback">{output||"Contract response appears here. Recorded receipts are shown below."}</pre><div className="actions"><button className="secondary" onClick={()=>{setCaseId(proof.caseId);setOutput("");setFeedback("");setTab("chain");}}>Open recorded case in live workspace</button></div></aside>
  </div>
  <section className="panel proofReceipts"><div className="proofHeading"><div><span className="eyebrow">HANDOFFLEDGER · MATCHED REPORTS</span><h2>Both parties declared six. The ledger reconciled six.</h2></div><span className="proofChip">STATUS / COMPLETE</span></div><div className="proofReconcile"><div><b>6</b><span>Planned</span></div><div><b>6</b><span>Driver report</span></div><div><b>6</b><span>Kitchen report</span></div><div><b>0</b><span>Missing</span></div></div><p className="muted">The ledger records wallet-signed claims and their agreement. It is not independent proof that food was physically delivered.</p>
   <h3>Transaction trail <small>FINALIZED · CONSENSUS ACCEPTED · GENVM SUCCESS</small></h3><div className="txGrid">{transactions.map((tx,i)=><a key={tx.hash} className="txItem" href={explorerTx(tx.hash)} target="_blank" rel="noopener noreferrer"><span className="txNumber">{String(i+1).padStart(2,"0")}</span><span><b>{tx.label}</b><small>{tx.role} · {tx.method}</small><code>{tx.hash.slice(0,11)}…{tx.hash.slice(-8)}</code></span><span aria-hidden="true">↗</span></a>)}</div>
   <p className="proofFootnote">Studio evidence and contract readbacks were captured on {proof.captured}. <a href="https://github.com/bearbaba/LASTCRATE/issues/1" target="_blank" rel="noopener noreferrer">Review the full verification log ↗</a></p>
  </section>
 </div>}
 {tab==="dispatch"&&<div className="workspace"><div className="notice"><strong>LOCAL SCENARIO PREVIEW</strong> These bounded rules demonstrate expected behavior; they are not a validated GenLayer consensus execution or physical delivery proof.</div>
 <div className="topGrid"><section className="panel editor"><div className="panelTop"><span className="eyebrow">RESCUE CASE</span><h2>Donation window</h2></div><div className="fields"><div><label>Case ID</label><input value={caseId} onChange={e=>changeCaseId(e.target.value)}/></div><div><label>Available crates</label><input type="number" min={1} max={10000} value={total} onChange={e=>setTotal(Math.max(1,Number(e.target.value)||1))}/></div><div><label>Pickup</label><input value="16:40" disabled/></div><div><label>Hard deadline</label><input type="time" value={deadline} onChange={e=>setDeadline(e.target.value)}/></div></div>
 <h3>Kitchen intake offers</h3>{offers.map((o,i)=><div className="offerInput" key={o.id}><div className="offerHeading"><b>{o.id}</b><span>{i===0?"NEAR / RESTRICTED":"FAR / HIGH CAPACITY"}</span></div><label>Natural-language intake note</label><textarea rows={2} value={o.note} onChange={e=>update(o.id,"note",e.target.value)}/><div className="fields"><div><label>ETA</label><input type="time" value={o.arrival} onChange={e=>update(o.id,"arrival",e.target.value)}/></div><div><label>Advertised capacity</label><input type="number" min={0} value={o.nominal} onChange={e=>update(o.id,"nominal",Number(e.target.value))}/></div></div></div>)}
 <div className="actions"><button onClick={()=>update("Kitchen B","note",LATE_B)}>Move B to 17:45</button><button className="secondary" onClick={()=>{setOffers(seedOffers.map(o=>({...o})));setTotal(18);setDeadline("17:30");}}>Restore case</button></div></section>
 <section className="panel verdict"><span className="eyebrow">MATCH RESULT · RESCUEMATCHER</span><div className="winner"><span>SELECTED RECEIVER</span><h2>{chosen?.id||"No eligible kitchen"}</h2><p>{chosen?"Best feasible capacity before deadline, not simply the nearest location.":"No intake offer can be verified within this window."}</p></div><div className="numbers"><div><strong>{result.allocated}</strong><span>Allocated crates</span></div><div className={result.unallocated?"warning":""}><strong>{result.unallocated}</strong><span>Unallocated crates</span></div></div><span className="eyebrow">EVIDENCE PER KITCHEN</span>{result.evaluations.map(x=><div className="evaluation" key={x.id}><div><b>{x.id}</b><span>{x.feasible} / {total} feasible</span></div><p>{x.eligible?"Arrival respects interpreted intake window.":"Ineligible at arrival, outside deadline, or lacks explicit receiving capacity."}</p><q>{x.evidence}</q></div>)}<small className="muted">Tie-breaker: earlier arrival, shorter km, then kitchen ID. Unallocated food stays visible.</small></section></div>
 <section className="handoff"><div className="handoffHeading"><div><span className="eyebrow">HANDOFFLEDGER / POST-DELIVERY</span><h2>What actually changed hands?</h2></div><span className="caseRef">{allocationId}</span></div><div className="handoffGrid"><div><label>Driver declared crates</label><input type="number" min={0} max={result.allocated} value={driverCount} onChange={e=>setDriverCount(Number(e.target.value))}/></div><div><label>Kitchen declared crates</label><input type="number" min={0} max={result.allocated} value={kitchenCount} onChange={e=>setKitchenCount(Number(e.target.value))}/></div><div className="handoffResult">{!chosen?<><strong>NO HANDOFF</strong><span>No kitchen allocated</span></>:!handoff?<><strong>INVALID QUANTITY</strong><span>Confirmations must not exceed {result.allocated} allocated crates</span></>:<><span className={"handoffStatus "+handoff.status}>{handoff.status}</span><strong>{handoff.received===null?"Two different reports":handoff.received+" delivered · "+handoff.missing+" missing"}</strong><span>{handoff.status==="DISPUTED"?"Driver "+driverCount+" vs kitchen "+kitchenCount+" — no agreed received count":handoff.status==="PARTIAL"?"Both sides agree on a shortfall": "Both sides confirm the planned quantity"}</span></>}</div></div><div className="actions"><button className="secondary" onClick={()=>{setDriverCount(16);setKitchenCount(16)}}>Partial 16 / 16</button><button className="secondary" onClick={()=>{setDriverCount(18);setKitchenCount(16)}}>Dispute 18 / 16</button><button className="secondary" onClick={()=>{setDriverCount(result.allocated);setKitchenCount(result.allocated)}}>Confirm allocated / allocated</button></div></section></div>}

 {tab==="chain"&&<div className="workspace">
  <section className="liveIntro"><div><span className="eyebrow">LIVE / GENLAYER STUDIONET</span><h2>Allocate a rescue. Reconcile the handoff.</h2><p>Prepare the donation, collect individually signed kitchen offers, then match and reconcile on-chain. Every write requires its authorized wallet.</p></div><div className="liveIntroCounts"><div><b>{total}</b><span>Available</span></div><div><b>{result.allocated}</b><span>Locally feasible</span></div><div><b>{result.unallocated}</b><span>Not allocated</span></div></div></section>
  <section className="walletPanel" aria-label="Wallet connection"><div><span className="eyebrow">WALLET / GENLAYER STUDIONET</span><h2>{walletReady?"Wallet connected":"Connect your wallet to sign"}</h2><p>{walletReady?walletAddress+" · Studionet 61999":walletAddress?"Another network selected. Switch to GenLayer Studionet.":"Click Connect Wallet, approve the request, and select GenLayer Studionet. Read-only operations require no wallet."}</p>{walletError&&<p role="alert" className="walletError">{walletError}</p>}</div><button disabled={!!busy} onClick={connectWalletUI}>{walletReady?"Refresh / Switch Wallet":walletAddress?"Switch to Studionet":"Connect Wallet"}</button></section>
  <div className="liveLayout"><div className="liveMain">
   <section className="panel"><div className="liveStepTitle"><span className="stepNumber">01</span><div><span className="eyebrow">DONOR WALLET · RESCUEMATCHER</span><h2>Open a donation case</h2></div></div><p className="muted">The Case ID is unique on-chain. The first connected account is offered as the driver wallet; edit it if the driver is different.</p>
    <div className="caseIdRow"><div><label>Case ID</label><input value={caseId} maxLength={64} disabled={!!pendingTx} onChange={e=>changeCaseId(e.target.value)} aria-label="Rescue Case ID"/></div><button className="secondary" disabled={!!pendingTx} onClick={freshCaseId}>New Case ID</button></div>
    <div className="fields"><div><label>Available crates</label><input type="number" min={1} max={10000} value={total} onChange={e=>setTotal(Math.max(1,Number(e.target.value)||1))}/></div><div><label>Deadline</label><input type="time" value={deadline} onChange={e=>setDeadline(e.target.value)}/></div><div><label>Pickup</label><input value="16:40" disabled/></div><div><label>Driver wallet</label><input value={driverWallet} onChange={e=>setDriverWallet(e.target.value)} placeholder="0x…" aria-label="Driver wallet address"/></div></div>
    <div className="actions"><button disabled={!addressesReady||!!busy||!caseId||!driverWallet||existingCase||!walletReady||!!pendingTx} onClick={()=>write("matcher","open_case",[caseId,"Vegetable crates",total,"16:40",deadline,driverWallet])}>1 · Donor opens case</button><button className="secondary" disabled={!addressesReady||!!busy||!caseId} onClick={()=>read("matcher","get_case",[caseId])}>Check case on-chain</button></div>
   </section>
   <section className="panel"><div className="liveStepTitle"><span className="stepNumber">02</span><div><span className="eyebrow">KITCHENS · INDEPENDENT WALLET SIGNATURES</span><h2>Submit receiving offers</h2></div></div><p className="muted">Use a distinct kitchen wallet for each offer. Each kitchen's capacity, delivery ETA and written intake conditions are supplied as signed claims.</p>
   {offers.map((o,i)=><div key={o.id} className="liveOffer"><div className="offerHeading"><b>{o.id}</b><span>{i===0?"CAPACITY RESTRICTED":"RECEIVING WINDOW RESTRICTED"}</span></div><label>Natural-language intake note</label><textarea rows={2} value={o.note} onChange={e=>update(o.id,"note",e.target.value)}/><div className="liveOfferFields"><div><label>Arrival ETA</label><input type="time" value={o.arrival} onChange={e=>update(o.id,"arrival",e.target.value)}/></div><div><label>Advertised capacity</label><input type="number" min={0} max={10000} value={o.nominal} onChange={e=>update(o.id,"nominal",Number(e.target.value))}/></div><div><label>Distance (km)</label><input type="number" min={0} value={o.distanceKm} onChange={e=>update(o.id,"distanceKm",Number(e.target.value))}/></div></div><div className="actions"><button disabled={!addressesReady||!!busy||existingCase||!walletReady||!!pendingTx} onClick={()=>write("matcher","submit_offer",[caseId,o.id,o.note,o.nominal,o.arrival,o.distanceKm])}>2{String.fromCharCode(65+i)} · Submit {o.id} offer</button><small className="muted">Switch wallet to {o.id} before signing</small></div></div>)}
   </section>
   <section className="panel"><div className="liveStepTitle"><span className="stepNumber">03</span><div><span className="eyebrow">DONOR WALLET · CONSENSUS MATCHING</span><h2>Seal and allocate</h2></div></div><p className="muted">After both offers have been accepted, return to the donor wallet. Sealing closes offer intake; matching creates an immutable allocation.</p><div className="actions"><button disabled={!addressesReady||!!busy||existingCase||!walletReady||!!pendingTx} onClick={()=>write("matcher","seal_case",[caseId])}>3 · Donor seals offers</button><button disabled={!addressesReady||!!busy||existingCase||!walletReady||!!pendingTx} onClick={()=>write("matcher","match_case",[caseId])}>4 · Match by consensus</button><button className="secondary" disabled={!addressesReady||!!busy} onClick={()=>read("matcher","get_allocation",[allocationId])}>Read allocation</button></div><small className="muted">Allocation ID: <code>{allocationId}</code></small></section>
   <section className="panel"><div className="liveStepTitle"><span className="stepNumber">04</span><div><span className="eyebrow">HANDOFFLEDGER · INDEPENDENT RECEIPTS</span><h2>Confirm the handoff</h2></div></div><p className="muted">The driver and allocated kitchen each report their own quantity with their own account. The ledger compares signed declarations; it does not independently verify physical delivery.</p><div className="fields"><div><label>Driver's declared crates</label><input type="number" min={0} max={total} value={driverCount} onChange={e=>setDriverCount(Number(e.target.value))}/></div><div><label>Kitchen's declared crates</label><input type="number" min={0} max={total} value={kitchenCount} onChange={e=>setKitchenCount(Number(e.target.value))}/></div></div><div className="actions"><button disabled={!addressesReady||!!busy||existingCase||!walletReady||!!pendingTx} onClick={()=>write("ledger","confirm_dispatch",[allocationId,driverCount])}>5 · Driver confirms</button><button disabled={!addressesReady||!!busy||existingCase||!walletReady||!!pendingTx} onClick={()=>write("ledger","confirm_receipt",[allocationId,kitchenCount])}>6 · Kitchen confirms</button><button className="secondary" disabled={!addressesReady||!!busy} onClick={()=>read("ledger","get_handoff",[allocationId])}>Read handoff</button></div></section>
  </div>
  <aside className="panel console liveConsole"><span className="eyebrow">CONTRACT READBACK / LIVE</span><h2>Verification console</h2><p className="muted">Local estimates below are not GenLayer consensus. Use the read buttons to inspect recorded contract values.</p><div className="localPreview"><div><span>Expected receiver</span><strong>{chosen?.id||"None"}</strong></div><div><span>Locally feasible</span><strong>{result.allocated} / {total}</strong></div><div><span>Unallocated</span><strong>{result.unallocated}</strong></div></div><section className="txTracking" aria-label="GenLayer transaction tracking">
  <span className="eyebrow">TRANSACTION LIFECYCLE</span>
  <h3>{pendingTx?"Monitoring submitted transaction":txProgress?"Last checked transaction":"Track a GenLayer transaction"}</h3>
  {pendingTx&&<div className="txTrackingState" role="status"><strong>{txProgress?.status||"Submitted · Checking network"}</strong><span>{txProgress?.message||"The wallet submitted a transaction. Waiting for the network status."}</span><code>{pendingTx.hash}</code><a target="_blank" rel="noopener noreferrer" href={explorerTx(pendingTx.hash)}>Open transaction in Explorer ↗</a></div>}
  {!pendingTx&&txProgress&&<div className="txTrackingState" role="status"><strong>{txProgress.verified?"Verified success":txProgress.terminalFailure?"No verified success":txProgress.status}</strong><span>{txProgress.message}</span><a target="_blank" rel="noopener noreferrer" href={explorerTx(txProgress.hash)}>Open transaction in Explorer ↗</a></div>}
  {txLastError&&<p className="walletError" role="alert">{txLastError} · The transaction outcome remains unverified.</p>}
  <label>Existing transaction hash</label><input aria-label="GenLayer transaction hash" value={trackHash} onChange={e=>setTrackHash(e.target.value)} placeholder="0x + 64 hexadecimal characters" spellCheck={false}/>
  <div className="actions"><button className="secondary" disabled={!!pendingTx||!!busy} onClick={followEnteredHash}>Follow transaction</button>{pendingTx&&<button className="secondary" disabled={!!busy} onClick={stopFollowing}>Stop monitoring (does not cancel transaction)</button>}</div>
  <p className="muted">Checks the on-chain status automatically while this page is open, and resumes after a reload. A timeout is not a failed transaction. Never re-sign solely because status is pending or unavailable.</p>
 </section>
 <label>RescueMatcher</label><code>{matcher||"Not configured"}</code><label>HandoffLedger</label><code>{ledger||"Not configured"}</code><div className="feedback" role="status">{busy?"In progress: "+busy:feedback||"Connect a wallet to start, or use a read-only contract query."}</div><pre aria-label="Contract readback">{output||"Public contract readback appears here."}</pre>{sessionTxs.length>0&&<div className="sessionTx"><span className="eyebrow">SUBMITTED WRITES · THIS SESSION</span>{sessionTxs.map((entry,i)=><a key={entry.hash+i} target="_blank" rel="noopener noreferrer" href={explorerTx(entry.hash)}>{i+1}. {entry.method} · {shortWallet(entry.hash)} ↗</a>)}</div>}</aside>
  </div>
 </div>}
 <footer><span>LASTCRATE / GENLAYER / 2026</span><span>LOCAL PREVIEW ≠ ON-CHAIN VERIFICATION · NO PHYSICAL PROOF CLAIM</span></footer></main>;
}
