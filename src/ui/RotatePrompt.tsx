/**
 * The full-screen "turn your phone sideways" gate. App.tsx renders it outside the scaled `.game`
 * root (so it is sized in physical CSS px, not logical px) whenever usePortraitBlock() is true;
 * nothing behind it can be tapped until the phone is turned.
 */
export function RotatePrompt() {
  return (
    <div className="rotate-prompt" role="alertdialog" aria-modal="true" aria-labelledby="rotate-title">
      <div className="rotate-phone" aria-hidden="true">
        <div className="rotate-phone-screen" />
      </div>
      <h2 id="rotate-title" className="western">
        Turn your phone sideways
      </h2>
      <p>Tally Two is played with your phone held horizontally.</p>
    </div>
  );
}
