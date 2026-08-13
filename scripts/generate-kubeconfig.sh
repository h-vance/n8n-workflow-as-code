#!/bin/bash
# Regenerate kubeconfig/config for the n8n container. The kind cluster's
# server address is 127.0.0.1:<ephemeral-port>, which only resolves on the
# host, and the control-plane's TLS cert doesn't cover host.docker.internal
# anyway -- instead rewrite the server to the control-plane container's own
# name on the shared "kind" Docker network (which n8n's containers join),
# reachable at the container's real port 6443 and matching a valid cert SAN.
set -euo pipefail

CONTEXT="${1:-kind-tse-lab}"
CONTROL_PLANE_CONTAINER="${2:-tse-lab-control-plane}"
OUT="$(dirname "$0")/../kubeconfig/config"

mkdir -p "$(dirname "$OUT")"
kubectl config view --minify --flatten --context "$CONTEXT" \
  | sed "s#server: https://127.0.0.1:[0-9]*#server: https://${CONTROL_PLANE_CONTAINER}:6443#" \
  > "$OUT"

echo "Wrote $OUT for context $CONTEXT"
grep 'server:' "$OUT"
