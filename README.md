# n8n Workflow as Code

[![CI](https://github.com/h-vance/n8n-workflow-as-code/actions/workflows/ci.yml/badge.svg)](https://github.com/h-vance/n8n-workflow-as-code/actions/workflows/ci.yml)
[![n8n](https://www.shieldcn.dev/badge/n8n-000000.svg?variant=default&logo=n8n&logoColor=FFFFFF&size=xs)](https://n8n.io)
[![TypeScript](https://www.shieldcn.dev/badge/TypeScript-000000.svg?variant=default&logo=typescript&logoColor=FFFFFF&size=xs)](https://www.typescriptlang.org)
[![Docker](https://www.shieldcn.dev/badge/Docker-000000.svg?variant=default&logo=Docker&logoColor=FFFFFF&size=xs)](https://www.docker.com)

| Workflow | What it demonstrates |
|----------|----------------------|
| [`escalation-autopsy.workflow.ts`](workflows/escalation-autopsy.workflow.ts) | Incident webhook → live call to [aws-bedrock-ops-agent](https://github.com/h-vance/aws-bedrock-ops-agent)'s MCP tool (real JSON-RPC over streamable-HTTP, hand-rolled in a Code node since n8n community edition has no MCP client node) → Slack summary → postmortem draft for [incident-postmortems](https://github.com/h-vance/incident-postmortems) |
| [`web3-infra-self-healing.workflow.ts`](workflows/web3-infra-self-healing.workflow.ts) | Alert routing by service type (blockchain protocol diagnostics vs. infra/K8s diagnostics), severity scoring, a human-in-the-loop Senior TSE Approval Gate for high-severity cases, simulated self-healing, and an evidence packet |
| [`postman-evidence-audit.workflow.ts`](workflows/postman-evidence-audit.workflow.ts) | Audit webhook → live `npx newman run` of the real [postman-tse-incident-lab](https://github.com/h-vance/postman-tse-incident-lab) collection (fetched from GitHub, run against the actual lab API), parses genuine pass/fail assertions, formats an evidence summary |
| [`container-incident-responder.workflow.ts`](workflows/container-incident-responder.workflow.ts) | Alert routing by target type into two real remediation paths: Docker (raw HTTP over the mounted host Docker socket, restarts a real container in [docker-tse-incident-lab](https://github.com/h-vance/docker-tse-incident-lab)) or Kubernetes (`kubectl rollout restart` against a live local kind cluster). Both inspect before/after so the evidence packet proves the remediation actually happened |

See [docs/PORTFOLIO_REVIEW.md](docs/PORTFOLIO_REVIEW.md) for what's real vs. mocked in each.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): system boundaries, the build/verify/export pipeline, known limits
- [Portfolio Review Guide](docs/PORTFOLIO_REVIEW.md): what this demonstrates, review path, engineering tradeoffs

## Quickstart

```bash
# Bring up a local n8n instance (Postgres + Redis + n8n + worker, queue mode)
docker compose up -d

# Install the n8n-as-code CLI
npm install

# Complete first-run owner setup (see .env.example), then save the API key
# for the CLI:
cp .env.example .env   # fill in real values
node scripts/set-api-key.mjs

# Push a workflow into the running instance
npx n8nac push --workflowsid escalation-autopsy

# Or just compile TS -> JSON without touching a live instance
npx n8nac convert workflows/escalation-autopsy.workflow.ts --format json
```

Open n8n at `http://localhost:5678`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `N8N_OWNER_EMAIL` / `N8N_OWNER_PASSWORD` / `N8N_OWNER_FIRST_NAME` / `N8N_OWNER_LAST_NAME` | Local-only owner account for the dev n8n instance, not a real third-party account |
| `N8N_API_URL` | n8n instance URL (default `http://localhost:5678`) |
| `N8N_API_KEY` | Personal API key, created via the owner account, used by the n8nac CLI |

## Development

```bash
# Verify the compiled artifacts still match their TypeScript source.
# This is what CI runs; it needs no live n8n instance.
python3 scripts/check_compiled_drift.py

# Regenerate workflows/compiled/*.json after editing a .workflow.ts
python3 scripts/check_compiled_drift.py --fix

# Full verification: push + execute all four workflows against fixture
# payloads. Requires a running instance, so this one is local only.
npm run verify
```

The drift check exists because the TypeScript is the source of truth while the
JSON is the importable artifact, and the easy mistake is editing one without
regenerating the other. Node ids are excluded from the comparison since
`n8nac` mints fresh UUIDs on every conversion; n8n wires connections by node
name, so the graph is still fully compared.

## Related

- [aws-bedrock-ops-agent](https://github.com/h-vance/aws-bedrock-ops-agent): the MCP server `escalation-autopsy` calls
- [incident-postmortems](https://github.com/h-vance/incident-postmortems): where `escalation-autopsy` drafts postmortems for
- [postman-tse-incident-lab](https://github.com/h-vance/postman-tse-incident-lab): the collection `postman-evidence-audit` runs
- [docker-tse-incident-lab](https://github.com/h-vance/docker-tse-incident-lab): the container `container-incident-responder`'s Docker leg restarts
- `n8n-interview-prep`: a local (not-yet-public) self-hosted n8n Docker stack this repo's `docker-compose.yml` is adapted from

## License

MIT
