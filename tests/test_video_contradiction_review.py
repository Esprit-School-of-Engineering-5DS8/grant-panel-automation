import json

import numpy as np

from services.api import main


class FakeGroqResponse:
    def __init__(self, content):
        self.content = content

    def raise_for_status(self):
        return None

    def json(self):
        return {"choices": [{"message": {"content": self.content}}]}


class FakeVideoCapture:
    def __init__(self, _path):
        self.position = 0

    def isOpened(self):
        return True

    def get(self, prop):
        if prop == main.cv2.CAP_PROP_FPS:
            return 10
        if prop == main.cv2.CAP_PROP_FRAME_COUNT:
            return 200
        return 0

    def set(self, _prop, timestamp_ms):
        self.position = timestamp_ms / 1000
        return True

    def read(self):
        return True, np.zeros((24, 32, 3), dtype=np.uint8)

    def release(self):
        return None


def _vision_check(**overrides):
    check = {
        "fact": "institution",
        "reference_source": "application_form",
        "reference_claim": "North University",
        "reference_quote": "North University",
        "video_source": "video_frame",
        "video_claim": "A document names South University.",
        "frame_index": 2,
        "frame_timestamp_seconds": 10.0,
        "frame_observation": "A clearly legible certificate reads South University.",
        "verdict": "contradiction",
        "reason": "The legible institution name conflicts with the application.",
        "confidence": 0.93,
    }
    return {**check, **overrides}


def _audio_check(**overrides):
    check = {
        "fact": "GPA",
        "reference_source": "parsed_cv",
        "reference_claim": "3.2",
        "reference_quote": "3.2",
        "video_source": "audio_transcript",
        "video_claim": "3.9",
        "evidence_quote": "My GPA is 3.9.",
        "verdict": "contradiction",
        "reason": "The spoken GPA differs from the CV.",
        "confidence": 0.98,
    }
    return {**check, **overrides}


def _prepare_vision_request(monkeypatch, checks):
    monkeypatch.setattr(main, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(main, "_candidate_video_path", lambda _candidate: "candidate.mp4")
    monkeypatch.setattr(main.cv2, "VideoCapture", FakeVideoCapture)
    captured = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured["request"] = kwargs
        return FakeGroqResponse(json.dumps({"checks": checks}))

    monkeypatch.setattr(main.requests, "post", fake_post)
    return captured


def test_video_review_uses_qwen_vision_and_flags_visible_contradiction(monkeypatch):
    captured = _prepare_vision_request(monkeypatch, [_vision_check()])

    result = main._video_evaluation_artifact(
        {
            "id": "candidate-1",
            "school": "North University",
            "gpa": 3.8,
            "cv_parsed": {"institutions": ["North University"], "extracted_gpa": 3.8},
            "transcript": "I study at North University.",
        }
    )

    request = captured["request"]["json"]
    images = [
        part
        for part in request["messages"][1]["content"]
        if part["type"] == "image_url"
    ]
    assert request["messages"][0]["role"] == "system"
    assert request["model"] == "qwen/qwen3.8-27b"
    assert len(images) == 3
    assert all(image["image_url"]["url"].startswith("data:image/jpeg;base64,") for image in images)
    assert result["status"] == "complete", result["flags"]
    assert result["contradiction_status"] == "contradiction_found"
    assert result["contradictions"][0]["frame_index"] == 2
    assert result["vision_analysis"]["used"] is True
    assert result["vision_analysis"]["model"] == "qwen/qwen3.8-27b"


def test_video_review_flags_spoken_contradiction_alongside_video_frames(monkeypatch):
    _prepare_vision_request(
        monkeypatch,
        [_audio_check(), _vision_check(verdict="consistent")],
    )

    result = main._video_evaluation_artifact(
        {
            "id": "candidate-audio",
            "gpa": 3.2,
            "school": "North University",
            "cv_parsed": {"extracted_gpa": 3.2, "institutions": ["North University"]},
            "transcript": "My GPA is 3.9.",
        }
    )

    assert result["contradiction_status"] == "contradiction_found"
    assert len(result["contradictions"]) == 1
    assert result["contradictions"][0]["video_source"] == "audio_transcript"


def test_video_frame_sampler_uses_three_evenly_spaced_frames(monkeypatch):
    monkeypatch.setattr(main.cv2, "VideoCapture", FakeVideoCapture)

    frames = main._extract_video_frames("candidate.mp4")

    assert [frame["frame_index"] for frame in frames] == [1, 2, 3]
    assert [frame["timestamp_seconds"] for frame in frames] == [2.0, 10.0, 18.0]
    assert all(frame["image_url"].startswith("data:image/jpeg;base64,") for frame in frames)


def test_video_review_requires_real_video_frames(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(main, "_candidate_video_path", lambda _candidate: None)

    result = main._video_evaluation_artifact(
        {"id": "candidate-2", "transcript": "My GPA is 3.9."}
    )

    assert result["status"] == "unavailable"
    assert result["contradiction_status"] == "not_checked"
    assert result["vision_analysis"]["used"] is False


def test_video_review_rejects_frame_not_sampled_from_video(monkeypatch):
    _prepare_vision_request(
        monkeypatch,
        [_vision_check(frame_index=8, frame_timestamp_seconds=45.0)],
    )

    result = main._video_evaluation_artifact(
        {
            "id": "candidate-3",
            "school": "North University",
            "cv_parsed": {"institutions": ["North University"]},
            "transcript": "I study at North University.",
        }
    )

    assert result["status"] == "failed"
    assert result["contradiction_status"] == "not_checked"
    assert any("unavailable video frame" in flag for flag in result["flags"]), result["flags"]


def test_video_review_reports_missing_cv_and_audio_as_inconclusive(monkeypatch):
    _prepare_vision_request(monkeypatch, [])

    result = main._video_evaluation_artifact(
        {"id": "candidate-4", "school": "North University"}
    )

    assert result["status"] == "complete"
    assert result["contradiction_status"] == "inconclusive"
    assert "parsed_cv" in result["missing_sources"]
    assert "audio_transcript" in result["missing_sources"]
    assert result["vision_analysis"]["used"] is True
