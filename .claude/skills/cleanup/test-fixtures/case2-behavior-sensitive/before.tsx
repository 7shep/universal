/* Fixture: redundant wrapper div that also happens to carry the only click handler and the only
   focus-relevant tabIndex — removing it naively would delete behavior, not just markup. */
export function ConfirmButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="confirm-wrap">
      <div className="confirm-inner" onClick={onConfirm} tabIndex={0} role="button">
        Confirm
      </div>
    </div>
  );
}
