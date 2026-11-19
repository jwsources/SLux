import { RestApi } from '@servicenow/sdk/core'

/**
 * The HTTP surface the account page calls to reach the Account Escalation
 * Advisor GenAI skill.
 *
 * WHY A REST API AT ALL. sn_one_extend.OneExtendUtil is a scoped SERVER API.
 * The page's loaders only speak HTTP -- fetchTable goes through aiuxFetch and
 * the Table API on both the server and client paths -- so no loader can invoke
 * a capability directly. This is the bridge, and nothing more.
 *
 * ---------------------------------------------------------------------------
 * 🛑 DELIBERATELY UNVERSIONED. DO NOT ADD A `versions` ARRAY.
 * ---------------------------------------------------------------------------
 * With a version declared the service carries TWO paths and only one serves:
 * sys_ws_definition.base_uri serves, while sys_ws_operation.operation_uri
 * advertises a /v1/ form that is not callable. Collapsing to one path is also
 * how the working service on the reference instance is configured.
 *
 * ---------------------------------------------------------------------------
 * 🛑 QUERY PARAMETER, NOT A PATH PARAMETER.
 * ---------------------------------------------------------------------------
 * A `{account_sys_id}` placeholder is not substituted on this platform: a
 * handler receives the literal string "{slug}" instead of the value. A query
 * parameter is the form proven to work, so the route is a flat
 * /escalation_advice and the sys_id arrives as ?account_sys_id=...
 *
 * ---------------------------------------------------------------------------
 * WHY GET
 * ---------------------------------------------------------------------------
 * It reads an account and asks a model to describe it. No record is created or
 * changed, so it is safe and idempotent. The LLM call costs tokens and ~10
 * seconds, which is a reason to CACHE it, not a reason to make it a POST.
 *
 * ---------------------------------------------------------------------------
 * ACCESS CONTROL
 * ---------------------------------------------------------------------------
 * `enforceAcl` is not set, so the platform defaults this route to the
 * `Scripted REST External Default` ACL, which requires snc_internal. That is
 * the correct gate here: the portal's users are internal, and the endpoint
 * both reads customer data and spends model tokens.
 *
 * `authentication` and `authorization` are both set explicitly rather than
 * left to their defaults -- the guide and the API reference describe these two
 * properties in CONTRADICTORY terms, each claiming to be the authentication
 * flag and the ACL flag, so neither description is trustworthy. Setting both
 * true is correct under either reading.
 */
export const sluxAdvisorRestApi = RestApi({
    $id: Now.ID['slux-advisor-rest-api'],
    name: 'SLux Advisor API',
    serviceId: 'advisor',
    active: true,
    produces: 'application/json',
    shortDescription:
        'Portal-facing bridge to the Account Escalation Advisor GenAI skill. One GET operation: account sys_id in, parsed SITUATION / DRIVERS / RISK / ACTIONS out.',
    routes: [
        /**
         * escalation_advice — one account, one generated assessment.
         *
         * EXPENSIVE BY NATURE. Measured: ~10 seconds, 2,315 prompt tokens and
         * 755 response tokens per call against a 50-device account with three
         * escalations. The caller must not block a page render on it -- the
         * account page fetches this AFTER first paint.
         *
         * The handler resolves the capability by NAME rather than by sys_id,
         * because the sys_id is generated per install.
         */
        {
            $id: Now.ID['slux-advisor-rest-escalation-advice'],
            name: 'escalation_advice',
            method: 'GET',
            path: '/escalation_advice',
            active: true,
            authentication: true,
            authorization: true,
            produces: 'application/json',
            shortDescription:
                'Generate an escalation assessment for one customer account. Returns situation, drivers[], risk, actions[] parsed from the skill output, plus logId and generatedAt. Sections are parsed server-side so the delimiter contract stays next to the prompt that produces it.',
            parameters: [
                {
                    $id: Now.ID['slux-advisor-rest-account-sys-id'],
                    name: 'account_sys_id',
                    required: true,
                    shortDescription:
                        'The customer_account sys_id to assess. Exactly 32 hex characters; anything else returns 400. Escalations are resolved from it across the account AND its child accounts, because an escalation can sit on a campus rather than the parent.',
                    exampleValue: '00d7703d87ec97106b93106bbbbb353e',
                },
            ],
            script: Now.include('../server/rest/escalation-advice.js'),
        },
    ],
})
