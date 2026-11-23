"use client";
import {useEffect,useMemo,useState} from "react";
import {LATE_B,seedOffers,matchOffers,reconcile,type Offer} from "../lib/demo";
import {connectWallet,getInjectedProvider,getWalletSession,isExpectedSigner,isStudionetChain,signWrite,publicRead} from "../lib/genlayer";
import {proof,transactions,explorerTx,prettyReadback} from "../lib/evidence";
type Tab="proof"|"dispatch"|"chain";
const matcher=process.env.NEXT_PUBLIC_RESCUE_MATCHER_ADDRESS||"";
const ledger=process.env.NEXT_PUBLIC_HANDOFF_LEDGER_ADDRESS||"";
const videoCaseId="lastcrate-231126-video-01";
const videoDonor="0x4C7cb73aC8F8999af21cfc9fF4cF2333a9508Dcb";
const videoKitchenA="0xD6b8A3A5eB329410D9504784812b8569afA8C2aF";
const videoKitchenB="0x60Bfdf6315294c7856Acdc0B80D7Bd40217DEBff";
const shortWallet=(address:string)=>address.slice(0,6)+"…"+address.slice(-4);
export default function Home(){
 const [tab,setTab]=useState<Tab>("proof");
 const [offers,setOffers]=useState<Offer[]>(seedOffers);
 const [total,setTotal]=useState(18);const [deadline,setDeadline]=useState("17:30");
 const [driverCount,setDriverCount]=useState(16);const [kitchenCount,setKitchenCount]=useState(16);
 const [caseId,setCaseId]=useState("rescue-01");const [driverWallet,setDriverWallet]=useState("");
 const [busy,setBusy]=useState("");const [feedback,setFeedback]=useState("");const [output,setOutput]=useState("");
 const [walletAddress,setWalletAddress]=useState("");const [walletChainId,setWalletChainId]=useState("");
 const [walletError,setWalletError]=useState("");
 const result=useMemo(()=>matchOffers(offers,total,deadline,"16:40",caseId),[offers,total,deadline,caseId]);
 const chosen=result.selected;const validReport=!!chosen&&driverCount>=0&&kitchenCount>=0&&driverCount<=result.allocated&&kitchenCount<=result.allocated;
 const handoff=validReport?reconcile(result.allocated,driverCount,kitchenCount):null;
 const addressesReady=!!matcher&&!!ledger;
 const existingCase=caseId===proof.caseId;
 const isVideoCase=caseId===videoCaseId;
 const walletReady=!!walletAddress&&isStudionetChain(walletChainId);
 const videoRole=!isVideoCase?"":walletAddress.toLowerCase()===videoDonor.toLowerCase()?"Donor / Driver":walletAddress.toLowerCase()===videoKitchenA.toLowerCase()?"Kitchen A":walletAddress.toLowerCase()===videoKitchenB.toLowerCase()?"Kitchen B":"Unrecognized signer";
 function expectedSigner(method:string,args:(string|number)[]):string|undefined{
  if(!isVideoCase)return undefined;
  if(method==="submit_offer")return args[1]==="Kitchen A"?videoKitchenA:args[1]==="Kitchen B"?videoKitchenB:undefined;
  if(method==="confirm_receipt")return videoKitchenA;
  return videoDonor;
 }
 function signerReady(method:string,args:(string|number)[]):boolean{
  return walletReady&&isExpectedSigner(walletAddress,expectedSigner(method,args));
 }
 useEffect(()=>{
  const provider=getInjectedProvider();
  if(!provider)return;
  let active=true;
  const refresh=()=>{
   getWalletSession().then(session=>{if(active){setWalletAddress(session?.account||"");setWalletChainId(session?.chainId||"");}})
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
 async function connectWalletUI(){
  setBusy("wallet_connect");setWalletError("");
  try{const session=await connectWallet();setWalletAddress(session.account);setWalletChainId(session.chainId);}
  catch(err){setWalletError(err instanceof Error?err.message:String(err));
   const session=await getWalletSession().catch(()=>null);setWalletAddress(session?.account||"");setWalletChainId(session?.chainId||"");
  }finally{setBusy("");}
 }
 const allocationId=caseId+":a1";
 function update(id:string,key:keyof Offer,value:string|number){
  setOffers(curr=>curr.map(x=>x.id===id?{...x,[key]:value}:x));
 }
 function prepareVideo(){
  setCaseId(videoCaseId);
  setOffers(seedOffers.map(o=>o.id==="Kitchen B"?{...o,note:LATE_B}:{...o}));
  setTotal(18);setDeadline("17:30");setDriverCount(6);setKitchenCount(6);
  setDriverWallet(videoDonor);setFeedback("");setOutput("");setTab("chain");
 }
 async function write(to:"matcher"|"ledger",method:string,args:(string|number)[]){
  setBusy(method);setFeedback("");
  try{if(!signerReady(method,args))throw Error("Wrong wallet or network. Connect the expected signer on Studionet.");const hash=await signWrite(to==="matcher"?matcher:ledger,method,args,expectedSigner(method,args));setFeedback("FINALIZED · CONSENSUS ACCEPTED · EXECUTION SUCCESS / "+method+" / "+hash);}
  catch(e){setFeedback("TRANSACTION NOT VERIFIED / "+(e instanceof Error?e.message:String(e))+" · Inspect Explorer; do not blindly retry.");}finally{setBusy("");}
 }
 async function read(to:"matcher"|"ledger",method:string,args:(string|number)[]){
  setBusy(method);setFeedback("");setOutput("");
  try{setOutput(prettyReadback(await publicRead(to==="matcher"?matcher:ledger,method,args)));setFeedback("Public contract readback completed.");}
  catch(e){setFeedback("READ FAILED / "+(e instanceof Error?e.message:String(e)));}finally{setBusy("");}
 }
 return <main><header className="header"><div className="brand"><div className="mark">L<span>✳</span></div><div>LASTCRATE<small>FOOD RESCUE / GENLAYER</small></div></div><div className="headerActions"><div className="headerTags"><span>02 INTELLIGENT CONTRACTS</span><span>{addressesReady?"ADDRESSES CONFIGURED":"DEPLOYMENT UNVERIFIED"}</span></div><div className="walletTop"><button className={walletReady?"walletConnected":"walletConnect"} disabled={!!busy} onClick={connectWalletUI}>{busy==="wallet_connect"?"Connecting…":walletReady?shortWallet(walletAddress):walletAddress?"Switch to Studionet":"Connect Wallet"}</button>{walletAddress&&<small>{walletReady?"Studionet · Connected":"Wrong network"}</small>}</div></div></header>
 <section className="hero"><div><span className="eyebrow">THE LAST MILE SHOULDN&apos;T BE A GUESS.</span><h1>Rescue the food.<br/><em>Account for every crate.</em></h1><p>Interpret real kitchen intake limits, allocate before the cutoff, and reconcile what both sides actually report receiving.</p></div><div className="heroNumber"><span>CASE / 001</span><strong>18</strong><small>CRATES · LAST-MILE HANDOFF</small></div></section>
 <nav className="tabs" aria-label="Project sections"><button className={tab==="proof"?"active":""} onClick={()=>setTab("proof")}>01 / On-chain evidence</button><button className={tab==="dispatch"?"active":""} onClick={()=>setTab("dispatch")}>02 / Review scenario</button><button className={tab==="chain"?"active":""} onClick={()=>setTab("chain")}>03 / Live GenLayer</button></nav>

 {tab==="proof"&&<div className="workspace">
  <section className="proofHero"><div><span className="eyebrow">GENLAYER STUDIO · RECORDED 23 NOV 2026</span><h2>From intake limits to a signed handoff.</h2><p>One complete food rescue case, seven finalized transactions and public contract readbacks. No staged numbers presented as a live feed.</p></div><span className="proofChip">COMPLETE · DECLARED BY BOTH SIDES</span></section>
  <div className="proofStats"><div><strong>{proof.requested}</strong><span>Crates offered</span></div><div><strong>{proof.planned}</strong><span>Assigned to Kitchen A</span></div><div><strong>{proof.unallocated}</strong><span>Left unallocated</span></div><div><strong>{proof.received}</strong><span>Agreed handoff count</span></div></div>
  <div className="topGrid">
   <section className="panel proofStory"><span className="eyebrow">RESCUEMATCHER · BOUNDED DECISION</span><h2>Capacity beats proximity. A missed window never counts.</h2><p className="muted">Cutoff {proof.window.deadline} · Kitchen A arrives 17:05 · Kitchen B arrives 17:15 but cannot receive before 17:45.</p>
    <div className="proofKitchen"><div><b>Kitchen A <span className="proofYes">SELECTED</span></b><strong>6 crates</strong></div><q>After 17:00, one staff member can receive at most 6 crates.</q><small>Receiving from {proof.window.kitchenAFrom} · eligible · 2 km declared</small></div>
    <div className="proofKitchen"><div><b>Kitchen B <span className="proofNo">OUTSIDE RECEPTION WINDOW</span></b><strong>0 feasible</strong></div><q>We can receive up to 18 crates, but only from 17:45 onwards.</q><small>Receiving from {proof.window.kitchenBFrom}, after the deadline · 7 km declared</small></div>
    <div className="proofOutcome"><strong>12 crates remain explicitly unallocated.</strong><span>No allocation is fabricated to satisfy the full donation amount.</span></div>
   </section>
   <aside className="panel console"><span className="eyebrow">LIVE READ / GENLAYER STUDIONET</span><h2>Check the recorded case yourself.</h2><p className="muted">These read-only calls query the deployed contracts. They require network access but not a wallet signature.</p><label>Allocation ID</label><code>{proof.allocationId}</code><div className="actions"><button disabled={!addressesReady||!!busy} onClick={()=>read("matcher","get_allocation",[proof.allocationId])}>Read allocation</button><button className="secondary" disabled={!addressesReady||!!busy} onClick={()=>read("ledger","get_handoff",[proof.allocationId])}>Read handoff</button></div><div className="feedback" role="status">{busy?"Reading "+busy+"…":feedback||"Select a public read to fetch the latest stored contract result."}</div><pre aria-label="Public on-chain readback">{output||"Contract response appears here. Recorded receipts are shown below."}</pre><div className="actions"><button onClick={prepareVideo}>Prepare signing-video demo</button><button className="secondary" onClick={()=>{setCaseId(proof.caseId);setOutput("");setFeedback("");setTab("chain");}}>Open recorded case in live workspace</button></div></aside>
  </div>
  <section className="panel proofReceipts"><div className="proofHeading"><div><span className="eyebrow">HANDOFFLEDGER · MATCHED REPORTS</span><h2>Both parties declared six. The ledger reconciled six.</h2></div><span className="proofChip">STATUS / COMPLETE</span></div><div className="proofReconcile"><div><b>6</b><span>Planned</span></div><div><b>6</b><span>Driver report</span></div><div><b>6</b><span>Kitchen report</span></div><div><b>0</b><span>Missing</span></div></div><p className="muted">The ledger records wallet-signed claims and their agreement. It is not independent proof that food was physically delivered.</p>
   <h3>Transaction trail <small>FINALIZED · CONSENSUS ACCEPTED · GENVM SUCCESS</small></h3><div className="txGrid">{transactions.map((tx,i)=><a key={tx.hash} className="txItem" href={explorerTx(tx.hash)} target="_blank" rel="noopener noreferrer"><span className="txNumber">{String(i+1).padStart(2,"0")}</span><span><b>{tx.label}</b><small>{tx.role} · {tx.method}</small><code>{tx.hash.slice(0,11)}…{tx.hash.slice(-8)}</code></span><span aria-hidden="true">↗</span></a>)}</div>
   <p className="proofFootnote">Studio evidence and contract readbacks were captured on {proof.captured}. <a href="https://github.com/bearbaba/LASTCRATE/issues/1" target="_blank" rel="noopener noreferrer">Review the full verification log ↗</a></p>
  </section>
 </div>}
 {tab==="dispatch"&&<div className="workspace"><div className="notice"><strong>LOCAL SCENARIO PREVIEW</strong> These bounded rules demonstrate expected behavior; they are not a validated GenLayer consensus execution or physical delivery proof.</div>
 <div className="topGrid"><section className="panel editor"><div className="panelTop"><span className="eyebrow">RESCUE CASE</span><h2>Donation window</h2></div><div className="fields"><div><label>Case ID</label><input value={caseId} onChange={e=>setCaseId(e.target.value)}/></div><div><label>Available crates</label><input type="number" min={1} max={10000} value={total} onChange={e=>setTotal(Math.max(1,Number(e.target.value)||1))}/></div><div><label>Pickup</label><input value="16:40" disabled/></div><div><label>Hard deadline</label><input type="time" value={deadline} onChange={e=>setDeadline(e.target.value)}/></div></div>
 <h3>Kitchen intake offers</h3>{offers.map((o,i)=><div className="offerInput" key={o.id}><div className="offerHeading"><b>{o.id}</b><span>{i===0?"NEAR / RESTRICTED":"FAR / HIGH CAPACITY"}</span></div><label>Natural-language intake note</label><textarea rows={2} value={o.note} onChange={e=>update(o.id,"note",e.target.value)}/><div className="fields"><div><label>ETA</label><input type="time" value={o.arrival} onChange={e=>update(o.id,"arrival",e.target.value)}/></div><div><label>Advertised capacity</label><input type="number" min={0} value={o.nominal} onChange={e=>update(o.id,"nominal",Number(e.target.value))}/></div></div></div>)}
 <div className="actions"><button onClick={prepareVideo}>Prepare 7-transaction recording</button><button onClick={()=>update("Kitchen B","note",LATE_B)}>Move B to 17:45</button><button className="secondary" onClick={()=>{setOffers(seedOffers.map(o=>({...o})));setTotal(18);setDeadline("17:30");}}>Restore case</button></div></section>
 <section className="panel verdict"><span className="eyebrow">MATCH RESULT · RESCUEMATCHER</span><div className="winner"><span>SELECTED RECEIVER</span><h2>{chosen?.id||"No eligible kitchen"}</h2><p>{chosen?"Best feasible capacity before deadline, not simply the nearest location.":"No intake offer can be verified within this window."}</p></div><div className="numbers"><div><strong>{result.allocated}</strong><span>Allocated crates</span></div><div className={result.unallocated?"warning":""}><strong>{result.unallocated}</strong><span>Unallocated crates</span></div></div><span className="eyebrow">EVIDENCE PER KITCHEN</span>{result.evaluations.map(x=><div className="evaluation" key={x.id}><div><b>{x.id}</b><span>{x.feasible} / {total} feasible</span></div><p>{x.eligible?"Arrival respects interpreted intake window.":"Ineligible at arrival, outside deadline, or lacks explicit receiving capacity."}</p><q>{x.evidence}</q></div>)}<small className="muted">Tie-breaker: earlier arrival, shorter km, then kitchen ID. Unallocated food stays visible.</small></section></div>
 <section className="handoff"><div className="handoffHeading"><div><span className="eyebrow">HANDOFFLEDGER / POST-DELIVERY</span><h2>What actually changed hands?</h2></div><span className="caseRef">{allocationId}</span></div><div className="handoffGrid"><div><label>Driver declared crates</label><input type="number" min={0} max={result.allocated} value={driverCount} onChange={e=>setDriverCount(Number(e.target.value))}/></div><div><label>Kitchen declared crates</label><input type="number" min={0} max={result.allocated} value={kitchenCount} onChange={e=>setKitchenCount(Number(e.target.value))}/></div><div className="handoffResult">{!chosen?<><strong>NO HANDOFF</strong><span>No kitchen allocated</span></>:!handoff?<><strong>INVALID QUANTITY</strong><span>Confirmations must not exceed {result.allocated} allocated crates</span></>:<><span className={"handoffStatus "+handoff.status}>{handoff.status}</span><strong>{handoff.received===null?"Two different reports":handoff.received+" delivered · "+handoff.missing+" missing"}</strong><span>{handoff.status==="DISPUTED"?"Driver "+driverCount+" vs kitchen "+kitchenCount+" — no agreed received count":handoff.status==="PARTIAL"?"Both sides agree on a shortfall": "Both sides confirm the planned quantity"}</span></>}</div></div><div className="actions"><button className="secondary" onClick={()=>{setDriverCount(16);setKitchenCount(16)}}>Partial 16 / 16</button><button className="secondary" onClick={()=>{setDriverCount(18);setKitchenCount(16)}}>Dispute 18 / 16</button><button className="secondary" onClick={()=>{setDriverCount(result.allocated);setKitchenCount(result.allocated)}}>Confirm allocated / allocated</button></div></section></div>}
 {tab==="chain"&&<div className="workspace"><section className="walletPanel" aria-label="Wallet connection"><div><span className="eyebrow">WALLET / GENLAYER STUDIONET</span><h2>{walletReady?"Wallet connected":"Connect your wallet before signing"}</h2><p>{walletReady?walletAddress+" · "+(videoRole||"Connected signer"):walletAddress?"Wallet detected on another network. Switch to GenLayer Studionet to continue.":"Connect a browser wallet (for example MetaMask) to request signatures. Read-only contract checks work without a wallet."}</p>{walletError&&<p role="alert" className="walletError">{walletError}</p>}</div><button disabled={!!busy} onClick={connectWalletUI}>{walletReady?"Refresh / Switch Wallet":walletAddress?"Switch to Studionet":"Connect Wallet"}</button></section><div className="notice"><strong>{addressesReady?"WALLET-SIGNED WORKFLOW":"DEPLOYMENT REQUIRED"}</strong>{addressesReady?" Each role signs only its own statement. Check finalized execution and read back the result.":" Deploy RescueMatcher and HandoffLedger on a compatible GenLayer network, then configure public addresses."}</div><div className="actions"><button onClick={prepareVideo}>Load signing-video preset · 18 → 6 / 12</button></div>{isVideoCase&&<div className="panel" style={{margin:"16px 0"}}><span className="eyebrow">RECORDING MODE · WALLET SIGNATURES ARE MANUAL</span><h2>Seven signatures. One verifiable handoff.</h2><p className="muted">Case <code>{videoCaseId}</code> · 18 vegetable crates · pickup 16:40 · cutoff 17:30 · Kitchen B restricted to after 17:45. Driver and kitchen declarations are prefilled to 6 / 6. No writes happen automatically.</p><ol style={{lineHeight:1.9,paddingLeft:20,fontSize:12}}><li><b>Donor:</b> open_case · <code>0x4C7cb73aC8F8999af21cfc9fF4cF2333a9508Dcb</code></li><li><b>Kitchen A:</b> submit_offer · <code>0xD6b8A3A5eB329410D9504784812b8569afA8C2aF</code></li><li><b>Kitchen B:</b> submit_offer · <code>0x60Bfdf6315294c7856Acdc0B80D7Bd40217DEBff</code></li><li><b>Donor:</b> seal_case · donor wallet</li><li><b>Donor:</b> match_case · donor wallet → <b>Read allocation</b> and check Kitchen A 6 / unallocated 12</li><li><b>Driver:</b> confirm_dispatch(6) · donor/driver wallet</li><li><b>Kitchen A:</b> confirm_receipt(6) · Kitchen A wallet → <b>Read handoff</b> and check COMPLETE</li></ol><p className="muted">Stop at each signature until Explorer reports FINALIZED, Accepted and GenVM SUCCESS. If the first transaction has already been signed, continue with the next step rather than submitting it again. Wallet popups and physical deliveries cannot be simulated as proof.</p></div>}<div className="topGrid"><section className="panel editor"><h2>Submit a real rescue case</h2><p className="muted">New case: donor opens and seals, each kitchen submits an independently signed offer, then donor requests matching. To inspect the recorded case, use read-only buttons below. A sealed case cannot be reopened.</p>{existingCase&&<div className="notice"><strong>READ-ONLY CASE</strong> This documented allocation has already been sealed and completed. Change Case ID to submit a new case; do not repeat its writes.</div>}<label>Driver wallet (0x…)</label><input value={driverWallet} onChange={e=>setDriverWallet(e.target.value)} placeholder="0x..." /><div className="actions"><button disabled={!addressesReady||!!busy||!driverWallet||existingCase||!signerReady("open_case",[])} onClick={()=>write("matcher","open_case",[caseId,"Vegetable crates",total,"16:40",deadline,driverWallet])}>1. Donor opens case</button>{offers.map(x=><button key={x.id} disabled={!addressesReady||!!busy||existingCase||!signerReady("submit_offer",[caseId,x.id])} onClick={()=>write("matcher","submit_offer",[caseId,x.id,x.note,x.nominal,x.arrival,x.distanceKm])}>2. {x.id} offer</button>)}<button disabled={!addressesReady||!!busy||existingCase||!signerReady("seal_case",[])} onClick={()=>write("matcher","seal_case",[caseId])}>3. Donor seals</button><button disabled={!addressesReady||!!busy||existingCase||!signerReady("match_case",[])} onClick={()=>write("matcher","match_case",[caseId])}>4. Match by consensus</button><button className="secondary" disabled={!addressesReady||!!busy} onClick={()=>read("matcher","get_allocation",[allocationId])}>Read allocation</button></div><hr/><h2>Sign actual handoff reports</h2><p className="muted">The chosen receiver is bound by its offer-signing wallet. Neither party can silently edit the other&apos;s quantity. Second confirmation finalizes COMPLETE, PARTIAL or DISPUTED once.</p><div className="actions"><button disabled={!addressesReady||!!busy||existingCase||!signerReady("confirm_dispatch",[])} onClick={()=>write("ledger","confirm_dispatch",[allocationId,driverCount])}>5. Driver confirms</button><button disabled={!addressesReady||!!busy||existingCase||!signerReady("confirm_receipt",[])} onClick={()=>write("ledger","confirm_receipt",[allocationId,kitchenCount])}>6. Kitchen confirms</button><button className="secondary" disabled={!addressesReady||!!busy} onClick={()=>read("ledger","get_handoff",[allocationId])}>Read handoff</button></div></section><aside className="panel console"><span className="eyebrow">CHAIN TRANSACTION CONSOLE</span><h2>Never infer a delivery from a plan.</h2><label>RescueMatcher</label><code>{matcher||"Not configured"}</code><label>HandoffLedger</label><code>{ledger||"Not configured"}</code><div className="feedback" role="status">{busy?"In progress: "+busy:feedback||"No GenLayer transaction submitted in this session."}</div><pre>{output||"On-chain readback will appear here."}</pre></aside></div></div>}
 <footer><span>LASTCRATE / GENLAYER / 2026</span><span>LOCAL PREVIEW ≠ ON-CHAIN VERIFICATION · NO PHYSICAL PROOF CLAIM</span></footer></main>;
}
