# Architecture

This repo is a set of n8n workflows, authored as code, plus the toolchain to build and verify them against a real instance rather than trusting hand-authored JSON.

## System Boundaries

| Component | Responsibility |
|-----------|-----------------|
| `workflows/*.workflow.ts` | Source of truth — TypeScript workflow definitions using `@n8n-as-code/transformer` decorators (`@workflow`, `@node`, `@links`) |
| `workflows/compiled/*.json` | Compiled n8n workflow JSON, exported from a real instance via `n8n export:workflow` — the portable, importable artifact |
| `docker-compose.yml` | Local n8n instance (Postgres, Redis, n8n main + worker, queue mode) used to build and execute-test workflows |
| `@n8n-as-code/cli` (`n8nac`) | TS ↔ JSON conversion and sync against a live instance |

## Build / Verify / Export Pipeline

1. Author or edit a `.workflow.ts` file.
2. `n8nac convert <file> --format json` compiles it — a pure, stateless TS → JSON transform, no live instance required to check it compiles.
3. Push into a real running n8n instance (`n8nac push`, or via the REST API directly) and execute it with a fixture payload.
4. Inspect the execution result. Fix bugs found this way in the TypeScript source, not the compiled JSON — the JSON is a build artifact, not something to hand-edit.
5. Once verified, `n8n export:workflow --id=<id> --output=workflows/compiled/<name>.json --pretty` produces the artifact actually committed.
6. Commit and push both files immediately — this is the discipline that was missing the first time these workflows were built.

## Real External Integrations

Two workflows go further than simulation and touch genuinely live systems, which required extending the local stack beyond the stock `n8nio/n8n` image (see `Dockerfile.n8n`):

- `postman-evidence-audit` shells out to `npx newman run` (via `child_process`, allow-listed through `NODE_FUNCTION_ALLOW_BUILTIN`) against the real [postman-tse-incident-lab](https://github.com/h-vance/postman-tse-incident-lab) Postman collection, fetched live from GitHub raw URLs, run against that repo's actual `lab_api.py` process on the host.
- `container-incident-responder`'s Docker leg speaks the Docker Engine API directly over `/var/run/docker.sock` (mounted into the container, raw Node `http` module — no CLI) to inspect and restart a real container from [docker-tse-incident-lab](https://github.com/h-vance/docker-tse-incident-lab). Its Kubernetes leg shells out to a real `kubectl` (added to the custom image) against a live local `kind` cluster, joined via a shared Docker network (`kind`) so the container reaches the control-plane by its real hostname — required because the cluster's TLS cert doesn't cover `host.docker.internal`, and the host-mapped port is ephemeral across restarts anyway. `scripts/generate-kubeconfig.sh` regenerates the mounted kubeconfig for the current cluster.

## Known Limits

- External side effects (Slack posts, GitHub commits, Jira tickets) are **mocked** in every workflow — a `Set` node stands in for the real HTTP call and records what it would have sent. See [docs/PORTFOLIO_REVIEW.md](PORTFOLIO_REVIEW.md) for why and how to wire in real credentials.
- `web3-infra-self-healing`'s diagnostics are deterministic simulations (derived from the incident ID), not real calls to blockchain or Kubernetes infrastructure — this workflow never touches production systems.
- The Docker socket mount gives the n8n container root-equivalent control over the host's Docker daemon — acceptable for a local demo lab, not something to carry into a shared or production instance without much tighter scoping.
- The local n8n instance's owner account and API key are throwaway dev credentials (see `.env.example`), not meant to be reused anywhere else.
- n8n community edition has no native MCP client node, so `escalation-autopsy`'s MCP call is hand-rolled JSON-RPC in a Code node rather than a dedicated node.
