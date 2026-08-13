import { workflow, node, links } from '@n8n-as-code/transformer';

@workflow({
    id: 'container-incident-responder',
    name: 'Container Incident Responder',
    active: false,
    settings: { executionOrder: 'v1' },
})
export class ContainerIncidentResponder {
    @node({
        name: 'Overview',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-900, -260],
    })
    OverviewNote = {
        content:
            '## Container Incident Responder\n\nAn alert routes by target type into one of two **real** remediation paths: Docker (raw HTTP over the mounted host Docker socket -- no CLI) or Kubernetes (kubectl against a live local kind cluster). Both inspect before, remediate, and re-inspect after, so the evidence packet proves whether the restart actually happened -- not just that a request was sent.',
        height: 190,
        width: 900,
    };

    @node({
        name: 'Incident Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-900, 320],
    })
    IncidentTrigger = {
        httpMethod: 'POST',
        path: 'container-incident-responder',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        name: 'Normalize Incident',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [-660, 320],
    })
    NormalizeIncident = {
        mode: 'manual',
        assignments: {
            assignments: [
                // n8n's webhook node nests the real POST body under `.body` --
                // fall back to the top-level item for non-HTTP (manual) triggers.
                { id: 'n1', name: 'incident_id', type: 'string', value: "={{ ($json.body || $json).incident_id || ('INC-' + Date.now()) }}" },
                { id: 'n2', name: 'target_type', type: 'string', value: "={{ (($json.body || $json).target_type || 'docker').toLowerCase() }}" },
                { id: 'n3', name: 'target', type: 'string', value: '={{ ($json.body || $json).target || "" }}' },
                { id: 'n4', name: 'namespace', type: 'string', value: '={{ ($json.body || $json).namespace || "tse-training" }}' },
            ],
        },
        includeOtherFields: false,
        options: {},
    };

    @node({
        name: 'Route by Target Type',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [-420, 320],
    })
    RouteByTargetType = {
        mode: 'rules',
        rules: {
            values: [
                {
                    conditions: {
                        options: { caseSensitive: false, leftValue: '', typeValidation: 'loose' },
                        conditions: [
                            {
                                id: 'cond-docker',
                                leftValue: '={{ $json.target_type }}',
                                rightValue: 'docker',
                                operator: { type: 'string', operation: 'equals' },
                            },
                        ],
                        combinator: 'and',
                    },
                    renameOutput: true,
                    outputKey: 'docker',
                },
                {
                    conditions: {
                        options: { caseSensitive: false, leftValue: '', typeValidation: 'loose' },
                        conditions: [
                            {
                                id: 'cond-k8s',
                                leftValue: '={{ $json.target_type }}',
                                rightValue: 'kubernetes',
                                operator: { type: 'string', operation: 'equals' },
                            },
                        ],
                        combinator: 'and',
                    },
                    renameOutput: true,
                    outputKey: 'kubernetes',
                },
            ],
        },
        options: { fallbackOutput: 'extra', renameFallbackOutput: 'docker' },
    };

    @node({
        name: 'Docker Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-420, -260],
    })
    DockerNote = {
        content:
            '**Real, not simulated.** Speaks the Docker Engine API directly over the mounted /var/run/docker.sock (raw Node http module) -- no docker CLI installed. Inspects the container\'s actual State (PID, health) before and after so the PID change proves a genuine process restart, not a no-op.',
        height: 180,
        width: 420,
        color: 4,
    };

    @node({
        name: 'Docker: Inspect + Restart',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-420, 480],
    })
    DockerInspectRestart = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode:
            "\nconst http = require('http');\n\nfunction dockerRequest(method, path) {\n  return new Promise((resolve, reject) => {\n    const req = http.request({ socketPath: '/var/run/docker.sock', path, method }, (res) => {\n      let data = '';\n      res.on('data', (c) => (data += c));\n      res.on('end', () => resolve({ status: res.statusCode, body: data }));\n    });\n    req.on('error', reject);\n    req.end();\n  });\n}\n\nconst target = $json.target;\nif (!target) {\n  throw new Error('target (container name or ID) is required for target_type \"docker\"');\n}\n\nconst beforeRes = await dockerRequest('GET', '/containers/' + encodeURIComponent(target) + '/json');\nif (beforeRes.status !== 200) {\n  throw new Error('Container not found: ' + target + ' (HTTP ' + beforeRes.status + ')');\n}\nconst before = JSON.parse(beforeRes.body);\n\nconst restartRes = await dockerRequest('POST', '/containers/' + encodeURIComponent(target) + '/restart?t=2');\n\n// Give the container a moment to come back up before re-inspecting --\n// the health check needs at least one cycle to report a fresh status.\nawait new Promise((r) => setTimeout(r, 4000));\n\nconst afterRes = await dockerRequest('GET', '/containers/' + encodeURIComponent(target) + '/json');\nconst after = JSON.parse(afterRes.body);\n\nreturn [{\n  json: {\n    incident_id: $json.incident_id,\n    target_type: 'docker',\n    target,\n    before: {\n      status: before.State.Status,\n      health: before.State.Health ? before.State.Health.Status : null,\n      pid: before.State.Pid,\n      started_at: before.State.StartedAt,\n    },\n    remediation: { action: 'container restart', http_status: restartRes.status },\n    after: {\n      status: after.State.Status,\n      health: after.State.Health ? after.State.Health.Status : null,\n      pid: after.State.Pid,\n      started_at: after.State.StartedAt,\n    },\n    remediated: after.State.Pid !== before.State.Pid,\n  },\n}];\n",
    };

    @node({
        name: 'K8s Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [40, -260],
    })
    K8sNote = {
        content:
            '**Real, not simulated.** Shells out to the actual kubectl binary (added to this repo\'s custom n8n image) against a live local kind cluster on a shared Docker network. Runs a genuine `kubectl rollout restart` and waits on `kubectl rollout status` for it to finish -- the new pod name in the evidence packet is proof a fresh pod actually replaced the old one.',
        height: 190,
        width: 460,
        color: 4,
    };

    @node({
        name: 'K8s: Inspect + Rollout Restart',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [40, 480],
    })
    K8sInspectRolloutRestart = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode:
            "\nconst { execSync } = require('child_process');\n\nconst target = $json.target;\nconst namespace = $json.namespace;\nif (!target) {\n  throw new Error('target (deployment name) is required for target_type \"kubernetes\"');\n}\n\nfunction kubectlJson(args) {\n  const out = execSync('kubectl ' + args, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });\n  return JSON.parse(out);\n}\n\nfunction summarizePods(podList) {\n  return podList.items.map((p) => ({\n    name: p.metadata.name,\n    ready: p.status.containerStatuses ? p.status.containerStatuses.every((c) => c.ready) : false,\n    restart_count: p.status.containerStatuses\n      ? p.status.containerStatuses.reduce((sum, c) => sum + c.restartCount, 0)\n      : 0,\n  }));\n}\n\nconst before = summarizePods(kubectlJson('get pods -n ' + namespace + ' -l app=' + target + ' -o json'));\n\nexecSync('kubectl rollout restart deployment/' + target + ' -n ' + namespace, { encoding: 'utf-8' });\nconst rolloutOutput = execSync(\n  'kubectl rollout status deployment/' + target + ' -n ' + namespace + ' --timeout=60s',\n  { encoding: 'utf-8' }\n).trim();\n\nconst after = summarizePods(kubectlJson('get pods -n ' + namespace + ' -l app=' + target + ' -o json'));\n\nreturn [{\n  json: {\n    incident_id: $json.incident_id,\n    target_type: 'kubernetes',\n    target,\n    namespace,\n    before,\n    remediation: { action: 'kubectl rollout restart', rollout_output: rolloutOutput },\n    after,\n    remediated: after.length > 0 && before.length > 0 && after[0].name !== before[0].name,\n  },\n}];\n",
    };

    @node({
        name: 'Format Evidence Summary',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [300, 320],
    })
    FormatEvidenceSummary = {
        mode: 'manual',
        assignments: {
            assignments: [
                {
                    id: 'slack-channel',
                    name: 'slack_channel',
                    type: 'string',
                    value: '#infra-incidents',
                },
                {
                    id: 'slack-text',
                    name: 'slack_text',
                    type: 'string',
                    value:
                        "={{ (() => { const d = $json; const header = ':wrench: *Container Incident Response: ' + d.incident_id + '*\\n*Target:* ' + d.target + ' (' + d.target_type + ')\\n*Action:* ' + d.remediation.action; const body = d.target_type === 'docker' ? ('\\n*Before:* ' + d.before.status + ', health=' + d.before.health + ', pid=' + d.before.pid + '\\n*After:* ' + d.after.status + ', health=' + d.after.health + ', pid=' + d.after.pid) : ('\\n*Before:* ' + JSON.stringify(d.before) + '\\n*After:* ' + JSON.stringify(d.after)); return header + body + '\\n*Remediated:* ' + d.remediated; })() }}",
                },
            ],
        },
        includeOtherFields: true,
        options: {},
    };

    @node({
        name: 'Slack Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [280, -260],
    })
    SlackNote = {
        content:
            '**Mocked.** Records what would have been posted instead of calling a real Slack webhook, so repeated test runs never spam a real channel. Swap for an HTTP Request node pointed at a Slack incoming webhook to go live.',
        height: 160,
        width: 300,
        color: 5,
    };

    @node({
        name: 'Post to Slack (mocked)',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [560, 320],
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
        includeOtherFields: true,
        options: {},
    };

    @node({
        name: 'Respond to Webhook',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.2,
        position: [800, 320],
    })
    RespondToWebhook = {
        respondWith: 'json',
        responseBody:
            "={{ { status: 'incident-response-complete', incident_id: $json.incident_id, target_type: $json.target_type, target: $json.target, remediation: $json.remediation, before: $json.before, after: $json.after, remediated: $json.remediated, slack: { mocked: $json.mocked, would_post_channel: $json.would_post_channel, would_post_text: $json.would_post_text } } }}",
    };

    @links()
    defineRouting() {
        this.IncidentTrigger.out(0).to(this.NormalizeIncident.in(0));
        this.NormalizeIncident.out(0).to(this.RouteByTargetType.in(0));
        this.RouteByTargetType.out(0).to(this.DockerInspectRestart.in(0));
        this.RouteByTargetType.out(1).to(this.K8sInspectRolloutRestart.in(0));
        this.DockerInspectRestart.out(0).to(this.FormatEvidenceSummary.in(0));
        this.K8sInspectRolloutRestart.out(0).to(this.FormatEvidenceSummary.in(0));
        this.FormatEvidenceSummary.out(0).to(this.PostToSlackMocked.in(0));
        this.PostToSlackMocked.out(0).to(this.RespondToWebhook.in(0));
    }
}
