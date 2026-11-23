"""GenLayer SDK direct-mode tests of HandoffLedger role and close-out logic.

The RescueMatcher external read is mocked by replacing the contract's _allocation
method. Real cross-contract view() must still be verified on hosted GenLayer.
"""
import json
import pytest

ALLOCATION_ID = "case-handoff:a1"


def setup_ledger(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch):
    contract = direct_deploy("contracts/HandoffLedger.py", "0x" + "9" * 40)
    from genlayer import Address
    allocation = {
        "version": 1,
        "case_id": "case-handoff",
        "kitchen_id": "Kitchen B",
        "driver": Address(direct_alice).as_hex.lower(),
        "kitchen_wallet": Address(direct_bob).as_hex.lower(),
        "allocated_crates": 18,
        "total_crates": 18,
    }
    # Real contract method logic, only the external chain read is stubbed.
    monkeypatch.setattr(type(contract._instance), "_allocation",
                        lambda self, allocation_id: allocation
                        if allocation_id == ALLOCATION_ID else None)
    return contract


def test_matching_sides_report_partial(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch):
    c = setup_ledger(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch)
    direct_vm.sender = direct_alice
    c.confirm_dispatch(ALLOCATION_ID, 16)
    pending = json.loads(c.get_handoff(ALLOCATION_ID))
    assert pending["status"] == "PENDING"
    assert pending["kitchen_report"] is None
    direct_vm.sender = direct_bob
    c.confirm_receipt(ALLOCATION_ID, 16)
    rec = json.loads(c.get_handoff(ALLOCATION_ID))
    assert (rec["status"], rec["received"], rec["missing"]) == ("PARTIAL", 16, 2)
    assert rec["allocation_version"] == 1


def test_conflicting_reports_disputed_not_completed(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch):
    c = setup_ledger(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch)
    direct_vm.sender = direct_alice
    c.confirm_dispatch(ALLOCATION_ID, 18)
    direct_vm.sender = direct_bob
    c.confirm_receipt(ALLOCATION_ID, 16)
    rec = json.loads(c.get_handoff(ALLOCATION_ID))
    assert rec["status"] == "DISPUTED"
    assert rec["driver_report"] == 18 and rec["kitchen_report"] == 16
    assert rec["received"] is None and rec["missing"] is None


def test_wrong_role_and_second_confirmation_rejected(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, monkeypatch):
    c = setup_ledger(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Wrong signer"):
        c.confirm_dispatch(ALLOCATION_ID, 16)
    direct_vm.sender = direct_alice
    c.confirm_dispatch(ALLOCATION_ID, 16)
    with direct_vm.expect_revert("already confirmed"):
        c.confirm_dispatch(ALLOCATION_ID, 16)
    direct_vm.sender = direct_bob
    c.confirm_receipt(ALLOCATION_ID, 16)
    with direct_vm.expect_revert("closed"):
        c.confirm_receipt(ALLOCATION_ID, 16)


def test_cannot_overreport(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch):
    c = setup_ledger(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("exceeds planned"):
        c.confirm_dispatch(ALLOCATION_ID, 19)


def test_full_handoff(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch):
    c = setup_ledger(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch)
    direct_vm.sender = direct_alice
    c.confirm_dispatch(ALLOCATION_ID, 18)
    direct_vm.sender = direct_bob
    c.confirm_receipt(ALLOCATION_ID, 18)
    rec = json.loads(c.get_handoff(ALLOCATION_ID))
    assert rec["status"] == "COMPLETE"
    assert rec["received"] == 18 and rec["missing"] == 0
