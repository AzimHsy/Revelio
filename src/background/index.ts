// Background service worker.
// Scaffold scope: only wire the toolbar action to open the side panel so the
// extension is verifiable in Chrome. The Claude API call and message brokering
// (architecture.md → src/background) come in later units.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[revelio] setPanelBehavior failed', error))
