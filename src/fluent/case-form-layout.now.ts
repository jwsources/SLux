import { Record } from '@servicenow/sdk/core'

/**
 * Adds two fields to the Customer Service Case DEFAULT form view.
 *
 * WHY THIS EXISTS
 * The Record Intelligence View resolves its layout config by table plus an
 * encoded condition, and renders the Details view from the table's form
 * layout. Both paths read fields through the record package's FormAPI, and
 * FormAPI.fields exposes ONLY fields present in the resolved form layout.
 *
 * Measured on this instance before writing this file: neither field below was
 * on ANY of the 50 form sections for this table (571 elements scanned; control
 * fired - `number` appears on 12 sections). So:
 *   - the config condition x_snc_pmdemo_regulatory_flag=reportable could never
 *     match, and the richness gate would silently fall back to the default
 *     config - working-looking code that never offers the Intelligent view;
 *   - the design's "Reportable event" chip and the account fact had no
 *     reachable source, and Details could never list either field.
 *
 * PLACEMENT
 * Target section 9484277dc312310015519f2974d3aecd is the main unnamed section
 * of the Default view (22 elements, positions 0-21). Both records APPEND at
 * 22 and 23, after `follow_the_sun` and outside the split - so no existing
 * platform record is modified and nothing is renumbered. Removing these two
 * records restores the shipped layout exactly.
 *
 * CONTRACT, read from the instance rather than assumed
 * sys_ui_element carries only: element, position, sys_ui_section (ref), type,
 * sys_ui_formatter (ref), sys_user (ref). A PLAIN FIELD element has `type`
 * EMPTY - measured: 400 of 547 elements on this table have no type, and the
 * non-empty values are structural (.split / .begin_split / .end_split),
 * 'formatter', or 'list'. `type` is therefore omitted here on purpose:
 * Record() does not apply platform defaults, so an omitted field is left
 * unset, which is precisely a plain field element. Setting type to
 * 'formatter' would make the platform look for a sys_ui_formatter and render
 * nothing.
 *
 * sys_ui_section is a PLATFORM record, not one of ours, so it is referenced by
 * sys_id string - which is what the Record() API documents for records outside
 * the app. Note the API only resolves a reference by NAME when the SDK holds
 * the target table's schema; it does not here, so a raw sys_id is both correct
 * and the only reliable form. The sys_id is stable on this instance; if this
 * app is ever installed elsewhere, re-resolve it by querying sys_ui_section
 * for name=sn_customerservice_case with the Default view.
 *
 * SIDE EFFECT, accepted deliberately by the app owner: these fields now appear
 * on the native Customer Service Case form for every user of that form, not
 * only inside this experience.
 */

const CASE_DEFAULT_MAIN_SECTION = '9484277dc312310015519f2974d3aecd'

/**
 * The main (uncaptioned) section of the CASE view -- the agent-facing form the
 * record page reads, selected by formView: 'case' in the layout config.
 *
 * Measured: max element position 28.
 */
const CASE_VIEW_MAIN_SECTION = 'fa71b240c332310015519f2974d3ae62'

/**
 * State, on the CASE view.
 *
 * WHY: `state` is absent from ALL FIVE sections of the case view -- measured,
 * has_state false on every one. The Default view carried it, so pointing the
 * record page at the case view silently dropped it, with TWO visible effects:
 *   - Details lost the State field entirely;
 *   - the header's State chip vanished, because _chipsFrom resolves a chip
 *     through formApi.fields and an absent field yields no chip.
 * One missing form element, two symptoms that looked unrelated.
 *
 * State is a core task field and its absence from an agent case form is a data
 * quirk rather than a design statement, so it is added rather than worked
 * around in the component.
 *
 * POSITION 29 -- appended after the current maximum of 28, so no existing
 * element is modified or renumbered and the shipped layout is restored exactly
 * by removing this record. The cost of appending rather than inserting is that
 * State renders at the END of the section instead of beside Priority;
 * inserting mid-section would mean renumbering platform records, which is not
 * worth the blast radius.
 */
export const uiElementCaseViewState = Record({
    $id: Now.ID['ui-el-case-view-state'],
    table: 'sys_ui_element',
    data: {
        sys_ui_section: CASE_VIEW_MAIN_SECTION,
        element: 'state',
        position: 29,
    },
})

/**
 * Regulatory Flag, on the CASE view.
 *
 * The companion record below puts this field on the DEFAULT view, which was
 * the view the record page read at the time. It no longer is: the layout
 * config now names formView 'case', and the case view does NOT carry this
 * field -- so the header's regulatory chip resolved against a field that was
 * not in formApi.fields and silently rendered nothing. Measured on CS0001623,
 * which HAS the flag set to 'reportable': the header showed Priority, Major
 * case and the unassigned warning, and no regulatory chip at all.
 *
 * Choice values, read from sys_choice: not_reportable, reported, reportable,
 * needs_review. The chip must render the LABEL, never the raw value.
 *
 * Position 30, appended after State at 29 for the same non-destructive reason.
 */
export const uiElementCaseViewRegulatoryFlag = Record({
    $id: Now.ID['ui-el-case-view-regulatory-flag'],
    table: 'sys_ui_element',
    data: {
        sys_ui_section: CASE_VIEW_MAIN_SECTION,
        element: 'x_snc_pmdemo_regulatory_flag',
        position: 30,
    },
})

/**
 * Account. Exists as a column on the case table and is populated, but the
 * shipped Default view carries `company` instead - so the header's account
 * line and PartyCard's account fact had no reachable value.
 */
export const uiElementCaseAccount = Record({
    $id: Now.ID['ui-el-case-account'],
    table: 'sys_ui_element',
    data: {
        sys_ui_section: CASE_DEFAULT_MAIN_SECTION,
        element: 'account',
        position: 22,
    },
})

/**
 * Regulatory Flag - a choice field owned by the PMDemo scope with values
 * not_reportable / reported / reportable / needs_review (read from sys_choice).
 * Drives both the richness-gate condition and the design's critical
 * "Reportable event" chip. The chip must render the CHOICE LABEL, never the
 * raw value.
 */
export const uiElementCaseRegulatoryFlag = Record({
    $id: Now.ID['ui-el-case-regulatory-flag'],
    table: 'sys_ui_element',
    data: {
        sys_ui_section: CASE_DEFAULT_MAIN_SECTION,
        element: 'x_snc_pmdemo_regulatory_flag',
        position: 23,
    },
})
