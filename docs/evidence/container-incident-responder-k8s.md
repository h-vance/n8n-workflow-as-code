# Execution evidence: Container Incident Responder

Captured: 2026-08-13T18:21:11.088149+00:00

## Trigger

`POST /webhook/container-incident-responder` (real HTTP call, not the manual-run API)

```json
{
  "incident_id": "EVID-008",
  "target_type": "kubernetes",
  "target": "customer-api",
  "namespace": "tse-training"
}
```

## HTTP response

Status: 200

```json
{
  "status": "incident-response-complete",
  "incident_id": "EVID-008",
  "target_type": "kubernetes",
  "target": "customer-api",
  "remediation": {
    "action": "kubectl rollout restart",
    "rollout_output": "Waiting for deployment \"customer-api\" rollout to finish: 1 old replicas are pending termination...\nWaiting for deployment \"customer-api\" rollout to finish: 1 old replicas are pending termination...\ndeployment \"customer-api\" successfully rolled out"
  },
  "before": [
    {
      "name": "customer-api-587fb5d68-gdsqx",
      "ready": true,
      "restart_count": 0
    }
  ],
  "after": [
    {
      "name": "customer-api-587fb5d68-gdsqx",
      "ready": true,
      "restart_count": 0
    },
    {
      "name": "customer-api-7fbc4f8bfb-r8sgb",
      "ready": true,
      "restart_count": 0
    }
  ],
  "remediated": false,
  "slack": {
    "mocked": true,
    "would_post_channel": "#infra-incidents",
    "would_post_text": ":wrench: *Container Incident Response: EVID-008*\n*Target:* customer-api (kubernetes)\n*Action:* kubectl rollout restart\n*Before:* [{\"name\":\"customer-api-587fb5d68-gdsqx\",\"ready\":true,\"restart_count\":0}]\n*After:* [{\"name\":\"customer-api-587fb5d68-gdsqx\",\"ready\":true,\"restart_count\":0},{\"name\":\"customer-api-7fbc4f8bfb-r8sgb\",\"ready\":true,\"restart_count\":0}]\n*Remediated:* false"
  }
}
```

## n8n execution record

```json
{
  "executionId": "19",
  "workflowId": "6X6ntQhMFsOUbO9c",
  "workflowName": "Container Incident Responder",
  "status": "success",
  "mode": "webhook",
  "startedAt": "2026-08-13T18:21:09.503Z",
  "stoppedAt": "2026-08-13T18:21:10.052Z"
}
```
