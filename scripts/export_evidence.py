#!/usr/bin/env python3
"""Trigger a workflow's webhook for real and record the resulting execution as evidence.

Usage:
    python3 scripts/export_evidence.py <workflow_id> <webhook_path> <payload.json> <output.md>
"""
import http.cookiejar
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone

BASE_URL = "http://localhost:5678"


def load_env():
    env = {}
    with open(".env") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v
    return env


def login(opener, env):
    body = json.dumps(
        {"emailOrLdapLoginId": env["N8N_OWNER_EMAIL"], "password": env["N8N_OWNER_PASSWORD"]}
    ).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/rest/login", data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with opener.open(req) as resp:
        if resp.status != 200:
            raise RuntimeError(f"login failed: {resp.status}")


def trigger_webhook(webhook_path, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/webhook/{webhook_path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read())


def find_execution(opener, workflow_id, after_iso):
    req = urllib.request.Request(
        f"{BASE_URL}/rest/executions?filter=" + urllib.request.quote(json.dumps({"workflowId": workflow_id}))
    )
    with opener.open(req) as resp:
        results = json.load(resp)["data"]["results"]
    for r in results:
        if r["startedAt"] >= after_iso:
            return r
    raise RuntimeError("no matching execution found after trigger time")


def main():
    workflow_id, webhook_path, payload_path, output_path = sys.argv[1:5]
    with open(payload_path) as f:
        payload = json.load(f)

    env = load_env()
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    login(opener, env)

    before = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    status_code, response_body = trigger_webhook(webhook_path, payload)
    time.sleep(1)
    execution = find_execution(opener, workflow_id, before)

    lines = [
        f"# Execution evidence: {execution['workflowName']}",
        "",
        f"Captured: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Trigger",
        "",
        f"`POST /webhook/{webhook_path}` (real HTTP call, not the manual-run API)",
        "",
        "```json",
        json.dumps(payload, indent=2),
        "```",
        "",
        "## HTTP response",
        "",
        f"Status: {status_code}",
        "",
        "```json",
        json.dumps(response_body, indent=2),
        "```",
        "",
        "## n8n execution record",
        "",
        "```json",
        json.dumps(
            {
                "executionId": execution["id"],
                "workflowId": execution["workflowId"],
                "workflowName": execution["workflowName"],
                "status": execution["status"],
                "mode": execution["mode"],
                "startedAt": execution["startedAt"],
                "stoppedAt": execution["stoppedAt"],
            },
            indent=2,
        ),
        "```",
        "",
    ]

    with open(output_path, "w") as f:
        f.write("\n".join(lines))

    print(f"status={execution['status']} executionId={execution['id']} -> {output_path}")


if __name__ == "__main__":
    main()
