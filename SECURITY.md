# Security Policy

## Supported versions

Universal is in active early development and does not yet publish stable release branches. Security
fixes are applied to the latest code on `main`. Older commits, forks, and unmerged branches are not
supported.

## Report a vulnerability

Do not open a public issue for a suspected vulnerability.

Email [shepedits@gmail.com](mailto:shepedits@gmail.com) with the subject
`Universal security report` and include:

- the affected package, application, MCP tool, or commit;
- the impact and conditions required to reproduce it;
- minimal reproduction steps or a proof of concept;
- any suggested mitigation; and
- whether the report contains information that should remain private.

Remove unrelated secrets, tokens, private prompts, and personal data. Do not access data that does
not belong to you or disrupt services while investigating.

The maintainer will coordinate validation, remediation, disclosure timing, and credit by email.
Please keep the report confidential until a fix or coordinated disclosure is published.

## Security-sensitive areas

Reports are especially useful around:

- MCP input validation and protocol output;
- generated-project paths and filesystem boundaries;
- process execution and lifecycle management;
- preview isolation and cross-origin messages;
- prompt or log handling that may expose secrets; and
- dependency or build-pipeline compromise.
