/* Expected cleanup: collapse the redundant outer wrapper, but preserve the click handler, keyboard
   activation, focus, and semantics by using a real <button> instead of two nested divs. This is
   behavior-sensitive: it changes markup structure and the a11y tree, so it must be re-verified
   (keyboard activation still works, no visual/layout regression) rather than applied blindly. */
export function ConfirmButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <button type="button" className="confirm-inner" onClick={onConfirm}>
      Confirm
    </button>
  );
}
