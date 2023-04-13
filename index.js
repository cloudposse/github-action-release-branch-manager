const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const { execSync } = require('child_process');

const SEMVER_PATTERN = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const RELEASE_BRANCH_PREFIX = 'release/v';
const RELEASE_BRANCH_PATTERN = /^release\/v(?<major>[0-9]+)$/;


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
  return context.payload.release.tag_name;
}

function isSemver(version) {
  return SEMVER_PATTERN.test(version);
}

function getTargetBranch(context) {
    return context.payload.release.target_commitish;
}

function getDefaultBranch(context) {
  return context.payload.repository.default_branch;
}

function getTagCommit(context) {
  return context.sha;
}

function getMajor(version) {
  const match = version.match(SEMVER_PATTERN);
  return match?.groups?.major || '';
}

function doesMajorTagAlreadyExist(major, tagToExclude) {
  const tagMap = buildTagMap(getAllTags(), tagToExclude);
  return major in tagMap;
}

function getMajorFromReleaseBranch(releaseBranch) {
  const match = releaseBranch.match(RELEASE_BRANCH_PATTERN);
  return match?.groups?.major || '';
}

function getAllTags() {
  const output = execSync('git tag -l').toString();
  return output.split('\n').filter(Boolean);
}

function getPreviousCommit(sha) {
  const output = execSync(`git rev-parse ${sha}^`).toString();
  return output.trim();
}

function doesBranchExist(branchName) {
  try {
    execSync(`git rev-parse --verify ${branchName}`);
    return true;
  } catch (error) {
    return false;
  }
}

function createBranchFromCommitAndPush(branchName, commit) {
  execSync(`git checkout -b ${branchName} ${commit}`);
  execSync(`git push origin ${branchName}`);
}

function isBranchAReleaseBranch(branchName) {
  return RELEASE_BRANCH_PATTERN.test(branchName);
}

function buildTagMap(tags, tagToExclude) {
  const tagMap = {};

  for (const tag of tags) {
    if (!isSemver(tag)) {
      continue;
    }

    if (tag === tagToExclude) {
      continue;
    }

    const major = getMajor(tag);
    if (!(major in tagMap)) {
      tagMap[major] = [];
    }

    tagMap[major].push(tag);
  }

  return tagMap;
}

function readFile() {
  return new Promise((resolve, reject) => {
    fs.readFile('/Users/zinovii/github.on.publish.release.json', 'utf8', (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(JSON.parse(data));
      }
    });
  });
}

async function main() {
  // const github = await readFile();
  const context = github.context;

  try {
    validateGithubContext(context);

    const releaseTag = getReleaseTag(context);
    console.log(`Release tag: ${releaseTag}`);

    const targetBranch = getTargetBranch(context);
    console.log(`Target branch: ${targetBranch}`);

    const majorForReleaseTag = getMajor(releaseTag);
    console.log(`Major version for release tag branch: ${targetBranch}`);

    const defaultBranch = getDefaultBranch(context);
    console.log(`Default branch: ${defaultBranch}`);

    if (targetBranch == defaultBranch) {
      if (doesMajorTagAlreadyExist(majorForReleaseTag, releaseTag)) {
        console.log(`Major tag '${majorForReleaseTag}' for '${releaseTag}' already exists. All good.`);
        return;
      }

      const previousCommit = getPreviousCommit(getTagCommit(context));
      console.log(`Previous commit: ${previousCommit}`);

      const previousTag = parseInt(majorForReleaseTag, 10) - 1;
      const releaseBranchName = (majorForReleaseTag == '') ? `${RELEASE_BRANCH_PREFIX}0` : `${RELEASE_BRANCH_PREFIX}${previousTag}`;
      console.log(`Release branch to create: ${releaseBranchName}`);

      if(doesBranchExist(releaseBranchName)) {
        throw new ReleaseManagerError(`Branch '${releaseBranchName}' already exists`);
      }

      console.log(`Creating branch '${releaseBranchName}' from commit '${previousCommit}' and pushing it to origin`);
      createBranchFromCommitAndPush(releaseBranchName, previousCommit);
      console.log(`Created branch '${releaseBranchName}'`);
    } else if (isBranchAReleaseBranch(targetBranch)) {
      const majorForReleaseBranch = getMajorFromReleaseBranch(targetBranch);

      if (majorForReleaseTag == majorForReleaseBranch) {
        console.log(`Published release ${releaseTag} for release branch '${targetBranch}'. All good.`);
      } else {
        throw new ReleaseManagerError(`Major version in release tag '${releaseTag}' does not match release branch version '${targetBranch}'`);
      }
    } else {
      throw new ReleaseManagerError(`Target branch '${targetBranch}' is not a default or release branch`);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

await main();

// try {
// //   const body = core.getInput('body');
//   // const octokit = github.getOctokit(token);
//   // const context = github.context;

//   let context = '';
//   readFile().then(data => {
//     context = data;
//     // console.log(context);
//   }).catch(error => {
//     console.error(error);
//   });
//   console.log(context);

//   validateGithubContext(context);

//   console.log('repo', repo);
//   console.log('owner', owner);

// //   const response = await octokit.issues.create({
// //     owner,
// //     repo,
// //     title,
// //     body
// //   });

// //   core.setOutput('issue-number', response.data.number);
// } catch (error) {
//   core.setFailed(error.message);
// }