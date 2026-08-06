# Reference resolution

How `/compare` decides whether a supplied reference is actually usable. Loaded from the main
`SKILL.md` workflow at step 2, before any comparison happens. If none of the checks below pass for
the resolved reference type, the reference is **invalid** and the skill must stop rather than
compare against it.

## Screenshot or mockup image file

- **Resolve:** the path `$ARGUMENTS` names, or a path the user supplies in response to a
  clarifying question.
- **Validate:** `Read` the file. It is valid only if the read succeeds and returns actual image
  content (not a zero-byte file, not a placeholder, not a broken path that errors).
- **Invalid when:** the path doesn't exist, the read errors, or the file is present but empty/
  corrupted.
- **What "actually inspected" means:** the image was rendered and its content (composition,
  palette, type, imagery) was actually described from what was seen, not inferred from the
  filename.

## Reference URL

- **Resolve:** the URL `$ARGUMENTS` names.
- **Validate:** use whatever browsing tooling already exists and is wired up in this environment —
  the `/browse` skill, or an existing Playwright/Puppeteer setup already present in the repo.
  Navigate to the URL and actually view the rendered result (a real screenshot/capture, not a guess
  from the domain or URL path).
- **Invalid when:** no browsing tooling exists in this environment, the tooling exists but the
  navigation fails (timeout, DNS failure, 4xx/5xx, auth wall), or the page loads but renders no
  meaningful visual content (blank page, error page).
- **What "actually inspected" means:** a real navigate-and-capture happened and the captured result
  was actually viewed. Never describe a well-known site from prior knowledge instead of rendering
  the specific URL given — Universal changes and so does the live site; only the actual render
  counts as evidence.

## `DESIGN.md` or another design document

- **Resolve:** the path `$ARGUMENTS` names, defaulting to `DESIGN.md` at the repository or target
  package root if the user says "the design doc" without a path.
- **Validate:** `Read` the file. It is valid only if it exists and contains substantive design
  content — typography, color, composition, or component guidance — not an empty stub or a
  boilerplate template with no filled-in decisions.
- **Invalid when:** the path doesn't exist, or the file exists but is empty/templated with no real
  content to compare against.
- **What "actually inspected" means:** the document's actual stated decisions (not assumed
  defaults) are what get compared against the implementation.

## Selected Universal direction

- **Resolve:** the session string the user supplies (from a prior `/art-direct` run in this
  conversation, or one they paste in).
- **Validate:** call `get_art_direction_session` with that exact string. It is valid only if the
  call succeeds and the reported phase is `direction-selected` or later (e.g. `plan-created`) — an
  earlier phase (discovery, brief-only) has no selected direction yet to compare against.
- **Invalid when:** no session string is available at all, `get_art_direction_session` reports
  `INVALID_SESSION` (tampered/malformed/digest mismatch), or the session's phase is earlier than
  `direction-selected`.
- **What "actually inspected" means:** the direction's actual typography, color, composition, and
  motion decisions (and, once available, the Design Plan v2) are what get compared against the
  implementation — never a generic guess at "what the direction probably says."
- **Note:** Universal does not persist Art Director session state to disk by default, so
  `/compare` cannot look up a prior session on its own initiative. If the user references "the
  direction we picked" without supplying the session string, ask for it before treating this
  reference type as valid.

## Ambiguous or multiple references

If `$ARGUMENTS` names more than one reference (e.g., both a screenshot and a URL), validate each
independently and compare against every reference that validates. Report any reference that failed
validation in the same run as a limitation rather than silently dropping it.
