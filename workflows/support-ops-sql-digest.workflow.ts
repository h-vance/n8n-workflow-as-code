import { workflow, node, links } from '@n8n-as-code/transformer';

@workflow({
    id: 'support-ops-sql-digest',
    name: 'Support Ops SQL Digest',
    active: false,
    settings: { executionOrder: 'v1' },
})
export class SupportOpsSqlDigest {
    @node({
        name: 'Overview',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-700, -240],
    })
    OverviewNote = {
        content:
            "## Support Ops SQL Digest\n\nQueries **this n8n instance's own Postgres database** for per-workflow execution health over a requested window: run counts, error counts, error rate, and average runtime. The SQL is real (JOIN across `execution_entity`/`workflow_entity`, aggregate `FILTER` clauses, a parameterized interval) and runs as a dedicated **read-only database role** (`digest_ro`) that can only SELECT the two tables it needs -- the digest can never write to, or even read, anything else.",
        height: 210,
        width: 700,
    };

    @node({
        name: 'Digest Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-700, 300],
    })
    DigestTrigger = {
        httpMethod: 'POST',
        path: 'support-ops-sql-digest',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        name: 'SQL Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-460, -240],
    })
    SqlNote = {
        content:
            '**Real, not simulated.** A parameterized query ($1 = window in days, from the webhook payload) against the live executions database this instance writes to. Least-privilege by construction: the `digest_ro` role holds SELECT on exactly two tables and nothing else, so a bug here cannot touch workflow definitions or credentials.',
        height: 190,
        width: 440,
        color: 4,
    };

    @node({
        name: 'Query Execution Stats',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-460, 300],
        credentials: {
            postgres: { id: 'JVzQdFqUB2JrcTKR', name: 'n8n DB (digest read-only)' },
        },
    })
    QueryExecutionStats = {
        operation: 'executeQuery',
        query:
            'SELECT\n' +
            '  w.name AS workflow,\n' +
            '  COUNT(*) AS runs,\n' +
            "  COUNT(*) FILTER (WHERE e.status = 'error') AS errors,\n" +
            "  ROUND(100.0 * COUNT(*) FILTER (WHERE e.status = 'error') / COUNT(*), 1) AS error_rate_pct,\n" +
            '  ROUND(AVG(EXTRACT(EPOCH FROM (e."stoppedAt" - e."startedAt")))::numeric, 2) AS avg_runtime_seconds,\n' +
            '  TO_CHAR(MAX(e."startedAt"), \'YYYY-MM-DD HH24:MI\') AS last_run_at\n' +
            'FROM execution_entity e\n' +
            'JOIN workflow_entity w ON w.id = e."workflowId"\n' +
            "WHERE e.\"startedAt\" >= NOW() - ($1 || ' days')::interval\n" +
            'GROUP BY w.name\n' +
            'ORDER BY error_rate_pct DESC, runs DESC',
        options: {
            queryReplacement: "={{ ($json.body || $json).days || 7 }}",
        },
    };

    @node({
        name: 'Compose Digest',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-220, 300],
    })
    ComposeDigest = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode:
            "\nconst rows = $input.all().map((i) => i.json);\nconst trigger = $('Digest Trigger').first().json;\nconst days = (trigger.body || trigger).days || 7;\n\nconst totalRuns = rows.reduce((sum, r) => sum + Number(r.runs), 0);\nconst totalErrors = rows.reduce((sum, r) => sum + Number(r.errors), 0);\n\nconst lines = rows.map((r) => {\n  const icon = Number(r.errors) > 0 ? ':x:' : ':white_check_mark:';\n  return icon + ' *' + r.workflow + '* -- ' + r.runs + ' runs, ' + r.errors + ' errors (' + r.error_rate_pct + '%), avg ' + r.avg_runtime_seconds + 's, last ' + r.last_run_at;\n});\n\nconst digest = ':bar_chart: *Support Ops Digest (last ' + days + ' days)*\\n' +\n  '*Total:* ' + totalRuns + ' runs, ' + totalErrors + ' errors across ' + rows.length + ' workflows\\n' +\n  (lines.length ? lines.join('\\n') : '_No executions in this window._');\n\nreturn [{\n  json: {\n    window_days: Number(days),\n    workflows_reported: rows.length,\n    total_runs: totalRuns,\n    total_errors: totalErrors,\n    stats: rows,\n    slack_channel: '#support-ops',\n    slack_text: digest,\n  },\n}];\n",
    };

    @node({
        name: 'Slack Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-240, -240],
    })
    SlackNote = {
        content:
            '**Mocked.** Records what would have been posted instead of calling a real Slack webhook, so repeated digest runs never spam a real channel. The container-incident-responder workflow shows the live pattern (env-gated HTTP Request node).',
        height: 160,
        width: 320,
        color: 5,
    };

    @node({
        name: 'Post to Slack (mocked)',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [20, 300],
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
        position: [260, 300],
    })
    RespondToWebhook = {
        respondWith: 'json',
        responseBody:
            "={{ { status: 'digest-complete', window_days: $json.window_days, workflows_reported: $json.workflows_reported, total_runs: $json.total_runs, total_errors: $json.total_errors, stats: $json.stats, slack: { mocked: $json.mocked, would_post_channel: $json.would_post_channel, would_post_text: $json.would_post_text } } }}",
    };

    @links()
    defineRouting() {
        this.DigestTrigger.out(0).to(this.QueryExecutionStats.in(0));
        this.QueryExecutionStats.out(0).to(this.ComposeDigest.in(0));
        this.ComposeDigest.out(0).to(this.PostToSlackMocked.in(0));
        this.PostToSlackMocked.out(0).to(this.RespondToWebhook.in(0));
    }
}
