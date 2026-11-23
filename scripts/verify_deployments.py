#!/usr/bin/env python3
"""Read-only source audit against finalized GenLayer Studionet code."""
import base64, hashlib, json, os, sys, urllib.request
from pathlib import Path
RPC="https://studio.genlayer.com/api"
CONTRACTS=[
 ("RescueMatcher","0xb26b2C9b2aa91D275055B32b861D5276dC3D0347",Path("contracts/RescueMatcher.py")),
 ("HandoffLedger","0x298eaf18DAC8bdD4E573832613BDC8e34C8f0438",Path("contracts/HandoffLedger.py")),
]
def rpc(method,params):
 data=json.dumps({"jsonrpc":"2.0","method":method,"params":params,"id":1}).encode()
 req=urllib.request.Request(RPC,data=data,headers={"Content-Type":"application/json"},method="POST")
 with urllib.request.urlopen(req,timeout=30) as res: body=json.load(res)
 if "error" in body: raise RuntimeError(str(body["error"]))
 return body.get("result")
def normalize(s):
 return s.replace("\r\n","\n").replace("\r","\n").rstrip("\n")+"\n"
def digest(s):
 return hashlib.sha256(normalize(s).encode()).hexdigest()
def verify(name,address,path):
 code=rpc("gen_getContractCode",[{"address":address,"status":"finalized"}])
 if not isinstance(code,str) or not code:
  raise RuntimeError("No finalized source code returned")
 source=base64.b64decode(code,validate=True).decode("utf-8")
 expected=path.read_text(encoding="utf-8")
 return {"contract":name,"address":address,"finalized_source_found":True,
  "class_present":("class "+name+"(") in source,
  "source_hash_match":digest(source)==digest(expected),
  "deployed_sha256":digest(source),"repo_sha256":digest(expected),
  "source_length":len(source)}
def main():
 findings=[]
 for name,address,path in CONTRACTS:
  try: findings.append(verify(name,address,path))
  except Exception as e: findings.append({"contract":name,"address":address,
                                         "error":type(e).__name__+": "+str(e)})
 print("LASTCRATE finalized code verification — no wallet writes, no fees")
 for f in findings: print(json.dumps(f,ensure_ascii=False))
 ok=all(x.get("source_hash_match") is True and x.get("class_present") is True for x in findings)
 print("EXACT CURRENT SOURCE MATCH:",ok)
 print("Cross-contract constructor linkage and on-chain business cases remain unverified.")
 Path("deployment-check.json").write_text(json.dumps(findings,indent=2)+"\n")
 if os.getenv("GITHUB_STEP_SUMMARY"):
  with open(os.environ["GITHUB_STEP_SUMMARY"],"a") as fh:
   fh.write("# LASTCRATE source audit\n\n")
   for f in findings:
    fh.write("- "+f["contract"]+": "+("EXACT MATCH" if f.get("source_hash_match") else "UNVERIFIED / DIFFERENT SOURCE")+"\n")
   fh.write("\nRead-only: no transaction proof or cross-contract readback.\n")
 return 0 if ok else 1
if __name__=="__main__":sys.exit(main())
