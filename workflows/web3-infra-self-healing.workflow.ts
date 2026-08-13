import { workflow, node, links } from '@n8n-as-code/transformer';

@workflow({
    id: 'web3-infra-self-healing',
    name: 'Web3 Infra Self-Healing Engine',
    active: false,
    settings: { executionOrder: 'v1' },
})
export class Web3InfraSelfHealing {
    @node({
        name: 'Overview',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-700, -180],
    })
    OverviewNote = {
        content:
            '## Web3 Infra Self-Healing Engine\n\nAn alert routes by service name into one of two diagnostic paths, gets a severity score from that diagnostic data, and branches through a human-in-the-loop approval gate before simulated self-healing runs. Diagnostics are deterministic simulations (derived from the incident ID) -- this never touches real blockchain or Kubernetes infrastructure.',
        height: 160,
        width: 700,
    };

    @node({
        name: 'Alert Intake',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-700, 300],
    })
    AlertIntake = {
        httpMethod: 'POST',
        path: 'web3-infra-self-healing',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        name: 'Normalize Incident Context',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [-460, 300],
    })
    NormalizeIncidentContext = {
        mode: 'manual',
        assignments: {
            assignments: [
                // n8n's webhook node nests the real POST body under `.body` --
                // fall back to the top-level item for non-HTTP (manual) triggers.
                { id: 'n1', name: 'incident_id', type: 'string', value: "={{ ($json.body || $json).incident_id || ($json.body || $json).alert_id || ('ALERT-' + Date.now()) }}" },
                { id: 'n2', name: 'service_name', type: 'string', value: '={{ ($json.body || $json).service_name || "unknown-service" }}' },
                { id: 'n3', name: 'symptom', type: 'string', value: '={{ ($json.body || $json).symptom || ($json.body || $json).description || "no symptom provided" }}' },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        name: 'Route by Failure Type',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [-220, 300],
    })
    RouteByFailureType = {
        mode: 'rules',
        rules: {
            values: [
                {
                    conditions: {
                        options: { caseSensitive: false, leftValue: '', typeValidation: 'loose' },
                        conditions: [
                            {
                                id: 'cond-protocol',
                                leftValue: '={{ $json.service_name }}',
                                rightValue: 'node',
                                operator: { type: 'string', operation: 'contains' },
                            },
                        ],
                        combinator: 'and',
                    },
                    renameOutput: true,
                    outputKey: 'protocol',
                },
                {
                    conditions: {
                        options: { caseSensitive: false, leftValue: '', typeValidation: 'loose' },
                        conditions: [
                            {
                                id: 'cond-infra',
                                leftValue: '={{ $json.service_name }}',
                                rightValue: 'api',
                                operator: { type: 'string', operation: 'contains' },
                            },
                        ],
                        combinator: 'and',
                    },
                    renameOutput: true,
                    outputKey: 'infra',
                },
            ],
        },
        options: { fallbackOutput: 'extra', renameFallbackOutput: 'infra' },
    };

    @node({
        name: 'Protocol Path Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [40, 20],
    })
    ProtocolPathNote = {
        content:
            '**Protocol path.** Taken when the service name looks like a blockchain node. Simulates checking RPC sync lag and peer count -- deterministic per incident ID, so the same incident always produces the same (reproducible) diagnostic result.',
        height: 140,
        width: 520,
        color: 4,
    };

    @node({
        name: 'Check RPC Sync',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [40, 180],
    })
    CheckRpcSync = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
// Simulated diagnostic (this repo never touches real validator/RPC
// infrastructure) but the logic genuinely runs: derive a deterministic
// "block lag" from the incident id so different incidents produce
// different, reproducible results instead of a static stub.
const item = $input.item.json;
let hash = 0;
for (const ch of item.incident_id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
const blockLag = hash % 40;
const rpcHealthy = blockLag < 12;
return [{ json: { ...item, block_lag: blockLag, rpc_healthy: rpcHealthy } }];
`,
    };

    @node({
        name: 'Scan Peer/Log Signal',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [280, 180],
    })
    ScanPeerLogSignal = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
const item = $input.item.json;
let hash = 0;
for (const ch of item.incident_id) hash = (hash * 17 + ch.charCodeAt(0)) >>> 0;
const peerCount = 8 + (hash % 20);
const peersHealthy = peerCount >= 12;
return [{ json: { ...item, peer_count: peerCount, peers_healthy: peersHealthy, diagnostic_path: 'protocol' } }];
`,
    };

    @node({
        name: 'Infra Path Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [40, 600],
    })
    InfraPathNote = {
        content:
            '**Infra path.** Taken when the service name looks like a regular API/backend service. Simulates a Kubernetes pod-restart count and a log error rate -- same determinism guarantee as the protocol path.',
        height: 140,
        width: 520,
        color: 4,
    };

    @node({
        name: 'Worker: K8s Context',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [40, 420],
    })
    WorkerK8sContext = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
// Simulated K8s describe summary -- deterministic per incident, not a stub.
const item = $input.item.json;
let hash = 0;
for (const ch of item.incident_id) hash = (hash * 13 + ch.charCodeAt(0)) >>> 0;
const restartCount = hash % 6;
const podHealthy = restartCount < 3;
return [{ json: { ...item, pod_restart_count: restartCount, pod_healthy: podHealthy } }];
`,
    };

    @node({
        name: 'Worker: Log Analysis',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [280, 420],
    })
    WorkerLogAnalysis = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
const item = $input.item.json;
let hash = 0;
for (const ch of item.incident_id) hash = (hash * 23 + ch.charCodeAt(0)) >>> 0;
const errorRatePercent = hash % 25;
const logsHealthy = errorRatePercent < 8;
return [{ json: { ...item, error_rate_percent: errorRatePercent, logs_healthy: logsHealthy, diagnostic_path: 'infra' } }];
`,
    };

    @node({
        name: 'Compute Severity Score',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [540, 300],
    })
    ComputeSeverityScore = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
