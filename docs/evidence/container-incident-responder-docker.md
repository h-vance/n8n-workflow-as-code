# Execution evidence: Container Incident Responder

Captured: 2026-08-13T18:20:53.024505+00:00

## Trigger

`POST /webhook/container-incident-responder` (real HTTP call, not the manual-run API)

```json
{
  "incident_id": "EVID-007",
  "target_type": "docker",
  "target": "docker-tse-incident-lab-app-1"
}
```

## HTTP response

Status: 200

```json
{
  "status": "incident-response-complete",
  "incident_id": "EVID-007",
  "target_type": "docker",
  "target": "docker-tse-incident-lab-app-1",
  "remediation": {
    "action": "container restart",
    "http_status": 204
  },
  "before": {
    "status": "running",
    "health": "healthy",
    "pid": 362000,
    "started_at": "2026-08-13T18:20:23.719626629Z"
  },
  "after": {
    "status": "running",
    "health": "healthy",
    "pid": 362938,
    "started_at": "2026-08-13T18:20:47.913581876Z"
  },
  "remediated": true,
  "slack": {
    "mocked": true,
    "would_post_channel": "#infra-incidents",
    "would_post_text": ":wrench: *Container Incident Response: EVID-007*\n*Target:* docker-tse-incident-lab-app-1 (docker)\n*Action:* container restart\n*Before:* running, health=healthy, pid=362000\n*After:* running, health=healthy, pid=362938\n*Remediated:* true"
  }
}
```

## n8n execution record

```json
{
  "executionId": "18",
  "workflowId": "6X6ntQhMFsOUbO9c",
  "workflowName": "Container Incident Responder",
  "status": "success",
  "mode": "webhook",
  "startedAt": "2026-08-13T18:20:45.680Z",
  "stoppedAt": "2026-08-13T18:20:51.989Z"
}
```
