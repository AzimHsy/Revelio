import { defineManifest } from '@crxjs/vite-plugin'
import pkg from '../package.json'

// MV3 manifest source. Edit this file, never the generated dist/manifest.json
// (see ai-workflow-rules.md → Protected Files).
export default defineManifest({
  manifest_version: 3,
  name: 'Revelio',
  version: pkg.version,
  description: pkg.description,
  action: {
    default_title: 'Open Revelio',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background/worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      js: ['src/content/index.ts'],
      matches: ['http://*/*', 'https://*/*'],
      run_at: 'document_idle',
    },
    {
      // MAIN-world extractor: the only code allowed to read window.gsap /
      // ScrollTrigger (architecture.md → invariant 1).
      js: ['src/injected/main.ts'],
      matches: ['http://*/*', 'https://*/*'],
      run_at: 'document_idle',
      world: 'MAIN',
    },
  ],
  // activeTab covers captureVisibleTab (thumbnail) + tabCapture (recording);
  // tabCapture records the tab, offscreen hosts the MediaRecorder (SWs can't).
  permissions: ['sidePanel', 'storage', 'activeTab', 'tabCapture', 'offscreen'],
  // The background worker calls the Claude API directly (single-user V1;
  // architecture.md → invariant 3/4).
  host_permissions: ['https://api.anthropic.com/*'],
  // Live preview: model-generated GSAP runs ONLY inside this sandboxed page
  // (opaque origin, no extension APIs, network blocked by its own CSP). It is
  // the single place generated code is allowed to execute.
  sandbox: {
    pages: ['src/sandbox/preview.html'],
  },
  content_security_policy: {
    // Locked down: only bundled scripts + eval (for new Function) run; no XHR/
    // fetch. Images/fonts are allowed so the cloned element renders with its real
    // assets (failed images fall back to a placeholder in the sandbox).
    sandbox:
      "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'unsafe-inline'; img-src * data: blob:; font-src * data:",
  },
  // The panel embeds the sandbox page in an <iframe>; MV3 blocks framing an
  // extension page ("This page has been blocked by Chrome") unless it is declared
  // web-accessible.
  web_accessible_resources: [
    {
      resources: ['src/sandbox/preview.html'],
      matches: ['<all_urls>'],
    },
  ],
})
