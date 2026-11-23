# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""LASTCRATE contract 2/2: one-shot reconciled physical handoff declarations.

Dispatch and kitchen receipts are signer-bound and cannot be re-submitted.
A matched allocation is read directly from RescueMatcher.
"""
from genlayer import *
import json


@gl.contract_interface
class RescueMatcherAPI:
    class View:
        def get_allocation(self, allocation_id: str) -> str: ...
    class Write:
        pass


class HandoffLedger(gl.Contract):
    matcher: Address
    handoffs: TreeMap[str, str]

    def __init__(self, matcher_address: str):
        self.matcher = Address(matcher_address)

    def _allocation(self, allocation_id: str) -> dict:
        raw = RescueMatcherAPI(self.matcher).view().get_allocation(allocation_id)
        if not raw:
            raise gl.vm.UserError("Unknown allocation from matcher contract")
        allocation = json.loads(raw)
        if allocation["allocated_crates"] <= 0 or not allocation["kitchen_wallet"]:
            raise gl.vm.UserError("No receiving kitchen was allocated")
        return allocation

    def _record(self, allocation_id: str, allocation: dict) -> dict:
        current = self.handoffs.get(allocation_id, "")
        if current:
            return json.loads(current)
        return {
            "allocation_id": allocation_id, "matcher_address": self.matcher.as_hex,
            "case_id": allocation["case_id"], "kitchen_id": allocation["kitchen_id"],
            "planned": allocation["allocated_crates"], "driver_report": None,
            "kitchen_report": None, "status": "PENDING",
            "received": None, "missing": None
        }

    def _submit(self, allocation_id: str, crates: int, side: str) -> None:
        allocation = self._allocation(allocation_id)
        sender = gl.message.sender_address.as_hex.lower()
        expected = allocation["driver"] if side == "driver" else allocation["kitchen_wallet"]
        if sender != expected:
            raise gl.vm.UserError("Wrong signer for this handoff role")
        if crates < 0 or crates > allocation["allocated_crates"]:
            raise gl.vm.UserError("Confirmed quantity exceeds planned allocation")
        row = self._record(allocation_id, allocation)
        if row["status"] != "PENDING" or row[side + "_report"] is not None:
            raise gl.vm.UserError("This side already confirmed or allocation is closed")
        row[side + "_report"] = crates
        if row["driver_report"] is not None and row["kitchen_report"] is not None:
            if row["driver_report"] != row["kitchen_report"]:
                row["status"] = "DISPUTED"
                row["received"] = None
                row["missing"] = None
            else:
                row["received"] = row["driver_report"]
                row["missing"] = row["planned"] - row["received"]
                row["status"] = "COMPLETE" if row["missing"] == 0 else "PARTIAL"
        self.handoffs[allocation_id] = json.dumps(row, sort_keys=True)

    @gl.public.write
    def confirm_dispatch(self, allocation_id: str, crates: int) -> None:
        self._submit(allocation_id, crates, "driver")

    @gl.public.write
    def confirm_receipt(self, allocation_id: str, crates: int) -> None:
        self._submit(allocation_id, crates, "kitchen")

    @gl.public.view
    def get_handoff(self, allocation_id: str) -> str:
        stored = self.handoffs.get(allocation_id, "")
        if stored:
            return stored
        allocation = self._allocation(allocation_id)
        return json.dumps(self._record(allocation_id, allocation), sort_keys=True)
