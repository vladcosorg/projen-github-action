import { CustomJsii } from '@vladcos/projen-base'

const project = new CustomJsii({
  name: '@vladcos/projen-github-action',
  repositoryUrl: 'https://github.com/vladcos/projen-github-action',
})

project.synth()
