/** Public, user-supplied GenLayer Studionet receipts: a fixed review case, not live telemetry. */
export const proof = {
  network: "GenLayer Studionet",
  caseId: "lastcrate-231126-v2-lateb",
  allocationId: "lastcrate-231126-v2-lateb:a1",
  matcher: "0xc38Ed838F7d35f7F1f9a5888de5900D47f940Af2",
  ledger: "0x77C85f398afE09debc331C249E0373109c279F83",
  donor: "0x4C7cb73aC8F8999af21cfc9fF4cF2333a9508Dcb",
  selectedKitchen: "Kitchen A",
  selectedKitchenWallet: "0xD6b8A3A5eB329410D9504784812b8569afA8C2aF",
  requested: 18,
  planned: 6,
  unallocated: 12,
  driverReport: 6,
  kitchenReport: 6,
  received: 6,
  missing: 0,
  status: "COMPLETE",
  window: { pickup: "16:40", deadline: "17:30", kitchenAFrom: "17:00", kitchenBFrom: "17:45" },
  captured: "2026-11-23",
} as const;

export const transactions = [
  { label: "Donation created", role: "Donor", method: "open_case", hash: "0x7cb21dafd14436ad7e6aad5c88979b867bb50f5dc0ff3c841589e153f4138add" },
  { label: "Receiving terms — Kitchen A", role: "Kitchen A", method: "submit_offer", hash: "0x775b1a9a24006e614acd3b78b129372079418e2e6c992f52405cf8c79a0b9409" },
  { label: "Receiving terms — Kitchen B", role: "Kitchen B", method: "submit_offer", hash: "0x9dcfa95c756df61b0e8e94b0130fd836ac2b0cab12c94bae2cfcc7dab8b9682b" },
  { label: "Offers sealed", role: "Donor", method: "seal_case", hash: "0x720e311ac40d885ca612a974d2abc27f52b595d377c96910060a6b01db8acdd7" },
  { label: "Consensus allocation", role: "Donor", method: "match_case", hash: "0x17391ac1c95059be9968ab333b7317b7fd1929be4f47b8dfb82ea59560d28f11" },
  { label: "Dispatch declared", role: "Driver", method: "confirm_dispatch", hash: "0xa4154e1f104d5bae1d3c52f47e38e2f0e79ad4e64ab7e011f9801558b6414431" },
  { label: "Receipt declared", role: "Kitchen A", method: "confirm_receipt", hash: "0x5cc8c8dff97fcecb657969275a2475e54b825c7d89642656d9a00d744b9bb603" },
] as const;

export const explorerTx = (hash:string)=>"https://explorer-studio.genlayer.com/tx/"+hash;

export function prettyReadback(raw:string):string{
  try{
    const parsed:unknown=JSON.parse(raw);
    const decoded=typeof parsed==="string"?JSON.parse(parsed):parsed;
    return JSON.stringify(decoded,null,2);
  }catch{
    return raw;
  }
}
