const core = require('@actions/core');
const github = require('@actions/github');

const SEMVER_PATTERN = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

class ReleaseManagerError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

function validateGithubContext(context) {
  const event_name = context.payload.event_name;
  if (event_name != 'release') {
    throw new ReleaseManagerError(`Unsupported event '${event_name}'. Only supported event is 'release'`);
  }

  const release_tag = get_release_tag(github_object)
  if (!isSemver(release_tag)) {
    throw new ReleaseManagerError(`Release tag '${release_tag}' is not in SemVer format`);
  }
}

function get_release_tag(context) {
  return context.payload.event.release.tag_name;
}

function isSemver(version) {
  return SEMVER_PATTERN.test(version);
}

try {
//   const body = core.getInput('body');
  // const octokit = github.getOctokit(token);
  const context = github.context;

  validateGithubContext(context);

  console.log('repo', repo);
  console.log('owner', owner);

//   const response = await octokit.issues.create({
//     owner,
//     repo,
//     title,
//     body
//   });

//   core.setOutput('issue-number', response.data.number);
} catch (error) {
  core.setFailed(error.message);
}