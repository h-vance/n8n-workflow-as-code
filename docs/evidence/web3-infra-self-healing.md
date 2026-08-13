# Execution evidence: Web3 Infra Self-Healing Engine

Captured: 2026-08-13T18:01:52.544141+00:00

## Trigger

`POST /webhook/web3-infra-self-healing` (real HTTP call, not the manual-run API)

```json
{
  "incident_id": "EVID-002",
  "service_name": "validator-node-1",
  "symptom": "sync lag"
}
```

## HTTP response

Status: 200

```json
{
  "mocked": true,
  "would_post_jira_slack": "*EVID-002* (validator-node-1)\nSeverity: medium\nApproval: auto-approved\nRemediation: RPC resync triggered, peer table refreshed\nStatus: completed"
}
```

## n8n execution record

```json
{
  "executionId": "12",
  "workflowId": "5HhcIUu6IwcObJbP",
  "workflowName": "Web3 Infra Self-Healing Engine",
  "status": "success",
  "mode": "webhook",
  "startedAt": "2026-08-13T18:01:51.476Z",
  "stoppedAt": "2026-08-13T18:01:51.505Z"
}
```
