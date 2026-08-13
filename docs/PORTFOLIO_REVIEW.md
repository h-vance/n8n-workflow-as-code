# Portfolio Review Guide

This guide is for reviewers who want to quickly understand what this repo demonstrates and where to inspect the implementation.

## What This Demonstrates

- Workflow-as-code discipline: n8n workflows authored as TypeScript, not clicked together and left in a database.
- Real cross-service integration: `escalation-autopsy` makes a genuine MCP tool call to a separate, independently-deployed service ([aws-bedrock-ops-agent](https://github.com/h-vance/aws-bedrock-ops-agent)), including hand-rolling the streamable-HTTP JSON-RPC protocol in a Code node since n8n community edition has no native MCP client.
- Real branching/decision logic: `web3-infra-self-healing` routes on service type, computes a severity score from (simulated) diagnostics, and gates high-severity cases behind a human-in-the-loop approval step — not a linear happy-path demo.
- Both workflows were pushed into a real running n8n instance and executed end to end before being committed; a real bug (a `Set` node silently dropping upstream fields) was found and fixed this way, not left in.

## Best Review Path

1. Read `docs/ARCHITECTURE.md` for the build/verify/export pipeline.
2. Read `workflows/escalation-autopsy.workflow.ts` — note the `Call MCP Triage` Code node's JSON-RPC + SSE parsing, and the `includeOtherFields: true` on `Format Slack Message` (the fix for the bug found during verification).
3. Read `workflows/web3-infra-self-healing.workflow.ts` — note the Switch node's routing rules and the `Senior TSE Approval Gate` IF node.
4. Run the quickstart in the README, `npm run verify`, and inspect an execution in the n8n UI.

## Engineering Tradeoffs

- Slack posts and the GitHub commit in `escalation-autopsy` are mocked (a `Set` node records what would have been sent) rather than actually posting to a real Slack workspace or committing to `incident-postmortems` during automated verification — deliberate, to keep repeated test runs from spamming a real channel or polluting a real repo's commit history. Wiring in real credentials is a few-line change: replace the mock `Set` node with an `HTTP Request` (Slack incoming webhook) or `GitHub` node.
- `web3-infra-self-healing`'s diagnostics are simulated and deterministic (derived from the incident ID) rather than calling real blockchain RPC endpoints or a real Kubernetes API — appropriate for a portfolio demo that shouldn't need production infrastructure access to run, and it means the routing/severity/approval logic is exercised identically every time for a given incident ID, which made it possible to test all three severity tiers and both routing paths deterministically.
- The local dev n8n instance runs community edition — no Projects/multi-user features, no native MCP client node. Both workflows are designed to work within those constraints rather than assuming enterprise features.

## Review Commands

```bash
docker compose up -d
npm install
npx n8nac convert workflows/escalation-autopsy.workflow.ts --format json
npm run verify
```

## Suggested Discussion Topics

- How to swap the mocked Slack/GitHub legs for real credentials without changing the workflow's control flow.
- How this generalizes: what would it take to add a third workflow that reuses `escalation-autopsy`'s MCP-calling pattern against a different tool?
- Where the line is between "simulated for a safe portfolio demo" and "would need to change before running against real infrastructure" — see Known Limits in `docs/ARCHITECTURE.md`.
