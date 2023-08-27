import { chmodSync } from 'node:fs'
import { posix } from 'node:path'

import { replaceInFileSync } from 'replace-in-file'

import type { GithubAction } from './github-action'

export const InjectBuild = {
  preSynthesize(project: GithubAction) {
    const releaseWorkflowFile = project.tryFindObjectFile(
      '.github/workflows/release.yml',
    )

    releaseWorkflowFile?.addOverride(
      'jobs.release.permissions.id-token',
      'write',
    )

    releaseWorkflowFile?.addOverride(
      'jobs.release_github.steps.13.if',
      `steps.commit.outputs.committed == 'true'`,
    )

    project.release?.publisher.publishToGitHubReleases({
      changelogFile: posix.join(
        project.artifactsDirectory,
        // @ts-expect-error ddd
        project.release.version.changelogFileName,
      ),
      versionFile: posix.join(
        project.artifactsDirectory,
        // @ts-expect-error ddd
        project.release.version.versionFileName,
      ),
      releaseTagFile: posix.join(
        project.artifactsDirectory,
        // @ts-expect-error ddd
        project.release.version.releaseTagFileName,
      ),
      prePublishSteps: [
        {
          name: 'Checkout',
          id: 'branch_exists',
          uses: 'actions/checkout@v3',
          continueOnError: true,
          with: {
            path: 'repo',
            'fetch-depth': 0,
            ref: 'latest',
          },
        },
        {
          name: 'Checkout',
          uses: 'actions/checkout@v3',
          if: "steps.branch_exists.outcome != 'success'",
          with: {
            path: 'repo',
            'fetch-depth': 0,
          },
        },
        {
          name: 'Checkout',
          uses: 'actions/checkout@v3',
          with: {
            path: 'main',
          },
        },
        {
          name: 'Create a branch if necessary',
          if: "steps.branch_exists.outcome != 'success'",
          run: 'git switch --orphan latest',
          workingDirectory: './repo',
        },
        {
          run: 'mv ./repo/.git ./.git',
        },
        { run: 'ls -la' },
        {
          run: 'cp ./main/action.yml action.yml',
        },
        {
          run: 'cp ./main/README.md README.md',
        },
        {
          id: 'major',
          run: `echo "version=$(cut -d '.' -f 1 ${posix.join(
            project.artifactsDirectory,
            // @ts-expect-error ddd
            project.release.version.versionFileName,
          )})" >> $GITHUB_OUTPUT`,
        },
        {
          id: 'commit',
          uses: 'EndBug/add-and-commit@v9',
          with: {
            push: 'origin latest --set-upstream --force',
            add: 'dist action.yml README.md',
            tag: 'v${{ steps.major.outputs.version }} --force',
            tag_push: '--force',
          },
        },
      ],
    })
  },

  postSynthesize() {
    chmodSync(posix.resolve('.github/workflows/release.yml'), '666')
    replaceInFileSync({
      files: '.github/workflows/release.yml',
      from: '--target $GITHUB_REF',
      to: '--target ${{ steps.commit.outputs.commit_long_sha }}',
    })
    chmodSync(posix.resolve('.github/workflows/release.yml'), '444')
  },
}
