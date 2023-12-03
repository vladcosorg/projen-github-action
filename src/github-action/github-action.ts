import { TypeScriptProject } from '@vladcos/projen-base'
import { YamlFile } from 'projen'
import { TypeScriptModuleResolution } from 'projen/lib/javascript'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { InjectBuild } from './inject-build'
import { RunsUsing } from './types/actions-metadata-model'

import type { Input } from './types/actions-metadata-model'
import type { GitHubActionMetadata } from './types/github-action-metadata'
import type { TypeScriptProjectOptions } from '@vladcos/projen-base'

export * from './types/actions-metadata-model'
export type * from './types/github-action-metadata'
/**
 * Properties for creating a GitHubActionTypeScriptProject.
 */
export interface GitHubActionTypeScriptOptions
  extends TypeScriptProjectOptions {
  /**
   * Options for the GitHub Action metadata stored in `action.yml`.
   *
   * @default - an action named after the project `name` that runs from `dist/index.js`.
   */
  readonly actionMetadata?: GitHubActionMetadata
}
export class GithubAction extends TypeScriptProject {
  readonly inputsPath?: string
  readonly actionsFile: YamlFile

  constructor(options: GitHubActionTypeScriptOptions) {
    super({
      ...options,
      releaseToNpm: false,
      vitest: true,
      defaultReleaseBranch: 'main',
      tsconfigDev: {
        compilerOptions: {
          module: 'ES2022',
          moduleResolution: TypeScriptModuleResolution.BUNDLER,
        },
      },
      entrypoint: './mjs/index.mjs',
    })

    // standard GitHub action packages
    this.addDeps(
      '@actions/core',
      '@actions/github@6',
      '@actions/core',
      '@actions/exec',
    )

    // package as a single runnable .js file in /dist
    this.addDevDeps(
      '@vercel/ncc',
      'tsconfig-paths',
      'zod-to-json-schema',
      'replace-in-file',
    )
    this.packageTask.reset('ncc build --source-map --license licenses.txt')
    this.package.addField('type', 'module')

    this.package.addField('packemon', [
      {
        inputs: { index: 'src/index.ts' },
        format: 'mjs',
        platform: 'node',
        support: 'current',
      },
    ])

    this.addGitIgnore('/dist/')
    this.annotateGenerated('/dist/**')
    this.addGitIgnore('/mjs')
    this.annotateGenerated('/mjs/**')

    // Create metadata for projen managed `action.yml` file.
    const defaultMetadataOptions: GitHubActionTypeScriptOptions['actionMetadata'] =
      {
        name: this.name,
        description: `A GitHub Action for ${this.name}`,
        runs: {
          using: RunsUsing.NODE_16,
          main: 'dist/index.js',
        },
      }

    const output = {
      ...defaultMetadataOptions,
      ...options.actionMetadata,
      inputs:
        typeof options.actionMetadata?.inputs === 'string'
          ? {}
          : options.actionMetadata?.inputs,
    }

    if (typeof options.actionMetadata?.inputs === 'string') {
      this.inputsPath = options.actionMetadata.inputs
    }

    this.actionsFile = new YamlFile(this, 'action.yml', {
      obj: output,
    })

    this.addDeps('zod')
  }

  preSynthesize() {
    super.preSynthesize()
    // console.log(
    //   this.components.filter(
    //     (comp) => comp instanceof FileBase && comp.readonly,
    //   ),
    // )
    this.package.addField('packemon', {
      format: 'mjs',
      platform: 'node',
      support: 'current',
    })
    this.compileTask.reset('packemon build --loadConfigs --no-addFiles')
    InjectBuild.preSynthesize(this)
  }

  postSynthesize() {
    super.postSynthesize()

    if (!this.inputsPath) {
      return
    }
    const schema = zodToJsonSchema(require(this.inputsPath).default()) as {
      properties: Record<string, { default?: unknown; description?: string }>
      required: string[]
    }
    InjectBuild.postSynthesize()
    this.actionsFile.addOverride(
      'inputs',
      Object.fromEntries(
        Object.keys(schema.properties).map<[string, Input]>((key) => [
          kebabCase(key),
          {
            description: schema.properties[key].description ?? 'No description',
            required: schema.required.includes(key),
            default: schema.properties[key].default as string,
          },
        ]),
      ),
    )
    this.actionsFile.synthesize()
  }
}

function kebabCase(input: string) {
  // eslint-disable-next-line unicorn/prefer-string-replace-all
  return input.replace(
    /[A-Z]+(?![a-z])|[A-Z]/g,
    ($, ofs) => (ofs ? '-' : '') + $.toLowerCase(),
  )
}
