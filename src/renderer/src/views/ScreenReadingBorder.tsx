export function ScreenReadingBorder() {
  return (
    <main className="screen-reading-overlay" aria-label="ShowME is reading the captured screen">
      <span className="screen-reading-edge edge-top" />
      <span className="screen-reading-edge edge-right" />
      <span className="screen-reading-edge edge-bottom" />
      <span className="screen-reading-edge edge-left" />
      <span className="screen-reading-corner corner-top-left" />
      <span className="screen-reading-corner corner-top-right" />
      <span className="screen-reading-corner corner-bottom-left" />
      <span className="screen-reading-corner corner-bottom-right" />
    </main>
  );
}
