# Introspection recipes (read-only)

All snippets are server-side background scripts (Rhino). Print with `gs.print`. Replace the `<...>` placeholders. Run them in the scope the user expects (usually `global`) and keep output small: it is truncated at about 4 KB.

## Which table does a reference field point to?
```js
var d = new GlideRecord('sys_dictionary');
d.addQuery('name', '<table>'); d.addQuery('element', '<field>'); d.query();
if (d.next()) gs.print('references: ' + d.getValue('reference'));
```
Do this before guessing a table name. A wrong table name throws `invalid table name`.

## Does a table exist, and does it have rows?
```js
var t = new GlideRecord('sys_db_object');
t.addQuery('name', 'STARTSWITH', '<prefix>'); t.orderBy('name'); t.setLimit(60); t.query();
while (t.next()) {
  var n = t.getValue('name'), c = new GlideAggregate(n);
  c.addAggregate('COUNT'); c.query(); c.next();
  gs.print(n + ' [' + t.getValue('label') + '] rows=' + c.getAggregate('COUNT'));
}
```
A table whose count prints `null` or errors is usually scope-restricted from the caller, not empty. Treat it as "not checked".

## List a table's fields before querying them
```js
var g = new GlideRecord('<table>'), e = g.getElements(), f = [];
for (var i = 0; i < e.size(); i++) { var n = e.get(i).getName(); if (!/^sys_/.test(n)) f.push(n); }
gs.print(f.join(','));
```

## Counts grouped by a field
```js
var a = new GlideAggregate('<table>');
a.addQuery('<field>', '<value>'); a.addAggregate('COUNT'); a.groupBy('<groupField>'); a.query();
while (a.next()) gs.print(a.<groupField>.getDisplayValue() + ' = ' + a.getAggregate('COUNT'));
```

## Who holds a role?
```js
var h = new GlideRecord('sys_user_has_role');
h.addQuery('role.name', '<role_name>'); h.query();
while (h.next()) gs.print(h.getDisplayValue('user') + ' inherited=' + h.getValue('inherited'));
```
Also check which roles CONTAIN it: `sys_user_role_contains` with `contains=<role sys_id>`.

## What gates a REST endpoint?
1. Find the operation: `sys_ws_operation` where `operation_uri CONTAINS '<path>'` (read `operation_script`, `requires_acl_authorization`).
2. Find its definition: `sys_ws_definition`; note `enforce_acl`.
3. Find the ACL and its roles: `sys_security_acl` (type REST_Endpoint, check `admin_overrides`) and `sys_security_acl_role`.
A 401 from a plain `fetch` in the browser console usually means the framework's session token header is missing, not that the user lacks a role. Do not conclude "no access" from a console fetch.

## What changed recently?
```js
var p = new GlideRecord('sys_properties');
p.addQuery('sys_updated_on', '>', gs.daysAgo(3)); p.orderByDesc('sys_updated_on'); p.setLimit(25); p.query();
while (p.next()) gs.print(p.getValue('sys_updated_on') + ' | ' + p.getValue('sys_updated_by') + ' | ' + p.getValue('name'));
```
Most results are job timestamps. Filter by name pattern for the feature you care about.

## Who changed this record?
- `sys_audit` (`documentkey=<sys_id>^fieldname=<field>`) only has rows if auditing is on for that table. Empty does not mean "never changed".
- `sys_update_xml` (`name=<table>_<sys_id>`) shows captured changes and their update set. Changes made through the table API in another scope may not appear.
- `sys_updated_on`, `sys_updated_by` and `sys_mod_count` on the record itself always exist. A mod count higher than the writes you made means someone else wrote it.
If none of these answer it, say "writer unknown" and propose turning on auditing for that table as a write.

## Run the app's own code to verify
```js
var out = new <ScriptInclude>().<method>(<args>);
gs.print(JSON.stringify(out));
```
Use this when a server function decides the outcome (access checks, lookups, validators). It also works when the script include's source is protected.

## Read a script include's source
```js
var s = new GlideRecord('sys_script_include'); s.addQuery('name', '<Name>'); s.query();
if (s.next()) gs.print(s.getValue('script').slice(0, 3500));
```
If the output is `PROTECTEDSCRIPT:`, the source is hidden. Use "run the app's own code" instead.

## Walk from an agent or skill to its tools and inputs
Follow the references in the dictionary rather than assuming the chain. Start from the agent record, read its tool assignments, then each tool's script and input schema.
