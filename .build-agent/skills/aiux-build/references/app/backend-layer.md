# Backend Layer

> ## ⚠️ WEB IDE BOUNDARY — this file's pipeline section is superseded
>
> **There is no shell.** `pnpm run build` / `deploy` / `deploy:full` / `dev` cannot be run. See
> **`AGENTS.md`**.
>
> | Pack command | Here |
> | --- | --- |
> | `pnpm run build` | the **`build`** tool — **user action**, never run it yourself |
> | `pnpm run deploy` | the **`install`** tool — **user action** |
> | `pnpm run deploy:full` | ask the user to run `build` then `install` |
> | `pnpm run dev` (dev server / hot reload) | **no equivalent.** See the verification note below — the tool that replaces it is not safe on every surface |
>
> **Verifying after install — `ui_diagnostics` is NOT universally safe.** It gives a headless render
> with console, network and DOM capture for an ordinary platform page, **but on an AIUX/Lux portal
> route (`/aiux/<basename>/...`) it HANGS THE IDE** — measured, user-confirmed, no exception. For a
> Lux portal use the **`atf-cloud-runner` browser tools** instead: they drive a real browser out of
> process and return an accessibility snapshot you can diff. First load of a Lux page serves the
> stale SSR shell, so **reload once** — the tell that you are looking at the unhydrated shell is a
> page title still showing the custom-element tag name.
>
> Prepare the change, `run_diagnostics` it, report it ready, and ask the user to build and install. **Never
> claim a change works because it "would build".**
>
> **`fluent/` is not this skill's subject.** Fluent metadata (tables, roles, ACLs, modules) is authored in
> `src/fluent/**.now.ts` and governed by `explain_fluent_doc` / `search_fluent_docs` — read those, not this
> file map, and validate any server-side field access with a read-only `run_script` probe before shipping
> it (a build checks syntax; it cannot see a field that does not exist).
>
> The **Common Gotchas** and **Role/ACL Contract** sections below remain valid — the three-way scope
> alignment is directly checkable here with `fs_read_file` on `now.config.json`, `aiux.json` and
> `package.json`.
>
> One addition to Common Gotchas, measured here: the "Delete `dist/`" remedy is **half the fix**. Both
> `dist/` **and** `dist-metadata/` must be deleted — see `AGENTS.md` non-negotiable #1.

Scoped AIUX applications add ServiceNow metadata (tables, roles, ACLs, navigation) and a deploy pipeline via the Fluent SDK.

---

## Fluent SDK File Map

```
fluent/
├── update/
│   ├── sys_db_object/           # Table definitions
│   ├── sys_dictionary/          # Field definitions
│   ├── sys_user_role/           # Roles
│   ├── sys_security_acl/        # ACLs
│   ├── sys_app_module/          # Application navigation modules
│   └── sys_ai_agent/            # AI agent configurations (optional)
└── now.config.json              # Scope and scopeId
```

---

## Build & Deploy Pipeline — VOID in the Web IDE

The commands below are retained only so you can recognise them in other documentation. **Do not run them;
see the boundary block above.**

```bash
pnpm run build                  # -> the `build` tool (USER ACTION)
pnpm run deploy                 # -> the `install` tool (USER ACTION)
pnpm run deploy:full            # -> ask the user to run build, then install
```

`deploy:full` runs:

1. `pnpm build` — compiles app, generates widget XML
2. `pnpm deploy` — pushes to instance via Fluent SDK

---

## Common Gotchas

| Issue                            | Cause                                                           | Fix                                              |
| -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| Deploy fails with scope mismatch | `now.config.json`, `aiux.json`, `fluent/` have different scopes | Align all three                                  |
| Stale metadata on instance       | Cached old version                                              | Clear instance cache, re-deploy                  |
| Missing type definitions         | `dist/app` out of sync                                          | Delete `dist/` **and `dist-metadata/`**, rebuild |
| "Record not found" after deploy  | Role/ACL not deployed                                           | Check `sys_user_role` and `sys_security_acl` XML |
| Widget not visible on instance   | Missing `@discoverable(true)`                                   | Add decorator and rebuild                        |

---

## Role/ACL Contract

Three files must agree for a role-protected resource:

1. **`sys_user_role/`** — role definition XML
2. **`sys_security_acl/`** — ACL referencing the role
3. **Application code** — role checks in server scripts (`GlideRecordSecure`, `gs.hasRole()`)

For gating a page or widget, `@acl()` / `experienceAcls` is the current mechanism — see
`references/app/acl.md`. **Do not use `@roles()` for new gating**; v3.0.0 of this pack retires it.

---

## Dev Server

```bash
pnpm run dev    # Start local development server
```

**Void here** — there is no shell. See the boundary block.
