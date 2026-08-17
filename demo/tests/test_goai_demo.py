from fastapi.testclient import TestClient

from relationship_candlestick.server import app
from start import choose_port


client = TestClient(app)


def test_startup_falls_back_when_requested_port_is_occupied(monkeypatch):
    monkeypatch.setattr(
        "start.port_is_available", lambda _host, port: port == 7700
    )
    assert choose_port("127.0.0.1", 7000) == 7700


def test_judge_demo_runs_without_api_key_or_upload():
    response = client.post("/api/demo")
    assert response.status_code == 200
    job = response.json()
    assert job["id"] == "goai-demo-v1"
    assert job["status"] == "done"
    assert "1d" in job["timeframes"]
    assert "api_key" not in job["params"]

    bars = client.get(f"/api/jobs/{job['id']}/ohlc?tf=1d")
    assert bars.status_code == 200
    assert len(bars.json()) >= 8


def test_decision_is_traceable_and_requires_human_confirmation():
    client.post("/api/demo")
    brief = client.get("/api/jobs/goai-demo-v1/brief").json()
    assert brief["facts"]
    assert brief["inferences"]
    assert brief["unknowns"]

    for goal in ("推进", "确认", "修复", "退出"):
        response = client.post(
            "/api/jobs/goai-demo-v1/decision", json={"goal": goal}
        )
        assert response.status_code == 200
        plan = response.json()
        assert plan["goal"] == goal
        assert plan["human_confirmation_required"] is True
        assert plan["message"]
        assert plan["window"]
        assert plan["stop"]
        assert len(plan["trace"]) >= 4
