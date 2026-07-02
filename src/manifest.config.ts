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
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      js: ['src/content/index.ts'],
      matches: ['http://*/*', 'https://*/*'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['sidePanel', 'storage'],
})
