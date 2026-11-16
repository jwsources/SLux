# Gotchas

Each one cost time once. Check this list when a result looks odd.

## Scripts and queries
- **Output is truncated at about 4 KB.** Print compact lines, slice long strings, and split big questions across scripts.
- **Noise in output.** Compiler stats, cache logs and "slow business rule" lines can appear around your prints. Read for your own lines.
- **A script can print nothing and do nothing.** One write script returned "no output" and changed nothing. After any write, read the record back with a separate query. Never report a write from the script alone.
- **Rate limits.** Background scripts may be limited (about five per minute in one setup). Batch your questions.
- **Protected and restricted.** Some script includes show `PROTECTEDSCRIPT:`. Some tables deny reads from the Global scope ("Security restricted... Restricted Caller Access"). Both mean "not checked", not "empty".
- **Display value versus value.** `getValue` gives the stored value (a sys_id for references). `getDisplayValue` gives the label. Mixing them produces silent zero-row queries.
- **Rhino, not modern JS.** Prefer `var`, plain functions and ES5 idioms in background scripts. Template literals and arrow functions may fail.
- **Counting by name patterns can match by accident.** A search for "pos" matched "Repository". Look at the results, not just the count.

## Auth and sessions
- **A 401 from a console `fetch` proves nothing.** The framework adds a session token header the console does not.
- **Impersonation does not move the assistant's session.** The chat session uses an OAuth token issued for the real login. With the page running as an impersonated user, the session can mismatch and the chat handshake fails (`sessionSuccess` false). Test chat features with real logins.
- **Tokens are secrets.** Do not paste them into chats or files. A decoded token's `sub` claim is a sys_id you can look up, which is a safe way to learn whose session it is.

## Writes
- **State, wait, write, read back.** See `SKILL.md`.
- **Business rules react.** Inserting or updating some records fires rules that touch other records. After a write, check what else changed in the last few minutes, not only the target record.
- **Cache.** Experience properties and similar config are cached. After changing one, tell the user to hard-reload before judging the result.
- **Something else may write the same record.** If a value you set changes back, compare `sys_mod_count` and `sys_updated_on` with your own writes before blaming a tool.
- **Prefer deactivate over delete** when a change might need to come back.

## Source reading
- **Check the installed version first.** Line numbers and behaviour change between releases.
- **Comments can be wrong or stale.** Confirm against the code path, and say when you only read a comment.
