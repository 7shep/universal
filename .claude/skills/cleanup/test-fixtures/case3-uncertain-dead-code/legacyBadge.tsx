/* Fixture: appears unused by a directory-scoped text search (no local import), but is exported
   from an index barrel and referenced only through a string-keyed lookup table elsewhere in the
   fixture, simulating a generated/dynamic-reference case. A correct /cleanup run must classify this
   "uncertain" and retain it rather than deleting it on the strength of a shallow search. */
export function LegacyBadge({ label }: { label: string }) {
  return <span className="legacy-badge">{label}</span>;
}
