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
  permissions: ['sidePanel', 'storage'],
  // The background worker calls the Claude API directly (single-user V1;
  // architecture.md → invariant 3/4).
  host_permissions: ['https://api.anthropic.com/*'],
})
