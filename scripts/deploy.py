#!/usr/bin/env python3
"""Compile a .workflow.ts and push it to the running n8n instance in one
step: convert -> find existing workflow by name -> PUT (update) or POST
(create) -> re-activate if it was active before. Requires N8N_API_URL /
N8N_API_KEY (source .env first).

Usage: python3 scripts/deploy.py <workflow-id> [<workflow-id> ...]
       python3 scripts/deploy.py --all
"""
import json
import os
import subprocess
import sys
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_URL = os.environ.get("N8N_API_URL", "http://localhost:5678")
API_KEY = os.environ.get("N8N_API_KEY")
OWNER_EMAIL = os.environ.get("N8N_OWNER_EMAIL")
OWNER_PASSWORD = os.environ.get("N8N_OWNER_PASSWORD")
STRIP_KEYS = (
    "id", "active", "tags", "versionId", "createdAt", "updatedAt", "shared",
    "triggerCount", "meta", "staticData", "pinData", "nodeGroups",
    "activeVersionId", "activeVersion",
)
ALL_WORKFLOWS = ["escalation-autopsy", "web3-infra-self-healing"]


def api(method, path, body=None):
    req = urllib.request.Request(
        f"{API_URL}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "X-N8N-API-KEY": API_KEY},
        method=method,
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


_session_cookie = None


def _login():
    global _session_cookie
    if _session_cookie or not (OWNER_EMAIL and OWNER_PASSWORD):
        return _session_cookie
    req = urllib.request.Request(
        f"{API_URL}/rest/login",
        data=json.dumps({"emailOrLdapLoginId": OWNER_EMAIL, "password": OWNER_PASSWORD}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        _session_cookie = resp.headers.get("Set-Cookie", "").split(";")[0]
    return _session_cookie


def activate(n8n_id):
    """POST /rest/workflows/{id}/activate -- the public /api/v1 has no
    activation endpoint that accepts the required versionId body, so this
    goes through the internal REST API with a fresh owner session."""
    cookie = _login()
    if not cookie:
        print("  N8N_OWNER_EMAIL/PASSWORD not set -- skipping activation")
        return False
    current = api("GET", f"/api/v1/workflows/{n8n_id}")
    req = urllib.request.Request(
        f"{API_URL}/rest/workflows/{n8n_id}/activate",
        data=json.dumps({"versionId": current["versionId"]}).encode(),
        headers={"Content-Type": "application/json", "Cookie": cookie},
        method="POST",
    )
    urllib.request.urlopen(req).read()
    return True


def deploy(workflow_id):
    src = os.path.join(REPO_ROOT, "workflows", f"{workflow_id}.workflow.ts")
    out = f"/tmp/{workflow_id}-deploy.json"
    subprocess.run(
        ["npx", "n8nac", "convert", src, "--format", "json", "-o", out, "-f"],
        cwd=REPO_ROOT, check=True, capture_output=True,
    )
    with open(out) as f:
        compiled = json.load(f)

    existing = api("GET", "/api/v1/workflows")["data"]
    match = next((w for w in existing if w["name"] == compiled["name"]), None)
    body = {k: v for k, v in compiled.items() if k not in STRIP_KEYS}

    if match:
        n8n_id = match["id"]
        was_active = match["active"]
        api("PUT", f"/api/v1/workflows/{n8n_id}", body)
        print(f"  updated {workflow_id} -> {n8n_id}")
    else:
        created = api("POST", "/api/v1/workflows", body)
        n8n_id = created["id"]
        was_active = False
        print(f"  created {workflow_id} -> {n8n_id}")

    if was_active:
        if activate(n8n_id):
            print(f"  re-activated {workflow_id}")

    return n8n_id


def main():
    args = sys.argv[1:]
    if not API_KEY:
        print("N8N_API_KEY not set -- source .env first", file=sys.stderr)
        return 1
    targets = ALL_WORKFLOWS if (not args or args == ["--all"]) else args
    for wf in targets:
        print(f"== {wf} ==")
        deploy(wf)
    return 0


if __name__ == "__main__":
    sys.exit(main())
