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
  const eventName = context.eventName;
  if (eventName != 'release') {
    throw new ReleaseManagerError(`Unsupported event '${eventName}'. Only supported event is 'release'`);
  }

  const releaseTag = getReleaseTag(context)
  if (!isSemver(releaseTag)) {
    throw new ReleaseManagerError(`Release tag '${releaseTag}' is not in SemVer format`);
  }
}

function getReleaseTag(context) {
  return context.payload.event.release.tagName;
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