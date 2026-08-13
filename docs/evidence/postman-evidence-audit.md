# Execution evidence: Postman Evidence Audit

Captured: 2026-08-13T18:15:43.658129+00:00

## Trigger

`POST /webhook/postman-evidence-audit` (real HTTP call, not the manual-run API)

```json
{
  "incident_id": "EVID-003"
}
```

## HTTP response

Status: 200

```json
{
  "status": "audit-complete",
  "all_passed": true,
  "incident_id": "EVID-003",
  "stats": {
    "total": 45,
    "pending": 0,
    "failed": 0
  },
  "scenarios": [
    {
      "name": "Failure \u2014 Revoked key returns 401",
      "status_code": 401,
      "assertions_passed": 6,
      "assertions_failed": 0,
      "failed_assertions": []
    },
    {
      "name": "Fix \u2014 Active key returns 202",
      "status_code": 202,
      "assertions_passed": 6,
      "assertions_failed": 0,
      "failed_assertions": []
    },
    {
      "name": "Failure \u2014 Viewer token returns 403",
      "status_code": 403,
      "assertions_passed": 6,
      "assertions_failed": 0,
      "failed_assertions": []
    },
    {
      "name": "Fix \u2014 Admin token returns 200",
      "status_code": 200,
      "assertions_passed": 6,
      "assertions_failed": 0,
      "failed_assertions": []
    },
    {
      "name": "Failure \u2014 Singular path returns 404",
      "status_code": 404,
      "assertions_passed": 5,
      "assertions_failed": 0,
      "failed_assertions": []
    },
    {
      "name": "Fix \u2014 Documented path returns 200",
      "status_code": 200,
      "assertions_passed": 5,
      "assertions_failed": 0,
      "failed_assertions": []
    },
    {
      "name": "Failure \u2014 Fourth attempt returns 429",
      "status_code": 429,
      "assertions_passed": 6,
      "assertions_failed": 0,
      "failed_assertions": []
    },
    {
      "name": "Fix \u2014 Allowed attempt returns 200",
      "status_code": 200,
      "assertions_passed": 5,
      "assertions_failed": 0,
      "failed_assertions": []
    }
  ],
  "slack": {
    "mocked": true,
    "would_post_channel": "#api-support",
    "would_post_text": ":white_check_mark: *Postman Evidence Audit: EVID-003*\n*Assertions:* 45 total, 0 failed\n  :white_check_mark: Failure \u2014 Revoked key returns 401 -- HTTP 401\n  :white_check_mark: Fix \u2014 Active key returns 202 -- HTTP 202\n  :white_check_mark: Failure \u2014 Viewer token returns 403 -- HTTP 403\n  :white_check_mark: Fix \u2014 Admin token returns 200 -- HTTP 200\n  :white_check_mark: Failure \u2014 Singular path returns 404 -- HTTP 404\n  :white_check_mark: Fix \u2014 Documented path returns 200 -- HTTP 200\n  :white_check_mark: Failure \u2014 Fourth attempt returns 429 -- HTTP 429\n  :white_check_mark: Fix \u2014 Allowed attempt returns 200 -- HTTP 200"
  }
}
```

## n8n execution record

```json
{
  "executionId": "15",
  "workflowId": "ydW7aNM6aN1dYxzU",
  "workflowName": "Postman Evidence Audit",
  "status": "success",
  "mode": "webhook",
  "startedAt": "2026-08-13T18:15:38.985Z",
  "stoppedAt": "2026-08-13T18:15:42.568Z"
}
```
