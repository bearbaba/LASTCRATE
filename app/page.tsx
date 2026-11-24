"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {LATE_B,seedOffers,matchOffers,reconcile,type Offer} from "../lib/demo";
import {connectWallet,getInjectedProvider,getWalletSession,isStudionetChain,submitWrite,publicRead} from "../lib/genlayer";
import {proof,transactions,explorerTx,prettyReadback} from "../lib/evidence";
import {caseExistsFromReadback,newCaseId} from "../lib/rescue-case";
import {isTransactionHash,type ChainSnapshot} from "../lib/tx-status";
import {TX_HISTORY_KEY,LEGACY_PENDING_KEY,parseTxHistory,mergeTxHistory,changeTxStatus,newestPendingTx,type SavedTx,type TxOutcome} from "../lib/tx-history";
type PendingTransaction={hash:string;method:string;caseId:string};
type Stage="donation"|"kitchens"|"allocation"|"handoff";
const stages: {id:Stage;label:string}[]=[{id:"donation",label:"Donor opens"},{id:"kitchens",label:"Kitchen offers"},{id:"allocation",label:"Consensus match"},{id:"handoff",label:"Signed handoff"}];
const matcher=process.env.NEXT_PUBLIC_RESCUE_MATCHER_ADDRESS||"";
const ledger=process.env.NEXT_PUBLIC_HANDOFF_LEDGER_ADDRESS||"";
const shortWallet=(address:string)=>address.slice(0,6)+"…"+address.slice(-4);
export default function Home(){
 const [stage,setStage]=useState<Stage>("donation");
 const [showAllHistory,setShowAllHistory]=useState(false);
 const [offers,setOffers]=useState<Offer[]>(()=>seedOffers.map(offer=>offer.id==="Kitchen B"?{...offer,note:LATE_B}:offer));
 const [total,setTotal]=useState(18);const [deadline,setDeadline]=useState("17:30");
 const [driverCount,setDriverCount]=useState(6);const [kitchenCount,setKitchenCount]=useState(6);
 const [caseId,setCaseId]=useState("lastcrate-241126-rescue-01");const [driverWallet,setDriverWallet]=useState("");
 const [busy,setBusy]=useState("");const [feedback,setFeedback]=useState("");const [output,setOutput]=useState("");
 const [walletAddress,setWalletAddress]=useState("");const [walletChainId,setWalletChainId]=useState("");
 const [walletError,setWalletError]=useState("");
 const [txHistory,setTxHistory]=useState<SavedTx[]>([]);
 const historyRef=useRef<SavedTx[]>([]);
 const [pendingTx,setPendingTx]=useState<PendingTransaction|null>(null);
 const [txLastError,setTxLastError]=useState("");
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
 function persistHistory(next:SavedTx[]){
  historyRef.current=next;setTxHistory(next);
  try{window.localStorage.setItem(TX_HISTORY_KEY,JSON.stringify(next));}
  catch{setTxLastError("Browser storage unavailable. Keep this page open until the transaction is confirmed.");}
 }
 useEffect(()=>{
  // Restore all signed transactions, including a pending hash saved by the earlier release.
  try{
   let saved=parseTxHistory(window.localStorage.getItem(TX_HISTORY_KEY));
   const legacy=window.localStorage.getItem(LEGACY_PENDING_KEY);
   if(legacy){
    try{
     const old=JSON.parse(legacy) as Partial<PendingTransaction>;
     if(typeof old.hash==="string"&&isTransactionHash(old.hash)&&typeof old.caseId==="string"&&typeof old.method==="string"&&
        !saved.some(tx=>tx.hash.toLowerCase()===old.hash!.toLowerCase())){
      saved=mergeTxHistory(saved,[{hash:old.hash,method:old.method,caseId:old.caseId,
       submittedAt:new Date().toISOString(),status:"Submitted",outcome:"pending",
       message:"Restored from an earlier LASTCRATE session."}]);
     }
    }catch{}
    window.localStorage.removeItem(LEGACY_PENDING_KEY);
   }
   historyRef.current=saved;setTxHistory(saved);
   window.localStorage.setItem(TX_HISTORY_KEY,JSON.stringify(saved));
   const unfinished=newestPendingTx(saved);
   if(unfinished){
    setCaseId(unfinished.caseId);
    setPendingTx({hash:unfinished.hash,method:unfinished.method,caseId:unfinished.caseId});
    setFeedback("Resumed automatic monitoring of the previously submitted "+unfinished.method+" transaction.");
   }
  }catch{setTxLastError("Browser storage unavailable; previous transaction history could not be restored.");}
 },[]);
 useEffect(()=>{
  if(!pendingTx)return;
  const transaction=pendingTx;
  let cancelled=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  async function poll(){
   try{
    const response=await fetch("/api/tx-status?hash="+encodeURIComponent(transaction.hash),{cache:"no-store"});
    const snapshot=await response.json() as ChainSnapshot&{error?:string;receiptUnsupported?:boolean};
    if(!response.ok)throw Error(snapshot.error||"Unable to fetch transaction status");
    if(cancelled)return;
    setTxLastError("");
    const settled=snapshot.verified||snapshot.terminalFailure||(snapshot.finalized&&snapshot.receiptUnsupported);
    const outcome:TxOutcome=snapshot.verified?"verified":snapshot.terminalFailure?"failed":
      snapshot.finalized&&snapshot.receiptUnsupported?"unverified":"pending";
    persistHistory(changeTxStatus(historyRef.current,transaction.hash,{
     status:snapshot.status,outcome,message:snapshot.message,checkedAt:new Date().toISOString()
    }));
    if(settled){
     setPendingTx(null);
     if(snapshot.verified)setFeedback("FINALIZED · CONSENSUS ACCEPTED · EXECUTION SUCCESS / "+transaction.method+" / "+transaction.hash);
     else if(snapshot.finalized&&snapshot.receiptUnsupported)
      setFeedback("FINALIZED ON GENLAYER STUDIONET / "+transaction.hash+" · Detailed receipt unavailable. Check contract readback before another action.");
     else setFeedback("TRANSACTION FINISHED WITHOUT VERIFIED SUCCESS / "+transaction.hash+" / "+snapshot.status+" · Check Explorer before retrying.");
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
  persistHistory(mergeTxHistory(historyRef.current,[{
   ...tx,submittedAt:new Date().toISOString(),status:"Submitted",outcome:"pending",
   message:"Wallet approved. Checking GenLayer automatically."
  }]));
  setTxLastError("");setPendingTx(tx);
  setFeedback("TRANSACTION SUBMITTED / "+tx.hash+" · Hash saved automatically. Tracking the network.");
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
  setCaseId(value);setFeedback("");setOutput("");
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
   if(!isTransactionHash(hash))throw Error("Wallet submission returned an invalid transaction hash.");
   followTransaction({hash,method,caseId});
  }
  catch(e){
   const message=e instanceof Error?e.message:String(e);
   const extractedHash=message.match(/0x[0-9a-fA-F]{64}/)?.[0];
   if(extractedHash){
    followTransaction({hash:extractedHash,method,caseId});
    setFeedback("Transaction ID recovered from the wallet response and saved automatically. Checking on-chain before any retry.");
   }else setFeedback("Wallet or network did not return a usable transaction hash / "+message+" · Check wallet activity before retrying.");
  }
  finally{setBusy("");}
 }
 async function read(to:"matcher"|"ledger",method:string,args:(string|number)[]){
  setBusy(method);setFeedback("");setOutput("");
  try{setOutput(prettyReadback(await publicRead(to==="matcher"?matcher:ledger,method,args)));setFeedback("Public contract readback completed.");}
  catch(e){setFeedback("READ FAILED / "+(e instanceof Error?e.message:String(e)));}finally{setBusy("");}
 }

 return <main className="lcApp">
  <header className="lcHeader">
   <div className="lcBrand"><span className="lcMark">L✳</span><div><strong>LASTCRATE</strong><small>FOOD RESCUE · GENLAYER</small></div></div>
   <div className="lcHeaderRight"><span className="lcNetwork">● Studionet · {addressesReady?"2 contracts configured":"Setup required"}</span><button disabled={!!busy} className={walletReady?"lcWalletButton connected":"lcWalletButton"} onClick={connectWalletUI}>{busy==="wallet_connect"?"Connecting…":walletReady?shortWallet(walletAddress):walletAddress?"Switch to Studionet":"Connect Wallet"}</button></div>
  </header>
  <section className="lcIntro"><div><span className="eyebrow">LIVE RESCUE WORKSPACE</span><h1>Rescue the food. Account for every crate.</h1></div><div className="lcStats"><div><b>{total}</b><span>Offered</span></div><div><b>{result.allocated}</b><span>Locally feasible</span></div><div><b>{result.unallocated}</b><span>Unallocated</span></div></div></section>
  <nav className="lcStages" aria-label="Rescue workflow steps">{stages.map((step,i)=><button key={step.id} aria-current={stage===step.id?"step":undefined} className={stage===step.id?"active":""} onClick={()=>setStage(step.id)}><b>{i+1}</b><span>{step.label}</span></button>)}</nav>
  <div className="lcLayout">
   <section className="lcWorkPanel" aria-label="Current rescue action">
    {stage==="donation"&&<>
     <div className="lcStepHeading"><div><span className="eyebrow">01 · DONOR WALLET</span><h2>Open a donation case</h2></div><span>RescueMatcher</span></div>
     <p className="lcHelper">Create a unique case. The donor signs once; LASTCRATE automatically stores and follows the transaction.</p>
     {existingCase&&<p className="lcAlert">This historical case is already complete. Choose a new Case ID instead of replaying it.</p>}
     <div className="lcCaseRow"><label>Case ID<input aria-label="Rescue Case ID" value={caseId} maxLength={64} disabled={!!pendingTx} onChange={e=>changeCaseId(e.target.value)}/></label><button className="secondary" disabled={!!pendingTx} onClick={freshCaseId}>New ID</button></div>
     <div className="lcFields"><label>Crates<input type="number" min={1} max={10000} value={total} onChange={e=>setTotal(Math.max(1,Number(e.target.value)||1))}/></label><label>Pickup<input disabled value="16:40"/></label><label>Deadline<input type="time" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label><label>Driver wallet<input value={driverWallet} onChange={e=>setDriverWallet(e.target.value)} placeholder="0x…" aria-label="Driver wallet address"/></label></div>
     <div className="lcActions"><button disabled={!addressesReady||!!busy||!caseId||!driverWallet||existingCase||!walletReady||!!pendingTx} onClick={()=>write("matcher","open_case",[caseId,"Vegetable crates",total,"16:40",deadline,driverWallet])}>1 · Donor opens case</button><button className="secondary" disabled={!addressesReady||!!busy||!caseId} onClick={()=>read("matcher","get_case",[caseId])}>Read case</button><button className="lcNext" onClick={()=>setStage("kitchens")}>Kitchens →</button></div>
    </>}
    {stage==="kitchens"&&<>
     <div className="lcStepHeading"><div><span className="eyebrow">02 · RECEIVER WALLETS</span><h2>Kitchen receiving offers</h2></div><span>RescueMatcher</span></div>
     <p className="lcHelper">Each kitchen signs with its own account. The capacity and receiving-window notes are already filled and editable.</p>
     <div className="lcKitchenCards">{offers.map((o,i)=><div className="lcKitchenCard" key={o.id}><div className="lcKitchenTop"><b>{o.id}</b><small>{i===0?"6-crate restriction":"Starts 17:45"}</small></div><label>Intake terms<textarea rows={2} value={o.note} onChange={e=>update(o.id,"note",e.target.value)}/></label><div className="lcKitchenInputs"><label>ETA<input type="time" value={o.arrival} onChange={e=>update(o.id,"arrival",e.target.value)}/></label><label>Capacity<input type="number" min={0} value={o.nominal} onChange={e=>update(o.id,"nominal",Number(e.target.value))}/></label><label>Km<input type="number" min={0} value={o.distanceKm} onChange={e=>update(o.id,"distanceKm",Number(e.target.value))}/></label></div><button disabled={!addressesReady||!!busy||existingCase||!walletReady||!!pendingTx} onClick={()=>write("matcher","submit_offer",[caseId,o.id,o.note,o.nominal,o.arrival,o.distanceKm])}>2{String.fromCharCode(65+i)} · Sign {o.id} offer</button></div>)}</div>
     <p className="lcHelper">Local estimate only: {chosen?.id||"none"} · {result.allocated} feasible / {result.unallocated} unallocated. Confirm the actual result through consensus.</p>
     <div className="lcActions"><button className="secondary" onClick={()=>setStage("donation")}>← Donor</button><button className="lcNext" onClick={()=>setStage("allocation")}>Matching →</button></div>
    </>}
    {stage==="allocation"&&<>
     <div className="lcStepHeading"><div><span className="eyebrow">03 · DONOR WALLET</span><h2>Seal and match by consensus</h2></div><span>RescueMatcher</span></div>
     <p className="lcHelper">Switch back to the donor wallet after both offers have been confirmed. Seal intake before requesting matching.</p>
     <div className="lcSummaryRecord"><span>Case</span><code>{caseId}</code><span>Allocation</span><code>{allocationId}</code><span>Local preview</span><strong>{chosen?.id||"none"} · {result.allocated}/{total} crates (not on-chain)</strong></div>
     <div className="lcActions"><button disabled={!addressesReady||!!busy||existingCase||!walletReady||!!pendingTx} onClick={()=>write("matcher","seal_case",[caseId])}>3 · Donor seals</button><button disabled={!addressesReady||!!busy||existingCase||!walletReady||!!pendingTx} onClick={()=>write("matcher","match_case",[caseId])}>4 · Match by consensus</button><button className="secondary" disabled={!addressesReady||!!busy} onClick={()=>read("matcher","get_allocation",[allocationId])}>Read allocation</button></div>
     <p className="lcHelper">Wait for each transaction's actual status. Read the allocation before the driver signs the handoff.</p>
     <div className="lcActions"><button className="secondary" onClick={()=>setStage("kitchens")}>← Kitchens</button><button className="lcNext" onClick={()=>setStage("handoff")}>Handoff →</button></div>
    </>}
    {stage==="handoff"&&<>
     <div className="lcStepHeading"><div><span className="eyebrow">04 · DRIVER + KITCHEN WALLETS</span><h2>Signed handoff</h2></div><span>HandoffLedger</span></div>
     <p className="lcHelper">The driver and selected kitchen sign separately. These are declared counts, not independent physical delivery proof.</p>
     <div className="lcFields"><label>Driver declared crates<input type="number" min={0} max={total} value={driverCount} onChange={e=>setDriverCount(Number(e.target.value))}/></label><label>Kitchen declared crates<input type="number" min={0} max={total} value={kitchenCount} onChange={e=>setKitchenCount(Number(e.target.value))}/></label></div>
     <div className="lcHandoffResult"><strong>{handoff?.status||"No valid local handoff"}</strong><span>{handoff?.status==="COMPLETE"?String(handoff.received)+" received · "+String(handoff.missing)+" missing":handoff?.status==="PARTIAL"?"Both sides agree on a shortfall":handoff?.status==="DISPUTED"?"Declarations differ":"An allocation is needed first"} (local preview only)</span></div>
     <div className="lcActions"><button disabled={!addressesReady||!!busy||existingCase||!walletReady||!!pendingTx} onClick={()=>write("ledger","confirm_dispatch",[allocationId,driverCount])}>5 · Driver confirms</button><button disabled={!addressesReady||!!busy||existingCase||!walletReady||!!pendingTx} onClick={()=>write("ledger","confirm_receipt",[allocationId,kitchenCount])}>6 · Kitchen confirms</button><button className="secondary" disabled={!addressesReady||!!busy} onClick={()=>read("ledger","get_handoff",[allocationId])}>Read handoff</button></div>
     <div className="lcActions"><button className="secondary" onClick={()=>setStage("allocation")}>← Matching</button></div>
    </>}
   </section>
   <aside className="lcMonitor" aria-label="GenLayer transaction status and evidence">
    <div className="lcMonitorTitle"><div><span className="eyebrow">GENLAYER STUDIONET</span><h2>Live transaction status</h2></div><span className={pendingTx?"lcMonitorTag following":"lcMonitorTag"}>{pendingTx?"Following…":"Auto-follow"}</span></div>
    {!walletReady&&<p className="lcInfo">Connect your wallet on Studionet (chain 61999). Public reads are available without signing.</p>}
    {walletError&&<p role="alert" className="lcError">{walletError}</p>}
    {pendingTx&&<div className="lcFollowing" role="status"><span className="txSpinner" aria-hidden="true"/><div><strong>{pendingTx.method}</strong><span>Hash saved · checking on-chain automatically</span><a href={explorerTx(pendingTx.hash)} target="_blank" rel="noopener noreferrer">{shortWallet(pendingTx.hash)} · Explorer ↗</a></div></div>}
    {txLastError&&<p role="alert" className="lcError">{txLastError} · Don't blindly re-sign.</p>}
    <div className="lcFeedback" role="status">{busy?"Working: "+busy:feedback||"Approve a wallet transaction to start automatic tracking."}</div>
    <div className="lcSectionHeading"><h3>Saved transactions <small>({txHistory.length})</small></h3>{txHistory.length>3&&<button className="lcTextButton" onClick={()=>setShowAllHistory(!showAllHistory)}>{showAllHistory?"Show less":"View all"}</button>}</div>
    {txHistory.length===0?<p className="lcInfo">No transactions signed in this browser yet.</p>:<div className={showAllHistory?"lcTxList expanded":"lcTxList"}>{txHistory.slice(0,showAllHistory?60:3).map(tx=><div className="lcTxRow" key={tx.hash}><div><strong>{tx.method}</strong><span className={"lcTxOutcome "+tx.outcome}>{tx.outcome==="pending"?tx.status:tx.outcome==="verified"?"Verified":tx.outcome==="failed"?"Failed":"Finalized · verify result"}</span></div><p>{tx.message}</p><a target="_blank" rel="noopener noreferrer" href={explorerTx(tx.hash)}>{shortWallet(tx.hash)} · Explorer ↗</a></div>)}</div>}
    <div className="lcSectionHeading"><h3>Contract readback</h3><small>Public · no signature</small></div>
    {output?<pre className="lcReadback">{output}</pre>:<p className="lcInfo">Use Read case, Read allocation, or Read handoff to inspect contract state.</p>}
    <details className="lcDetails"><summary>Recorded proof and contract addresses</summary><p>Previous COMPLETE handoff: Kitchen A received 6 of 18, with 12 unallocated.</p><div className="lcActions"><button className="secondary" disabled={!addressesReady||!!busy} onClick={()=>read("matcher","get_allocation",[proof.allocationId])}>Read past allocation</button><button className="secondary" disabled={!addressesReady||!!busy} onClick={()=>read("ledger","get_handoff",[proof.allocationId])}>Read past handoff</button></div><p><a href="https://github.com/bearbaba/LASTCRATE/issues/1" target="_blank" rel="noopener noreferrer">Full evidence log ↗</a></p><ul>{transactions.map(tx=><li key={tx.hash}><a target="_blank" rel="noopener noreferrer" href={explorerTx(tx.hash)}>{tx.method} · {shortWallet(tx.hash)}</a></li>)}</ul><p>RescueMatcher <code>{matcher}</code></p><p>HandoffLedger <code>{ledger}</code></p></details>
   </aside>
  </div>
  <footer className="lcFooter"><span>LASTCRATE · FOOD RESCUE · 2026</span><span>Local preview ≠ on-chain consensus · Signed reports ≠ independent delivery proof</span></footer>
 </main>;
}
