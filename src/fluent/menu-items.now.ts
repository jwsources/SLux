import { Record } from '@servicenow/sdk/core'

/**
 * Sidebar entries for this extension's pages.
 *
 * WHY THIS FILE EXISTS: the Employee Slate host does not build its left menu
 * from the AIUX nav layout — it renders the `employee-sidebar` widget, which is
 * driven by `sys_aix_menu_item` rows under the host's "Employee Menu". The
 * `addNavItem()` helpers write to `navLayoutContext`, which nothing on this
 * host reads, so nav contributed that way never appears. Menu rows are the
 * only mechanism that works here.
 *
 * `menu` points at the host's Employee Menu record, which is NOT part of this
 * app, so it is given as a raw sys_id string (per record-api: pass a record
 * variable only for same-app records; `Now.ID[...]` inside `data` would write
 * the literal key and leave the reference blank).
 *
 * These rows belong to THIS app, so they install and uninstall with it rather
 * than permanently mutating host configuration.
 */

const EMPLOYEE_MENU = '2ad6b4edff9e7210f4a0ffffffffff8a'

/**
 * The navigation graph — this app's entry point into the portal.
 *
 * ⚠️ REGISTERING A ROUTE AS A MENU DESTINATION IS WHAT REMOVES THE HOST'S BACK
 * CHROME. A route the host does not know as a menu item is treated as a deep
 * page, so it gets wrapped in a white page container with a back arrow. That
 * wrapper is the outermost box in the box-in-box problem and it also constrains
 * the content width.
 *
 * For the graph that is exactly what we want: it is a landing surface, not a
 * record opened from somewhere, so it should have no back button and should use
 * the full width. The case and record pages are deliberately NOT registered
 * here — they are deep pages reached from the graph, and the host's back
 * chrome is correct for them.
 *
 * `order` 5 places it after the host's own items (Home 0, Canvas 1, Tasks and
 * requests 2, Org chart 3, Explore 4).
 */
export const navigationGraphMenuItem = Record({
    $id: Now.ID['menu-item-graph'],
    table: 'sys_aix_menu_item',
    data: {
        menu: EMPLOYEE_MENU,
        title: 'Accounts & cases',
        icon: 'change-outline',
        target_type: 'url',
        target_url: '/graph',
        order: 5,
        active: true,
        type: 'action',
    },
})
