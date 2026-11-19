import { NowAssistSkillConfig } from '@servicenow/sdk/core'

// ═══════════════════════════════════════════════════════════════════════════════
// GenAI SKILL: Account Escalation Advisor
// Takes an account sys_id, gathers the active escalation(s) plus the surrounding
// account context server-side (InlineScript), then instructs the LLM to emit a
// SITUATION / DRIVERS / RISK / ACTIONS narrative for the account page top panel.
//
// WHY A SKILL AND NOT A SEEDED PROMPT. Measured: with the page context seeded,
// Otto still answered "the available record query schema in this conversation
// does not include the escalation record type" -- its record-query tool cannot
// reach sn_customerservice_escalation, so no amount of page awareness lets it
// read the escalation itself. A skill gathers that data SERVER-SIDE and hands it
// to the model as context, which bypasses the query schema entirely.
//
// Pattern mirrors the Record Story Generator and Voice Call Case Summary skills,
// including the Azure OpenAI provider flow id.
// ═══════════════════════════════════════════════════════════════════════════════

export const accountEscalationAdvisor = NowAssistSkillConfig(
    {
        $id: Now.ID['account_escalation_advisor_skill'],
        name: 'Account Escalation Advisor',
        shortDescription: 'Explains what is driving an account escalation and ranks the next actions.',
        description:
            'Takes a customer account sys_id, gathers its active escalations plus contracts, cases, installed products and hierarchy server-side, then instructs an LLM to produce a SITUATION / DRIVERS / RISK / ACTIONS assessment for the account page top panel.',
        inputs: [
            {
                $id: Now.ID['account_escalation_advisor_account_input'],
                name: 'account sys id',
                dataType: 'string',
                mandatory: true,
                description: 'The customer_account sys_id to assess. Escalations are resolved from it.',
                testValues: '00d7703d87ec97106b93106bbbbb353e',
                truncate: false,
            },
        ],
        tools: (t) => {
            const gatherEscalationContext = t.InlineScript('GatherEscalationContext', {
                $id: Now.ID['b3d41a7c9e5f4a1d8c27f06b5ad93e14'],
                script: `(function runScript(context) {
  var accountId = context.getValue('account_sys_id');
  var result = '';

  // --- 1. The account ---
  var ag = new GlideRecord('customer_account');
  if (!ag.get(accountId)) {
    return 'ERROR: Account not found with sys_id ' + accountId;
  }

  result += '=== ACCOUNT ===\\n';
  result += 'Name: ' + (ag.getValue('name') || '') + '\\n';
  result += 'ACCOUNT_SYS_ID: ' + accountId + '\\n';
  if (ag.isValidField('x_snc_philips_e2_0_health')) {
    result += 'Health: ' + (ag.getDisplayValue('x_snc_philips_e2_0_health') || 'not set') + '\\n';
  }
  if (ag.isValidField('x_snc_philips_e2_0_region')) {
    result += 'Region: ' + (ag.getDisplayValue('x_snc_philips_e2_0_region') || '') + '\\n';
  }
  if (ag.isValidField('x_snc_philips_e2_0_kam')) {
    result += 'Key account manager: ' + (ag.getDisplayValue('x_snc_philips_e2_0_kam') || '') + '\\n';
  }
  result += 'Annual revenue: ' + (ag.getDisplayValue('revenue_per_year') || '') + '\\n';
  result += 'Primary contact: ' + (ag.getDisplayValue('primary_contact') || '') + '\\n';

  // --- 2. The account FAMILY, resolved first because escalations and cases
  //        both hang off individual accounts rather than off the parent. ---
  // MEASURED: NewYork-Presbyterian carries 1 escalation while its child
  // NYP Campus 1 carries 2. A parent-only read therefore loaded one of three
  // and silently missed the pair on the campus.
  var familyIds = [accountId];
  var kidNames = [];
  var kg = new GlideRecord('customer_account');
  kg.addQuery('parent', accountId);
  kg.setLimit(25);
  kg.query();
  while (kg.next()) {
    familyIds.push(kg.getUniqueValue());
    kidNames.push(kg.getValue('name'));
  }
  var familyIn = familyIds.join(',');
  if (kidNames.length) {
    result += '\\n=== CHILD ACCOUNTS ===\\n' + kidNames.join('\\n') + '\\n';
  }

  // --- 3. Escalations across the whole family. They link by COMPANY ---
  // sn_customerservice_escalation has NO account field. A predicate naming one
  // is DISCARDED with only a log line, which silently returns every escalation
  // on the instance rather than none.
  //
  // ACTIVE ONES FIRST, then newest. Ordering by date alone can bury the open
  // escalation under closed ones, and the open one is the whole point.
  result += '\\n=== ESCALATIONS (account and child accounts) ===\\n';
  var escCount = 0;
  var eg = new GlideRecord('sn_customerservice_escalation');
  eg.addQuery('company', 'IN', familyIn);
  eg.orderByDesc('active');
  eg.orderByDesc('sys_created_on');
  eg.setLimit(20);
  eg.query();
  while (eg.next()) {
    escCount++;
    result += '[' + escCount + '] ' + (eg.getValue('number') || '') + '\\n';
    result += '  ESCALATION_SYS_ID: ' + eg.getUniqueValue() + '\\n';
    result += '  On account: ' + (eg.getDisplayValue('company') || '') + '\\n';
    result += '  Active: ' + (eg.getValue('active') === '1' ? 'yes' : 'no') + '\\n';
    result += '  State: ' + (eg.getDisplayValue('state') || '') + '\\n';
    if (eg.isValidField('escalation_severity')) {
      result += '  Severity: ' + (eg.getDisplayValue('escalation_severity') || '') + '\\n';
    }
    if (eg.isValidField('reason')) {
      result += '  Reason: ' + (eg.getDisplayValue('reason') || '') + '\\n';
    }
    if (eg.isValidField('trend')) {
      result += '  Trend: ' + (eg.getDisplayValue('trend') || '') + '\\n';
    }
    result += '  Priority: ' + (eg.getDisplayValue('priority') || '') + '\\n';
    result += '  Raised: ' + (eg.getValue('opened_at') || '') + '\\n';
    if (eg.isValidField('escalation_manager')) {
      var mgr = eg.getDisplayValue('escalation_manager');
      if (mgr) result += '  Escalation manager: ' + mgr + '\\n';
    }
    if (eg.isValidField('escalation_justification')) {
      var just = eg.getValue('escalation_justification') || '';
      if (just) result += '  Justification: ' + just.substring(0, 900) + '\\n';
    }
  }
  result += 'Total escalations: ' + escCount + '\\n';
  if (escCount === 0) {
    result += 'No escalations found for this account or its children.\\n';
  }

  // --- 3. Contracts, with the renewal clock ---
  result += '\\n=== CONTRACTS ===\\n';
  var cCount = 0;
  var cg = new GlideRecord('ast_contract');
  cg.addQuery('account', accountId);
  cg.orderBy('ends');
  cg.setLimit(10);
  cg.query();
  while (cg.next()) {
    cCount++;
    result += '[' + cCount + '] ' + (cg.getValue('number') || '') +
      ' | ' + (cg.getValue('short_description') || '') +
      ' | State: ' + (cg.getDisplayValue('state') || '') +
      ' | Starts: ' + (cg.getValue('starts') || '') +
      ' | Ends: ' + (cg.getValue('ends') || '') +
      ' | Yearly: ' + (cg.getDisplayValue('yearly_cost') || '') + '\\n';
  }
  if (cCount === 0) result += 'No contracts found.\\n';

  // --- 5. Cases across the account AND its child accounts ---
  // Reuses familyIn from step 2. Recomputing it here would also re-append the
  // CHILD ACCOUNTS block, listing every campus twice in the context.
  result += '\\n=== CASES (account and child accounts) ===\\n';
  var stateTally = {};
  var caseLines = '';
  var caseCount = 0;
  var sg = new GlideRecord('sn_customerservice_case');
  sg.addQuery('account', 'IN', familyIn);
  sg.orderByDesc('sys_updated_on');
  sg.setLimit(60);
  sg.query();
  while (sg.next()) {
    caseCount++;
    var st = sg.getDisplayValue('state') || 'Unset';
    stateTally[st] = (stateTally[st] || 0) + 1;
    if (caseCount <= 12) {
      caseLines += '[' + caseCount + '] ' + (sg.getValue('number') || '') +
        ' | ' + (sg.getValue('short_description') || '').substring(0, 110) +
        ' | State: ' + st +
        ' | Priority: ' + (sg.getDisplayValue('priority') || '') +
        ' | Site: ' + (sg.getDisplayValue('account') || '') + '\\n';
    }
  }
  result += 'Total cases: ' + caseCount + '\\n';
  var stKey;
  for (stKey in stateTally) {
    if (Object.prototype.hasOwnProperty.call(stateTally, stKey)) {
      result += '  ' + stKey + ': ' + stateTally[stKey] + '\\n';
    }
  }
  result += caseLines;
  if (caseCount === 0) result += 'No cases found.\\n';

  // --- 5. Installed products, tallied by product ---
  result += '\\n=== INSTALLED PRODUCTS ===\\n';
  var prodTally = {};
  var ibCount = 0;
  var ig = new GlideRecord('sn_install_base_item');
  ig.addQuery('account', accountId);
  ig.setLimit(300);
  ig.query();
  while (ig.next()) {
    ibCount++;
    var pn = ig.getDisplayValue('product') || 'Unspecified';
    prodTally[pn] = (prodTally[pn] || 0) + 1;
  }
  result += 'Total installed items: ' + ibCount + '\\n';
  var pKey;
  for (pKey in prodTally) {
    if (Object.prototype.hasOwnProperty.call(prodTally, pKey)) {
      result += '  ' + pKey + ': ' + prodTally[pKey] + '\\n';
    }
  }
  if (ibCount === 0) result += 'No installed products found.\\n';

  // --- 6. Open opportunities, so advice can reference cover ---
  result += '\\n=== OPPORTUNITIES ===\\n';
  var oCount = 0;
  var og = new GlideRecord('sn_opty_mgmt_core_opportunity');
  if (og.isValid()) {
    og.addQuery('account', accountId);
    og.setLimit(10);
    og.query();
    while (og.next()) {
      oCount++;
      result += '[' + oCount + '] ' + (og.getValue('number') || '') +
        ' | ' + (og.getValue('short_description') || '').substring(0, 110) +
        ' | Stage: ' + (og.getDisplayValue('stage') || '') +
        ' | Expected close: ' + (og.getValue('estimated_closed_date') || '') + '\\n';
    }
  }
  if (oCount === 0) result += 'No open opportunities found.\\n';

  return result;
})(context)`,
            })
            return {
                GatherEscalationContext: gatherEscalationContext,
            }
        },
        securityControls: {
            userAccess: {
                $id: Now.ID['account_escalation_advisor_user_access'],
                type: 'authenticated',
            },
            roleMap: ['admin'],
        },
        deploymentSettings: {
            nowAssistPanel: {
                enabled: true,
                roles: ['now_assist_panel_user'],
            },
            flowAction: true,
        },
        outputs: [
            {
                $id: Now.ID['account_escalation_advisor_output_response'],
                name: 'response',
                dataType: 'string',
            },
            {
                $id: Now.ID['account_escalation_advisor_output_provider'],
                name: 'provider',
                dataType: 'string',
            },
            {
                $id: Now.ID['account_escalation_advisor_output_errorcode'],
                name: 'errorcode',
                dataType: 'string',
            },
            {
                $id: Now.ID['account_escalation_advisor_output_status'],
                name: 'status',
                dataType: 'string',
            },
            {
                $id: Now.ID['account_escalation_advisor_output_error'],
                name: 'error',
                dataType: 'string',
            },
        ],
        state: 'published',
    },
    {
        providers: [
            {
                provider: 'Azure OpenAI',
                providerAPI: {
                    type: 'sys_hub_flow',
                    id: 'a55c1c6f530221106b38ddeeff7b12b1',
                },
                prompts: [
                    {
                        name: 'Account Escalation Advisor Prompt',
                        versions: [
                            {
                                $id: Now.ID['account_escalation_advisor_prompt_v1'],
                                model: 'gpt-4o',
                                temperature: 0.2,
                                maxTokens: 2000,
                                promptState: 'published',
                                prompt: (p) => `## Role
You are a customer-success escalation analyst for a medical-device service organization. You read an account's escalation record together with its commercial and service context, and you tell the account team what is actually driving the escalation and what to do about it, in priority order.

## Context
Here is the gathered account, escalation and service data:

${p.tool.GatherEscalationContext.output}

## Instructions
1. Read the ESCALATIONS block first and note the total. There may be NONE, ONE, or SEVERAL, and escalations can sit on a child account as well as the parent — the "On account" line says which.
   - SEVERAL: lead with the active ones, newest first. Say how many there are in total and whether they share a cause. Do not merge separate escalations into one story.
   - ONE: treat its justification field as the primary evidence. It usually states the trigger in the customer's own terms, so do not simply restate it.
   - NONE: say so plainly in SITUATION, then assess the account's risk from the other blocks instead — health, renewal dates in CONTRACTS, case volume and states, and installed footprint. The sections stay the same; only the lead signal changes.
2. Cross-reference against the other blocks. Specifically:
   - A justification mentioning a contract or renewal date: find that contract in CONTRACTS and name its number, end date and yearly value.
   - A justification mentioning uptime, reliability or device behaviour: use CASES and INSTALLED PRODUCTS to say how many cases exist, in which states, and on which product family.
   - A justification mentioning a deadline: say how much time remains relative to the raised date.
   - An escalation on a CHILD account: check whether that site also carries most of the cases, and say so if it does.
3. Weigh severity, trend and priority together and SAY SO WHEN THEY DISAGREE. A High Severity escalation carrying a Low priority is itself a finding worth surfacing, not a contradiction to smooth over.
4. Use only facts present in the context. Never invent a contract, case, date, product or person. If the context cannot support a section, say what is missing and what would answer it.
5. Reference specific record numbers, dates and figures wherever the context supplies them. A statement without a number is weaker than one with it.

## Output
Use these exact section delimiters so the consuming widget can parse them. Do NOT output JSON and do NOT wrap the response in markdown code fences.

===SITUATION===
Two to three sentences: what is escalated, by whom, since when, and the account's current health. State the escalation number.

===DRIVERS===
Three to five bullet lines, each starting with "- ". One driver per line, each tied to the evidence that supports it, naming the record number or figure. Order them by how strongly the context supports them.

===RISK===
Two to three sentences: what is commercially and operationally at stake if this is not addressed. Quantify with contract value, case volume or installed footprint where the context allows.

===ACTIONS===
Three to five numbered actions, most urgent first. Each on one line as "N. [action] — Owner: [role or named person from the context] — Why: [one clause]". Prefer a named owner from the context (escalation manager, key account manager) over a generic role. Only propose actions the context justifies.`,
                            },
                        ],
                    },
                ],
            },
        ],
    }
)
