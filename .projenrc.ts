import { CustomJsii } from '@vladcos/projen-base'

const project = new CustomJsii({
  name: '@vladcos/projen-github-action',
  repositoryUrl: 'https://github.com/vladcos/projen-github-action',
  deps: ['@vladcos/projen-base@../projen-base'],
  peerDeps: ['projen@0.72.19'],
})

// project.addDeps('zod-to-json-schema', 'zod')
// project.addBundledDeps('zod-to-json-schema', 'zod')
project.synth()
