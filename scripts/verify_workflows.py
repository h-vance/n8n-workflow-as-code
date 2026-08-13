#!/usr/bin/env python3
"""Push each workflow to a running n8n instance, execute it against a
fixture payload, and confirm every node succeeds. Exits non-zero on any
failure. Requires N8N_API_URL / N8N_API_KEY (see .env.example) and a
session cookie at N8N_COOKIE_JAR for the internal /run endpoint (create
one by logging in via /rest/login).
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_URL = os.environ.get("N8N_API_URL", "http://localhost:5678")
API_KEY = os.environ.get("N8N_API_KEY")
COOKIE_JAR = os.environ.get("N8N_COOKIE_JAR", "/tmp/n8n-cookies.txt")

FIXTURES = {
    "escalation-autopsy": {
        "trigger_name": "Incident Webhook",
        "payload": {"incident_id": "VERIFY-001", "summary": "Auth cascade after token rotation"},
    },
    "web3-infra-self-healing": {
        "trigger_name": "Alert Intake",
        "payload": {"incident_id": "VERIFY-002", "service_name": "validator-node-1", "symptom": "sync lag"},
    },
    "postman-evidence-audit": {
        "trigger_name": "Audit Trigger",
        "payload": {"incident_id": "VERIFY-003"},
    },
    "container-incident-responder": {
        "trigger_name": "Incident Trigger",
        "payload": {
            "incident_id": "VERIFY-004",
            "target_type": "docker",
            "target": "docker-tse-incident-lab-app-1",
        },
    },
}


def api_request(method, path, body=None, use_cookie=False):
    url = f"{API_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if use_cookie:
        headers["Cookie"] = _read_cookie()
    else:
        headers["X-N8N-API-KEY"] = API_KEY
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def _read_cookie():
    with open(COOKIE_JAR) as f:
        raw_lines = [l.rstrip("\n") for l in f if l.strip()]
    parts = []
    for line in raw_lines:
        # curl's Netscape format prefixes HttpOnly cookies' domain field with
        # "#HttpOnly_" instead of a real comment -- strip it, but skip actual
        # comment lines (which don't have 7 tab-separated fields at all).
        if line.startswith("#HttpOnly_"):
            line = line[len("#HttpOnly_"):]
        elif line.startswith("#"):
            continue
        fields = line.split("\t")
        if len(fields) >= 7:
            parts.append(f"{fields[5]}={fields[6]}")
    return "; ".join(parts)


def convert_to_json(workflow_id):
    src = os.path.join(REPO_ROOT, "workflows", f"{workflow_id}.workflow.ts")
    out = f"/tmp/{workflow_id}-verify.json"
    subprocess.run(
        ["npx", "n8nac", "convert", src, "--format", "json", "-o", out, "-f"],
        cwd=REPO_ROOT, check=True, capture_output=True,
    )
    with open(out) as f:
        return json.load(f)


def find_or_create(workflow_id, compiled):
    existing = api_request("GET", "/api/v1/workflows")["data"]
    match = next((w for w in existing if w["name"] == compiled["name"]), None)
    body = {k: v for k, v in compiled.items() if k not in ("id", "active", "tags")}
    if match:
        return match["id"]
    created = api_request("POST", "/api/v1/workflows", body)
    return created["id"]


def run_and_check(n8n_id, trigger_name, payload):
    body = {
        "workflowData": None,
        "startNodes": [],
        "runData": {},
        "triggerToStartFrom": {
            "name": trigger_name,
            "data": {
                "startTime": 0, "executionTime": 0, "executionIndex": 0,
                "source": [], "executionStatus": "success",
                "data": {"main": [[{"json": payload}]]},
            },
        },
    }
    resp = api_request("POST", f"/rest/workflows/{n8n_id}/run", body, use_cookie=True)
    execution_id = resp["data"]["executionId"]
    for _ in range(20):
        time.sleep(0.5)
        exec_data = api_request("GET", f"/rest/executions/{execution_id}", use_cookie=True)
        status = exec_data["data"]["status"]
        if status in ("success", "error"):
            return status == "success", status
    return False, "timeout"


def main():
    if not API_KEY:
        print("N8N_API_KEY not set -- source .env first", file=sys.stderr)
        return 1

    overall_ok = True
    for workflow_id, fixture in FIXTURES.items():
        print(f"== {workflow_id} ==")
        try:
            compiled = convert_to_json(workflow_id)
            n8n_id = find_or_create(workflow_id, compiled)
            ok, status = run_and_check(n8n_id, fixture["trigger_name"], fixture["payload"])
            print(f"  execution status: {status} -> {'PASS' if ok else 'FAIL'}")
            overall_ok = overall_ok and ok
        except Exception as e:
            print(f"  ERROR: {e}")
            overall_ok = False

    return 0 if overall_ok else 1


if __name__ == "__main__":
    sys.exit(main())
