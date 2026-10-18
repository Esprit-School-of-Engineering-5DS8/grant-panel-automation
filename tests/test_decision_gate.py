import json
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from services.api import main


def test_groq_json_completion_retries_rate_limited_requests(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(main.time, "sleep", lambda seconds: sleeps.append(seconds))
    sleeps = []
    limited = Mock(status_code=429, headers={"retry-after": "2"})
    successful = Mock(
        status_code=200,
        headers={},
        json=lambda: {"choices": [{"message": {"content": '{"ok": true}'}}]},
    )
    successful.raise_for_status.return_value = None
    post = Mock(side_effect=[limited, successful])
    monkeypatch.setattr(main.requests, "post", post)

    result = main._groq_json_completion([{"role": "user", "content": "return JSON"}])

    assert result == {"ok": True}
    assert post.call_count == 2
    assert sleeps == [2.25]


def test_chair_decision_requires_all_three_completed_reviews(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "PROPOSALS_DIR", str(tmp_path))
    candidate_path = tmp_path / "GATE-TEST.json"
    candidate_path.write_text(
        json.dumps({"id": "GATE-TEST", "audit": {"stages": {}, "results": {}}}),
        encoding="utf-8",
    )
    payload = main.CommitteeDecisionPayload(decision="FUND", score=4.2)

    with pytest.raises(HTTPException) as blocked:
        main.record_committee_decision("GATE-TEST", payload)
    assert blocked.value.status_code == 409

    candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
    candidate["audit"]["stages"] = {
        f"review_{name}": {"status": "complete"}
        for name in ("technical", "impact", "budget")
    }
    candidate["audit"]["results"] = {
        f"review_{name}": {"score": 4.0, "recommendation": "FUND"}
        for name in ("technical", "impact", "budget")
    }
    candidate_path.write_text(json.dumps(candidate), encoding="utf-8")

    saved = main.record_committee_decision("GATE-TEST", payload)
    assert saved["success"] is True
    assert saved["application_status"] == main.DECISION_TO_STATUS["FUND"]
    assert saved["committee_decision"]["decision"] == "FUND"


def test_candidate_audit_completes_rag_and_all_reviews_before_signoff(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "PROPOSALS_DIR", str(tmp_path))
    candidate_path = tmp_path / "FLOW-TEST.json"
    candidate_path.write_text(
        json.dumps({"id": "FLOW-TEST", "applicant_name": "Flow Test", "audit": {"status": "queued", "stages": {}, "timeline": [], "results": {}}}),
        encoding="utf-8",
    )
    monkeypatch.setattr(main, "cross_verify_evidence_llm", lambda payload: {"status": "complete", "checks": []})
    monkeypatch.setattr(main, "_run_rag_fact_check", lambda candidate: {"status": "complete", "checks": []})

    def evaluate(payload):
        return {
            "evaluator": payload.criterion,
            "score": 4.0,
            "recommendation": "FUND",
            "summary": f"{payload.criterion} review complete",
            "citations": [{"document": "Rules.pdf", "quote": "Verified rule excerpt"}],
        }

    monkeypatch.setattr(main, "evaluate_criterion", evaluate)
    main.run_candidate_audit("FLOW-TEST")

    audited = json.loads(candidate_path.read_text(encoding="utf-8"))
    assert audited["audit"]["status"] == "complete"
    assert audited["audit"]["stages"]["rag_fact_check"]["status"] == "complete"
    assert all(
        audited["audit"]["stages"][f"review_{name}"]["status"] == "complete"
        for name in ("technical", "impact", "budget")
    )
    signed_off = main.record_committee_decision(
        "FLOW-TEST",
        main.CommitteeDecisionPayload(decision="FUND", score=4.0),
    )
    assert signed_off["success"] is True


def test_stopping_audit_clears_transient_state_for_restart(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "PROPOSALS_DIR", str(tmp_path))
    candidate_path = tmp_path / "STOP-TEST.json"
    candidate_path.write_text(
        json.dumps({
            "id": "STOP-TEST",
            "audit": {
                "status": "running",
                "cancel_requested": False,
                "stages": {"review_technical": {"status": "complete"}},
                "results": {"review_technical": {"score": 4}},
                "timeline": [{"stage": "review_technical", "status": "complete"}],
            },
        }),
        encoding="utf-8",
    )

    stopped = main.stop_candidate_audit("STOP-TEST")
    assert stopped["status"] == "stopped"
    record = json.loads(candidate_path.read_text(encoding="utf-8"))
    assert record["audit"]["stages"] == {}
    assert record["audit"]["results"] == {}
    assert record["audit"]["cancel_requested"] is True

    queued = main.rerun_candidate_audit("STOP-TEST", main.BackgroundTasks())
    assert queued["status"] == "queued"
    restarted = json.loads(candidate_path.read_text(encoding="utf-8"))
    assert restarted["audit"]["cancel_requested"] is False
