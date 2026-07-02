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
  // activeTab is granted when the panel is opened via the toolbar action and
  // covers chrome.tabs.captureVisibleTab for the element-thumbnail screenshot.
  permissions: ['sidePanel', 'storage', 'activeTab'],
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
    sandbox:
      "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'unsafe-inline'",
  },
})
