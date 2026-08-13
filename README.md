# n8n Workflow as Code

[![n8n](https://www.shieldcn.dev/badge/n8n-000000.svg?variant=default&logo=n8n&logoColor=FFFFFF&size=xs)](https://n8n.io)
[![TypeScript](https://www.shieldcn.dev/badge/TypeScript-000000.svg?variant=default&logo=TypeScript&logoColor=FFFFFF&size=xs)](https://www.typescriptlang.org)
[![Docker](https://www.shieldcn.dev/badge/Docker-000000.svg?variant=default&logo=Docker&logoColor=FFFFFF&size=xs)](https://www.docker.com)


| Workflow | What it demonstrates |
|----------|----------------------|
| [`escalation-autopsy.workflow.ts`](workflows/escalation-autopsy.workflow.ts) | Incident webhook → live call to [aws-bedrock-ops-agent](https://github.com/h-vance/aws-bedrock-ops-agent)'s MCP tool (real JSON-RPC over streamable-HTTP, hand-rolled in a Code node since n8n community edition has no MCP client node) → Slack summary → postmortem draft for [incident-postmortems](https://github.com/h-vance/incident-postmortems) |
| [`web3-infra-self-healing.workflow.ts`](workflows/web3-infra-self-healing.workflow.ts) | Alert routing by service type (blockchain protocol diagnostics vs. infra/K8s diagnostics), severity scoring, a human-in-the-loop Senior TSE Approval Gate for high-severity cases, simulated self-healing, and an evidence packet |

See [docs/PORTFOLIO_REVIEW.md](docs/PORTFOLIO_REVIEW.md) for what's real vs. mocked in each.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system boundaries, the build/verify/export pipeline, known limits
- [Portfolio Review Guide](docs/PORTFOLIO_REVIEW.md) — what this demonstrates, review path, engineering tradeoffs

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
| `N8N_OWNER_EMAIL` / `N8N_OWNER_PASSWORD` / `N8N_OWNER_FIRST_NAME` / `N8N_OWNER_LAST_NAME` | Local-only owner account for the dev n8n instance — not a real third-party account |
| `N8N_API_URL` | n8n instance URL (default `http://localhost:5678`) |
| `N8N_API_KEY` | Personal API key, created via the owner account, used by the n8nac CLI |

## Development

```bash
npm run verify   # push + execute both workflows against fixture payloads
```

## Related

- [aws-bedrock-ops-agent](https://github.com/h-vance/aws-bedrock-ops-agent) — the MCP server `escalation-autopsy` calls
- [incident-postmortems](https://github.com/h-vance/incident-postmortems) — where `escalation-autopsy` drafts postmortems for
- `n8n-interview-prep` — a local (not-yet-public) self-hosted n8n Docker stack this repo's `docker-compose.yml` is adapted from

## License

MIT
