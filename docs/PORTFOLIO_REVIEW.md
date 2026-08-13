# Portfolio Review Guide

This guide is for reviewers who want to quickly understand what this repo demonstrates and where to inspect the implementation.

## What This Demonstrates

- Workflow-as-code discipline: n8n workflows authored as TypeScript, not clicked together and left in a database.
- Real cross-service integration: `escalation-autopsy` makes a genuine MCP tool call to a separate, independently-deployed service ([aws-bedrock-ops-agent](https://github.com/h-vance/aws-bedrock-ops-agent)), including hand-rolling the streamable-HTTP JSON-RPC protocol in a Code node since n8n community edition has no native MCP client.
- Real branching/decision logic: `web3-infra-self-healing` routes on service type, computes a severity score from (simulated) diagnostics, and gates high-severity cases behind a human-in-the-loop approval step, not a linear happy-path demo.
- Real, live remediation: `container-incident-responder` actually restarts a real Docker container (raw Docker Engine API over the mounted socket) and actually runs `kubectl rollout restart` against a live local kind cluster, inspecting state before and after so the evidence packet can't lie about whether the fix worked.
- Real third-party tool integration: `postman-evidence-audit` runs the actual Postman collection from a separate repo ([postman-tse-incident-lab](https://github.com/h-vance/postman-tse-incident-lab)) via Newman, against that repo's real API, not a hand-authored stand-in for what a Postman run would look like.
- All four workflows were pushed into a real running n8n instance and executed end to end before being committed. Real bugs were found and fixed this way, not left in: a `Set` node silently dropping upstream fields in `escalation-autopsy`, and a collection-level test script variable collision in `postman-tse-incident-lab` itself (fixed upstream, not worked around).

## Best Review Path

1. Read `docs/ARCHITECTURE.md` for the build/verify/export pipeline and the real-integration section.
2. Read `workflows/escalation-autopsy.workflow.ts`. Note the `Call MCP Triage` Code node's JSON-RPC + SSE parsing, and the `includeOtherFields: true` on `Format Slack Message` (the fix for the bug found during verification).
3. Read `workflows/web3-infra-self-healing.workflow.ts`. Note the Switch node's routing rules and the `Senior TSE Approval Gate` IF node.
4. Read `workflows/postman-evidence-audit.workflow.ts`. Note the Code node shelling out to Newman and parsing its JSON reporter output into a real per-scenario pass/fail summary.
5. Read `workflows/container-incident-responder.workflow.ts`. Note the Docker leg's raw `http` calls over the socket path and the Kubernetes leg's `execSync('kubectl ...')`, plus `Dockerfile.n8n` and `docker-compose.yml` for what it took to make that container capable of either.
6. Run the quickstart in the README, `npm run verify`, and inspect an execution in the n8n UI. See `docs/evidence/` for captured real executions of every workflow.

## Engineering Tradeoffs

- Slack posts and the GitHub commit in `escalation-autopsy` are mocked (a `Set` node records what would have been sent) rather than actually posting to a real Slack workspace or committing to `incident-postmortems` during automated verification. That's deliberate, to keep repeated test runs from spamming a real channel or polluting a real repo's commit history. Wiring in real credentials is a few-line change: replace the mock `Set` node with an `HTTP Request` (Slack incoming webhook) or `GitHub` node. `postman-evidence-audit` and `container-incident-responder` follow the same mocked-Slack pattern.
- `web3-infra-self-healing`'s diagnostics are simulated and deterministic (derived from the incident ID) rather than calling real blockchain RPC endpoints or a real Kubernetes API. That's appropriate for a portfolio demo that shouldn't need production infrastructure access to run, and it means the routing/severity/approval logic is exercised identically every time for a given incident ID, which made it possible to test all three severity tiers and both routing paths deterministically. `container-incident-responder` makes the opposite tradeoff for its Kubernetes leg: it's genuinely live, which cost real setup work (a custom image, a shared Docker network, a regenerated kubeconfig) documented in `docs/ARCHITECTURE.md`.
- The local dev n8n instance runs community edition: no Projects/multi-user features, no native MCP client node. All four workflows are designed to work within those constraints rather than assuming enterprise features.
- Mounting the host Docker socket into the n8n container is a real security tradeoff (root-equivalent daemon access), accepted here because it's a local single-user demo lab, not something to do on a shared instance without much tighter scoping. Called out explicitly in `docs/ARCHITECTURE.md`.

## Review Commands

```bash
docker compose up -d --build
npm install
npx n8nac convert workflows/escalation-autopsy.workflow.ts --format json
npm run verify
```

## Suggested Discussion Topics

- How to swap the mocked Slack/GitHub legs for real credentials without changing the workflow's control flow.
- How this generalizes: what would it take to add a third workflow that reuses `escalation-autopsy`'s MCP-calling pattern against a different tool?
- Where the line is between "simulated for a safe portfolio demo" and "would need to change before running against real infrastructure". See Known Limits in `docs/ARCHITECTURE.md`.
