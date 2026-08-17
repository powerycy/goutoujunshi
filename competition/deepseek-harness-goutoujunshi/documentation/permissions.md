# Permissions

The first version is a local single-user application. It has no server-side account roles or shared workspace claims.

| Resource | Read | Write | External side effect |
| --- | --- | --- | --- |
| Public synthetic case | Any local user | Reset/load locally | None |
| Temporary conversation | Current local session | Current local session | Optional model call only |
| Object profile | Current local user | Current object scope | None |
| Evidence import | Explicitly authorized local input | Current object scope after identity check | None |
| Refined memory | Current object and relevant question | User-confirmed adapter operation | None |
| Read-only Skill files | Whitelisted adapter only | Never | None |
| Model provider configuration | Harness official settings | Harness official settings | Calls configured provider |
| Message sending | Not available | Not available | Explicitly prohibited |

There is no database or row-level security in the Demo. Object isolation is enforced in domain functions and tested as an application invariant. A future multi-user deployment must add authenticated storage and server-enforced row-level authorization before accepting shared or remote data.
