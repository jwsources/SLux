/**
 * GET /api/x_snc_slux/advisor/escalation_advice?account_sys_id=<sys_id>
 *
 * The HTTP bridge to the Account Escalation Advisor GenAI skill.
 *
 * WHY THIS EXISTS. sn_one_extend.OneExtendUtil is a scoped SERVER API. The
 * account page's loaders only speak HTTP -- fetchTable goes through aiuxFetch
 * and the Table API on both the server and client paths -- so a loader cannot
 * invoke a capability directly. This is the thinnest surface that closes that
 * gap: one query parameter in, parsed sections out.
 *
 * THE CAPABILITY IS RESOLVED BY NAME, NOT HARDCODED. Its sys_id is generated
 * per install, so a literal would work on this instance and silently return
 * "skill not found" on the next one. Measured here as
 * 5c0fd41d749e4604b4da84875bcd8b3d, which is exactly the value that must NOT
 * be baked in.
 *
 * THE RESPONSE PATH IS VERIFIED, not guessed. Probed against a live
 * invocation:
 *   res.capabilities[cap].response   [object String] len=2914, starts
 *                                    "===SITUATION===""
 *   res.capabilities[cap].raw_model_output.message.content[0].text
 *                                    undefined -- and it returns undefined
 *                                    rather than THROWING, so a try/catch
 *                                    fallback around it never fires and the
 *                                    caller silently gets an empty string.
 * That second line is why the first wiring attempt produced output_chars: 0
 * while the log held a full 3,183-character answer.
 *
 * SECTIONS ARE PARSED HERE rather than in the page, so the delimiter contract
 * lives next to the prompt that produces it. A page that split on
 * "===DRIVERS===" itself would be a second place to update whenever the
 * prompt changes.
 */
(function process(request, response) {
    var CAPABILITY_NAME = 'Account Escalation Advisor';

    function fail(status, message, extra) {
        response.setStatus(status);
        var body = {error: message};
        if (extra) {
            for (var k in extra) {
                if (Object.prototype.hasOwnProperty.call(extra, k)) body[k] = extra[k];
            }
        }
        response.setBody(body);
    }

    // --- 1. Input ---
    // queryParams values arrive as ARRAYS in Scripted REST, so both shapes are
    // accepted rather than assuming one.
    var raw = request.queryParams ? request.queryParams.account_sys_id : null;
    var accountId = '';
    if (raw) {
        accountId = Object.prototype.toString.call(raw) === '[object Array]' ? raw[0] : raw;
    }
    accountId = String(accountId || '').trim();

    // A sys_id is exactly 32 hex characters. Validating here keeps a malformed
    // value out of a GlideRecord.get and out of the LLM prompt.
    if (!/^[0-9a-f]{32}$/i.test(accountId)) {
        fail(400, 'account_sys_id must be a 32-character sys_id', {received: accountId});
        return;
    }

    // --- 2. Resolve the capability by name ---
    var cap = '';
    var cg = new GlideRecord('sys_one_extend_capability');
    cg.addQuery('name', CAPABILITY_NAME);
    cg.addQuery('active', true);
    cg.setLimit(1);
    cg.query();
    if (cg.next()) {
        cap = cg.getUniqueValue();
    }
    if (!cap) {
        fail(503, 'The escalation advisor skill is not installed or not active', {
            capability: CAPABILITY_NAME
        });
        return;
    }

    // --- 3. Invoke ---
    var text = '';
    var logId = '';
    try {
        var res = sn_one_extend.OneExtendUtil.execute({
            executionRequests: [
                {
                    capabilityId: cap,
                    payload: {account_sys_id: accountId}
                }
            ]
        });

        var capOut = res && res.capabilities ? res.capabilities[cap] : null;
        if (!capOut) {
            fail(502, 'The skill returned no capability output');
            return;
        }
        if (capOut.status && String(capOut.status) !== 'success') {
            fail(502, 'The skill reported a failure', {status: String(capOut.status)});
            return;
        }

        // The verified path. Never raw_model_output -- see the header note.
        text = String(capOut.response || '');
        logId = String(capOut.logId || '');
    } catch (e) {
        fail(502, 'The skill threw during execution', {detail: String(e)});
        return;
    }

    if (!text) {
        fail(502, 'The skill returned an empty response', {logId: logId});
        return;
    }

    // --- 4. Parse the sections ---
    // The prompt emits ===SITUATION=== / ===DRIVERS=== / ===RISK=== /
    // ===ACTIONS===. A missing section yields an empty string rather than
    // throwing, so a partial answer still renders what it has.
    function section(name) {
        var start = text.indexOf('===' + name + '===');
        if (start === -1) return '';
        start += name.length + 6;
        // The next delimiter of ANY name ends this section.
        var rest = text.substring(start);
        var next = rest.search(/\n={3}[A-Z]+={3}/);
        var chunk = next === -1 ? rest : rest.substring(0, next);
        return chunk.replace(/^\s+|\s+$/g, '');
    }

    // A bullet or numbered list, split into lines. Leading markers are kept
    // off so the page renders its own list semantics rather than inheriting
    // the model's punctuation.
    function lines(block) {
        if (!block) return [];
        return block
            .split('\n')
            .map(function (l) {
                return l.replace(/^\s*(?:[-*\u2022]|\d+\.)\s*/, '').replace(/^\s+|\s+$/g, '');
            })
            .filter(function (l) {
                return l.length > 0;
            });
    }

    var situation = section('SITUATION');
    var drivers = lines(section('DRIVERS'));
    var risk = section('RISK');
    var actions = lines(section('ACTIONS'));

    // Nothing parsed at all means the model ignored the delimiter contract.
    // Returning the raw text alongside lets the page degrade to showing it
    // instead of rendering four empty panels.
    response.setStatus(200);
    response.setBody({
        accountSysId: accountId,
        situation: situation,
        drivers: drivers,
        risk: risk,
        actions: actions,
        parsed: Boolean(situation || drivers.length || risk || actions.length),
        raw: situation || drivers.length || risk || actions.length ? '' : text,
        logId: logId,
        generatedAt: new GlideDateTime().getDisplayValue()
    });
})(request, response);
