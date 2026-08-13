import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Escalation Autopsy
// Nodes   : 8  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// IncidentWebhook                    webhook
// CallMcpTriage                      code
// FormatSlackMessage                 set
// PostToSlackMocked                  set
// DraftPostmortem                    set
// CommitPostmortemMocked             set
// MergeResults                       merge
// RespondToWebhook                   respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// IncidentWebhook
//    → CallMcpTriage
//      → FormatSlackMessage
//        → PostToSlackMocked
//          → MergeResults
//            → RespondToWebhook
//        → DraftPostmortem
//          → CommitPostmortemMocked
//            → MergeResults.in(1) (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'n3SLWRFA7LdfIZcr',
    name: 'Escalation Autopsy',
    active: false,
    settings: { executionOrder: 'v1' },
})
export class EscalationAutopsyWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Incident Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-460, 260],
    })
    IncidentWebhook = {
        httpMethod: 'POST',
        path: 'escalation-autopsy',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        name: 'Call MCP Triage',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-220, 260],
    })
    CallMcpTriage = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: "\n// Real, live call to aws-bedrock-ops-agent's MCP server (built earlier this\n// session), reached from inside the Docker network via host.docker.internal.\n// n8n has no built-in MCP client node in the community edition, so this\n// speaks the streamable-HTTP JSON-RPC protocol directly.\n// n8n's webhook node nests the actual POST body under `.body` -- fall\n// back to the top-level item for non-HTTP triggers (e.g. manual runs).\nconst incident = $input.item.json.body || $input.item.json;\n\nconst mcpUrl = 'http://host.docker.internal:8001/mcp/';\nconst rpcRequest = {\n  jsonrpc: '2.0',\n  id: 1,\n  method: 'tools/call',\n  params: {\n    name: 'triage_incident',\n    arguments: {\n      bundle: {\n        incident_id: incident.incident_id || incident.ticket_id || ('INC-' + Date.now()),\n        summary: incident.summary || incident.subject || incident.description || '',\n      },\n    },\n  },\n};\n\nconst response = await this.helpers.httpRequest({\n  method: 'POST',\n  url: mcpUrl,\n  headers: {\n    'Content-Type': 'application/json',\n    'Accept': 'application/json, text/event-stream',\n  },\n  body: rpcRequest,\n  json: true,\n  returnFullResponse: true,\n});\n\n// The MCP streamable-HTTP transport replies with an SSE-framed body\n// (\"event: message\\ndata: {...}\"), not a bare JSON document — parse the\n// data line out before decoding it.\nconst rawBody = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);\nconst dataLine = rawBody.split('\\n').find((line) => line.startsWith('data: '));\nif (!dataLine) {\n  throw new Error('No SSE data line in MCP response: ' + rawBody.slice(0, 300));\n}\nconst rpcResponse = JSON.parse(dataLine.slice('data: '.length));\nconst toolText = rpcResponse.result.content[0].text;\nconst triage = JSON.parse(toolText);\n\nreturn [{ json: triage }];\n",
    };

    @node({
        name: 'Format Slack Message',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [20, 260],
    })
    FormatSlackMessage = {
        mode: 'manual',
        assignments: {
            assignments: [
                {
                    id: 'slack-channel',
                    name: 'slack_channel',
                    type: 'string',
                    value: '#incident-review',
                },
                {
                    id: 'slack-text',
                    name: 'slack_text',
                    type: 'string',
                    value: "={{ ':mag: *Escalation Autopsy: ' + $json.incident_id + '*\\n*Top hypothesis (' + $json.hypotheses[0].confidence + '):* ' + $json.hypotheses[0].hypothesis + '\\n*Escalation ready:* ' + $json.escalation_ready + '\\n*Mode:* ' + $json.mode }}",
                },
            ],
        },
        includeOtherFields: true,
        options: {},
    };

    @node({
        name: 'Post to Slack (mocked)',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [260, 180],
    })
    PostToSlackMocked = {
        mode: 'manual',
        assignments: {
            assignments: [
                {
                    id: 'mock-1',
                    name: 'mocked',
                    type: 'boolean',
                    value: true,
                },
                {
                    id: 'mock-2',
                    name: 'would_post_channel',
                    type: 'string',
                    value: '={{ $json.slack_channel }}',
                },
                {
                    id: 'mock-3',
                    name: 'would_post_text',
                    type: 'string',
                    value: '={{ $json.slack_text }}',
                },
            ],
        },
        options: {},
    };

    @node({
        name: 'Draft Postmortem',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [500, 260],
    })
    DraftPostmortem = {
        mode: 'manual',
        assignments: {
            assignments: [
                {
                    id: 'pm-path',
                    name: 'postmortem_path',
                    type: 'string',
                    value: "={{ 'postmortems/' + $('Format Slack Message').item.json.incident_id + '.md' }}",
                },
                {
                    id: 'pm-content',
                    name: 'postmortem_content',
                    type: 'string',
                    value: "={{ '# Postmortem: ' + $('Format Slack Message').item.json.incident_id + '\\n\\n## Summary\\n\\n' + $('Format Slack Message').item.json.hypotheses[0].hypothesis + '\\n\\n## Confidence\\n\\n' + $('Format Slack Message').item.json.hypotheses[0].confidence + '\\n\\n## Escalation\\n\\nEscalation ready: ' + $('Format Slack Message').item.json.escalation_ready + '\\n\\n## Customer communication draft\\n\\n' + $('Format Slack Message').item.json.customer_comms_draft + '\\n\\n_Generated by escalation-autopsy.workflow.ts, triaged via aws-bedrock-ops-agent MCP tool (mode: ' + $('Format Slack Message').item.json.mode + ')._\\n' }}",
                },
            ],
        },
        options: {},
    };

    @node({
        name: 'Commit Postmortem (mocked)',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [740, 260],
    })
    CommitPostmortemMocked = {
        mode: 'manual',
        assignments: {
            assignments: [
                {
                    id: 'gh-mock-1',
                    name: 'mocked',
                    type: 'boolean',
                    value: true,
                },
                {
                    id: 'gh-mock-2',
                    name: 'would_commit_repo',
                    type: 'string',
                    value: 'h-vance/incident-postmortems',
                },
                {
                    id: 'gh-mock-3',
                    name: 'would_commit_path',
                    type: 'string',
                    value: '={{ $json.postmortem_path }}',
                },
                {
                    id: 'gh-mock-4',
                    name: 'would_commit_content',
                    type: 'string',
                    value: '={{ $json.postmortem_content }}',
                },
            ],
        },
        options: {},
    };

    @node({
        name: 'Merge Results',
        type: 'n8n-nodes-base.merge',
        version: 3.2,
        position: [980, 260],
    })
    MergeResults = {
        mode: 'combine',
        combineBy: 'combineAll',
        options: {},
    };

    @node({
        name: 'Respond to Webhook',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.2,
        position: [1220, 260],
    })
    RespondToWebhook = {
        respondWith: 'json',
        responseBody:
            "={{ { status: 'autopsy-complete', slack: $json[0] ?? $json, postmortem: $json[1] ?? undefined } }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.IncidentWebhook.out(0).to(this.CallMcpTriage.in(0));
        this.CallMcpTriage.out(0).to(this.FormatSlackMessage.in(0));
        this.FormatSlackMessage.out(0).to(this.PostToSlackMocked.in(0));
        this.FormatSlackMessage.out(0).to(this.DraftPostmortem.in(0));
        this.DraftPostmortem.out(0).to(this.CommitPostmortemMocked.in(0));
        this.PostToSlackMocked.out(0).to(this.MergeResults.in(0));
        this.CommitPostmortemMocked.out(0).to(this.MergeResults.in(1));
        this.MergeResults.out(0).to(this.RespondToWebhook.in(0));
    }
}
