"""GenLayer Test direct-mode tests against the actual RescueMatcher contract.

This runs in the GenLayer Python testing harness, not against a live validator set.
It checks wallet roles, validation, evidence and immutable status transitions.
"""
import json

def test_independent_receiver_cannot_be_driver(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/RescueMatcher.py")
    from genlayer import Address  # SDK added by direct-mode deployment fixture
    direct_vm.sender = direct_alice
    contract.open_case("case-a", "18 vegetable crates", 18, "16:40", "17:30", Address(direct_bob).as_hex)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("independent"):
        contract.submit_offer("case-a", "Fake Kitchen", "We can receive up to 18 crates.", 18, "17:15", 2)


def test_donor_cannot_create_duplicate_case(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/RescueMatcher.py")
    from genlayer import Address
    direct_vm.sender = direct_alice
    args = ("rescue-001", "vegetable crates", 18, "16:40", "17:30", Address(direct_bob).as_hex)
    contract.open_case(*args)
    with direct_vm.expect_revert("already used"):
        contract.open_case(*args)


def test_no_mutation_after_seal(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/RescueMatcher.py")
    from genlayer import Address
    direct_vm.sender = direct_alice
    contract.open_case("case-sealed", "vegetables", 18, "16:40", "17:30", Address(direct_bob).as_hex)
    direct_vm.sender = direct_charlie
    contract.submit_offer("case-sealed", "Kitchen A", "After 17:00, one staff member can receive at most 6 crates.", 18, "17:05", 2)
    direct_vm.sender = direct_alice
    contract.seal_case("case-sealed")
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("already sealed"):
        contract.submit_offer("case-sealed", "Another kitchen", "We can receive up to 18 crates.", 18, "17:15", 7)
    assert json.loads(contract.get_case("case-sealed"))["sealed"] is True


def test_consensus_with_mocked_receiving_limits(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/RescueMatcher.py")
    from genlayer import Address
    direct_vm.sender = direct_alice
    contract.open_case("case-match", "vegetables", 18, "16:40", "17:30", Address(direct_bob).as_hex)
    note = "After 17:00, one staff member can receive at most 6 crates."
    direct_vm.sender = direct_charlie
    contract.submit_offer("case-match", "Kitchen A", note, 18, "17:05", 2)
    direct_vm.sender = direct_alice
    contract.seal_case("case-match")
    # One fake LLM interpretation and an independent mock validator judgment.
    # Not proof that real validators will agree.
    direct_vm.mock_llm(r"(?s).*NOMINAL CAPACITY:.*NOTE:.*After 17:00.*",
                       json.dumps({"capacity": 6, "from": "17:00",
                                   "until": "23:59", "evidence": note}))
    direct_vm.mock_llm(r"(?s).*Independently judge.*",
                       json.dumps({"valid": True}))
    contract.match_case("case-match")
    out = json.loads(contract.get_allocation("case-match:a1"))
    assert out["allocated_crates"] == 6
    assert out["unallocated_crates"] == 12
    assert out["kitchen_id"] == "Kitchen A"
    assert out["evaluations"][0]["evidence"] == note
    with direct_vm.expect_revert("sealed and not yet matched"):
        contract.match_case("case-match")


def test_two_kitchens_conservative_selection(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/RescueMatcher.py")
    from genlayer import Address
    direct_vm.sender = direct_alice
    contract.open_case("case-two", "vegetable crates", 18, "16:40", "17:30", Address(direct_bob).as_hex)
    note_a = "After 17:00, one staff member can receive at most 6 crates."
    note_b = "We can receive up to 18 crates until 17:30."
    direct_vm.sender = direct_charlie
    contract.submit_offer("case-two", "Kitchen A", note_a, 18, "17:05", 2)
    direct_vm.sender = Address("0x" + "d" * 40)
    contract.submit_offer("case-two", "Kitchen B", note_b, 18, "17:15", 7)
    direct_vm.sender = direct_alice
    contract.seal_case("case-two")
    direct_vm.mock_llm(r"(?s).*NOMINAL CAPACITY:.*NOTE:.*After 17:00.*",
                       json.dumps({"capacity": 6, "from": "17:00", "until": "23:59", "evidence": note_a}))
    direct_vm.mock_llm(r"(?s).*NOMINAL CAPACITY:.*NOTE:.*up to 18 crates until 17:30.*",
                       json.dumps({"capacity": 18, "from": "00:00", "until": "17:30", "evidence": note_b}))
    direct_vm.mock_llm(r"(?s).*Independently judge.*", '{"valid":true}')
    contract.match_case("case-two")
    data = json.loads(contract.get_allocation("case-two:a1"))
    assert data["kitchen_id"] == "Kitchen B"
    assert data["allocated_crates"] == 18
    assert data["unallocated_crates"] == 0
    assert data["version"] == 1
    assert data["evaluations"][0]["feasible_crates"] == 6


def test_b_late_leaves_twelve_unallocated(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/RescueMatcher.py")
    from genlayer import Address
    direct_vm.sender = direct_alice
    contract.open_case("case-late", "vegetable crates", 18, "16:40", "17:30", Address(direct_bob).as_hex)
    note_a = "After 17:00, one staff member can receive at most 6 crates."
    note_b = "We can receive up to 18 crates, but only from 17:45 onwards."
    direct_vm.sender = direct_charlie
    contract.submit_offer("case-late", "Kitchen A", note_a, 18, "17:05", 2)
    direct_vm.sender = Address("0x" + "d" * 40)
    contract.submit_offer("case-late", "Kitchen B", note_b, 18, "17:15", 7)
    direct_vm.sender = direct_alice
    contract.seal_case("case-late")
    direct_vm.mock_llm(r"(?s).*NOMINAL CAPACITY:.*NOTE:.*After 17:00.*",
                       json.dumps({"capacity": 6, "from": "17:00", "until": "23:59", "evidence": note_a}))
    direct_vm.mock_llm(r"(?s).*NOMINAL CAPACITY:.*NOTE:.*only from 17:45.*",
                       json.dumps({"capacity": 18, "from": "17:45", "until": "23:59", "evidence": note_b}))
    direct_vm.mock_llm(r"(?s).*Independently judge.*", '{"valid":true}')
    contract.match_case("case-late")
    data = json.loads(contract.get_allocation("case-late:a1"))
    assert data["kitchen_id"] == "Kitchen A"
    assert data["allocated_crates"] == 6
    assert data["unallocated_crates"] == 12
    assert data["evaluations"][1]["eligibility_reason"] == "OUTSIDE_RECEPTION_WINDOW"
