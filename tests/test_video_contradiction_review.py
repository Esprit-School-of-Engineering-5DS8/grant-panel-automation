from services.api import main


class FakeGroqResponse:
    def __init__(self, content):
        self.content = content

    def raise_for_status(self):
        return None

    def json(self):
        return {"choices": [{"message": {"content": self.content}}]}


def test_video_review_flags_transcript_contradiction_and_discloses_no_vision(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(
        main.requests,
        "post",
        lambda *args, **kwargs: FakeGroqResponse(
            '{"checks":[{"fact":"GPA","reference_source":"parsed_cv",'
            '"reference_claim":"3.2","reference_quote":"3.2","video_claim":"3.9",'
            '"evidence_quote":"My GPA is 3.9.","verdict":"contradiction",'
            '"reason":"The spoken GPA differs from the CV.","confidence":0.98}]}'
        ),
    )

    result = main._video_evaluation_artifact(
        {
            "id": "candidate-1",
            "gpa": 3.8,
            "cv_parsed": {"extracted_gpa": 3.2},
            "transcript": "My GPA is 3.9.",
        }
    )

    assert result["status"] == "complete"
    assert result["contradiction_status"] == "contradiction_found"
    assert result["contradictions"][0]["fact"] == "GPA"
    assert result["vision_analysis"]["used"] is False
    assert any("Vision model not used" in claim for claim in result["claims"])


def test_video_review_blocks_without_transcript(monkeypatch):
    def unexpected_request(*args, **kwargs):
        raise AssertionError("The model must not be called without a transcript.")

    monkeypatch.setattr(main, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(main.requests, "post", unexpected_request)

    result = main._video_evaluation_artifact({"id": "candidate-2"})

    assert result["status"] == "blocked"
    assert result["contradiction_status"] == "not_checked"
    assert result["vision_analysis"]["used"] is False


def test_video_review_rejects_quotes_missing_from_transcript(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(
        main.requests,
        "post",
        lambda *args, **kwargs: FakeGroqResponse(
            '{"checks":[{"fact":"GPA","reference_source":"parsed_cv",'
            '"reference_claim":"3.2","reference_quote":"3.2","video_claim":"3.9",'
            '"evidence_quote":"I have a 3.9 GPA.","verdict":"contradiction",'
            '"reason":"The spoken GPA differs from the CV.","confidence":0.98}]}'
        ),
    )

    result = main._video_evaluation_artifact(
        {"id": "candidate-3", "cv_parsed": {"extracted_gpa": 3.2}, "transcript": "I like research."}
    )

    assert result["status"] == "failed"
    assert result["contradiction_status"] == "not_checked"
    assert any("quote was not found" in flag for flag in result["flags"])