const item = $input.item.json;
const healthyFlags = [item.rpc_healthy, item.peers_healthy, item.pod_healthy, item.logs_healthy].filter((v) => v !== undefined);
const unhealthyCount = healthyFlags.filter((v) => v === false).length;
const severity = unhealthyCount === 0 ? 'low' : unhealthyCount === 1 ? 'medium' : 'high';
const escalation_required = severity === 'high';
return [{ json: { ...item, severity, escalation_required } }];
`,
    };

    @node({
        name: 'Approval Gate Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [780, -180],
    })
    ApprovalGateNote = {
        content:
            '**Human-in-the-loop.** High-severity incidents (2+ unhealthy diagnostics) wait for a mocked senior-TSE approval; everything else auto-approves. The approval itself is mocked -- no real paging/Slack integration wired up -- but the branching logic is real.',
        height: 160,
        width: 480,
        color: 5,
    };

    @node({
        name: 'Senior TSE Approval Gate',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 300],
    })
    SeniorTseApprovalGate = {
        conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [
                {
                    id: 'cond-escalation',
                    leftValue: '={{ $json.escalation_required }}',
                    rightValue: true,
                    operator: { type: 'boolean', operation: 'true', singleValue: true },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        name: 'Await Senior TSE Approval (mocked)',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1020, 220],
    })
    AwaitApprovalMocked = {
        mode: 'manual',
        assignments: {
            assignments: [
                { id: 'a1', name: 'approved', type: 'boolean', value: true },
                { id: 'a2', name: 'approval_mode', type: 'string', value: 'mocked-manual-approval' },
            ],
        },
        includeOtherFields: true,
        options: {},
    };

    @node({
        name: 'Auto-Approve (low severity)',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1020, 380],
    })
    AutoApprove = {
        mode: 'manual',
        assignments: {
            assignments: [
                { id: 'b1', name: 'approved', type: 'boolean', value: true },
                { id: 'b2', name: 'approval_mode', type: 'string', value: 'auto-approved' },
            ],
        },
        includeOtherFields: true,
        options: {},
    };

    @node({
        name: 'Execute Self-Healing',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1260, 300],
    })
    ExecuteSelfHealing = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
const item = $input.item.json;
const action = item.diagnostic_path === 'protocol'
  ? 'RPC resync triggered, peer table refreshed'
  : 'Rolling restart executed on affected pods';
return [{ json: { ...item, remediation_action: action, remediation_status: 'completed' } }];
`,
    };

    @node({
        name: 'Evidence Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [1500, -180],
    })
    EvidenceNote = {
        content:
            '**Mocked posting.** The evidence summary text is real (built from the actual run\'s data); posting it to Jira/Slack is recorded, not executed -- same rationale as escalation-autopsy\'s mocked legs.',
        height: 160,
        width: 480,
        color: 5,
    };

    @node({
        name: 'Build Evidence Packet',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1500, 300],
    })
    BuildEvidencePacket = {
        mode: 'manual',
        assignments: {
            assignments: [
                {
                    id: 'ev1',
                    name: 'evidence_summary',
                    type: 'string',
                    value: "={{ '*' + $json.incident_id + '* (' + $json.service_name + ')\\nSeverity: ' + $json.severity + '\\nApproval: ' + $json.approval_mode + '\\nRemediation: ' + $json.remediation_action + '\\nStatus: ' + $json.remediation_status }}",
                },
            ],
        },
        includeOtherFields: true,
        options: {},
    };

    @node({
        name: 'Post Evidence Packet (mocked)',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [1740, 300],
    })
    PostEvidencePacketMocked = {
        mode: 'manual',
        assignments: {
            assignments: [
                { id: 'p1', name: 'mocked', type: 'boolean', value: true },
                { id: 'p2', name: 'would_post_jira_slack', type: 'string', value: '={{ $json.evidence_summary }}' },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        name: 'Respond to Webhook',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.2,
        position: [1980, 300],
    })
    RespondToWebhook = {
        respondWith: 'json',
        responseBody: '={{ $json }}',
    };

    @links()
    defineRouting() {
        this.AlertIntake.out(0).to(this.NormalizeIncidentContext.in(0));
        this.NormalizeIncidentContext.out(0).to(this.RouteByFailureType.in(0));
        this.RouteByFailureType.out(0).to(this.CheckRpcSync.in(0));
        this.RouteByFailureType.out(1).to(this.WorkerK8sContext.in(0));
        this.CheckRpcSync.out(0).to(this.ScanPeerLogSignal.in(0));
        this.ScanPeerLogSignal.out(0).to(this.ComputeSeverityScore.in(0));
        this.WorkerK8sContext.out(0).to(this.WorkerLogAnalysis.in(0));
        this.WorkerLogAnalysis.out(0).to(this.ComputeSeverityScore.in(0));
        this.ComputeSeverityScore.out(0).to(this.SeniorTseApprovalGate.in(0));
        this.SeniorTseApprovalGate.out(0).to(this.AwaitApprovalMocked.in(0));
        this.SeniorTseApprovalGate.out(1).to(this.AutoApprove.in(0));
        this.AwaitApprovalMocked.out(0).to(this.ExecuteSelfHealing.in(0));
        this.AutoApprove.out(0).to(this.ExecuteSelfHealing.in(0));
        this.ExecuteSelfHealing.out(0).to(this.BuildEvidencePacket.in(0));
        this.BuildEvidencePacket.out(0).to(this.PostEvidencePacketMocked.in(0));
        this.PostEvidencePacketMocked.out(0).to(this.RespondToWebhook.in(0));
    }
}
