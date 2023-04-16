const fs = require('fs');
const semver = require('semver');
const github = require('@actions/github');
const log4js = require('log4js');
const gitUtils = require('../src/git_utils.js');

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: { default: { appenders: ['console'], level: 'info' } },
});

const logger = log4js.getLogger();

const RELEASE_BRANCH_PREFIX = 'release/v';
const RELEASE_BRANCH_PATTERN = /^(refs\/heads\/)?release\/v(?<major>[0-9]+)$/;
const RESPONSE_REASON = {
  INVALID_EVENT_TYPE: 'INVALID_EVENT_TYPE',
  TAG_IS_NOT_SEMVER: 'TAG_IS_NOT_SEMVER',
  MAJOR_TAG_IS_0: 'MAJOR_TAG_IS_0',
  MAJOR_TAG_ALREADY_EXISTS: 'MAJOR_TAG_ALREADY_EXISTS',
  RELEASE_BRANCH_ALREADY_EXISTS: 'RELEASE_BRANCH_ALREADY_EXISTS',
  SUCCESSFULLY_CREATED_RELEASE_BRANCH: 'SUCCESSFULLY_CREATED_RELEASE_BRANCH',
  PUBLISHED_RELEASE_TO_RELEASE_BRANCH: 'PUBLISHED_RELEASE_TO_RELEASE_BRANCH',
  RELEASE_TAG_AND_RELEASE_BRANCH_DOESNT_MATCH: 'RELEASE_TAG_AND_RELEASE_BRANCH_DOESNT_MATCH',
  TARGET_BRANCH_SHOULD_BE_EITHER_DEFAULT_OR_RELEASE_BRANCH: 'TARGET_BRANCH_SHOULD_BE_EITHER_DEFAULT_OR_RELEASE_BRANCH',
};
const DEFAULT_PREVIOUS_TAG = '0.0.0';

class Response {
  constructor() {
    this.succeeded = false;
    this.reason = null;
    this.message = '';
  }
}

function getReleaseTag(context) {
  return context.payload.release.tag_name;
}

function isSemver(version) {
  return semver.valid(version) != null;
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
  return semver.major(version);
}

function doesMajorTagAlreadyExist(tags, major, tagToExclude) {
  const tagMap = buildTagMap(tags, tagToExclude);
  return major in tagMap;
}

function getMajorFromReleaseBranch(releaseBranch) {
  const match = releaseBranch.match(RELEASE_BRANCH_PATTERN);
  return match?.groups?.major || '';
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

function readFile(contextFile) {
  return new Promise((resolve, reject) => {
    fs.readFile(contextFile, 'utf8', (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(JSON.parse(data));
      }
    });
  });
}

function buildResponse(succeeded, reason, message) {
  const response = new Response();
  response.succeeded = succeeded;
  response.reason = reason;
  response.message = message;
  return response;
}

function getPreviousTag(tags, currentMajor) {
  let previousMajorTag = -1;
  let previousTag = DEFAULT_PREVIOUS_TAG;

  for (const tag of tags) {
    if (!isSemver(tag)) {
      continue;
    }

    const major = getMajor(tag);

    if (major == currentMajor) {
      continue;
    }

    if (previousMajorTag < major) {
      previousMajorTag = major;
      previousTag = tag;
    }
  }

  return previousTag;
}

async function main(workingDirectory, contextFile, doPush = true) {
  const repoPath = workingDirectory;

  let context;
  if (contextFile != null) {
    const github = await readFile(contextFile);
    context = github.context;
  } else {
    context = github.context;
  }

  const eventName = context.eventName;
  if (eventName != 'release') {
    return buildResponse(false, RESPONSE_REASON.INVALID_EVENT_TYPE,
      `Unsupported event '${eventName}'. Only supported event is 'release'`);
  }

  const releaseTag = getReleaseTag(context);
  logger.info(`Release tag: ${releaseTag}`);

  if (!isSemver(releaseTag)) {
    return buildResponse(false, RESPONSE_REASON.TAG_IS_NOT_SEMVER,
      `Release tag '${releaseTag}' is not in SemVer format`);
  }

  const targetBranch = getTargetBranch(context);
  logger.info(`Target branch: ${targetBranch}`);

  const majorForReleaseTag = getMajor(releaseTag);
  logger.info(`Major version for release tag branch: ${targetBranch}`);

  const defaultBranch = getDefaultBranch(context);
  logger.info(`Default branch: ${defaultBranch}`);

  if (majorForReleaseTag == 0) {
    return buildResponse(true, RESPONSE_REASON.MAJOR_TAG_IS_0,
      `Major version of release tag is '0'. No release branch will be created. All good.`);
  }

  gitUtils.gitCheckoutAtTag(repoPath, releaseTag);
  logger.info('Current state of repo:\n' + gitUtils.getCurrentStateOfRepo(repoPath));

  const tags = gitUtils.getAllTags(repoPath);

  if (targetBranch == defaultBranch || targetBranch == `refs/heads/${defaultBranch}`) {
    if (doesMajorTagAlreadyExist(tags, majorForReleaseTag, releaseTag)) {
      return buildResponse(true, RESPONSE_REASON.MAJOR_TAG_ALREADY_EXISTS,
        `Major tag '${majorForReleaseTag}' for '${releaseTag}' already exists. All good.`);
    }

    const previousTag = getPreviousTag(tags, majorForReleaseTag);
    logger.info(`Previous tag: ${previousTag}`);

    const previousMajorTag = getMajor(previousTag);
    logger.info(`Last major tag: ${previousMajorTag}`);

    const releaseBranchName = `${RELEASE_BRANCH_PREFIX}${previousMajorTag}`;
    logger.info(`Release branch to create: ${releaseBranchName}`);

    if (gitUtils.doesBranchExist(repoPath, releaseBranchName)) {
      return buildResponse(false, RESPONSE_REASON.RELEASE_BRANCH_ALREADY_EXISTS,
        `Branch '${releaseBranchName}' already exists`);
    }

    const previousCommit = previousTag == DEFAULT_PREVIOUS_TAG ?
      gitUtils.getPreviousCommit(repoPath, getTagCommit(context)) :
      gitUtils.getCommitForTag(repoPath, previousTag);
    logger.info(`Previous commit: ${previousCommit}`);

    logger.info(`Creating branch '${releaseBranchName}' from commit '${previousCommit}' and pushing it to origin`);
    gitUtils.createBranchFromCommitAndPush(repoPath, releaseBranchName, previousCommit, doPush);
    logger.info('Current state of repo:\n' + gitUtils.getCurrentStateOfRepo(repoPath));
    return buildResponse(true, RESPONSE_REASON.SUCCESSFULLY_CREATED_RELEASE_BRANCH, `Created branch '${releaseBranchName}'`);
  } else if (isBranchAReleaseBranch(targetBranch)) {
    const majorForReleaseBranch = getMajorFromReleaseBranch(targetBranch);

    if (majorForReleaseTag == majorForReleaseBranch) {
      return buildResponse(true, RESPONSE_REASON.PUBLISHED_RELEASE_TO_RELEASE_BRANCH,
        `Published release ${releaseTag} for release branch '${targetBranch}'. All good.`);
    } else {
      return buildResponse(false, RESPONSE_REASON.RELEASE_TAG_AND_RELEASE_BRANCH_DOESNT_MATCH,
        `Major version in release tag '${releaseTag}' does not match release branch version '${targetBranch}'`);
    }
  } else {
    return buildResponse(false, RESPONSE_REASON.TARGET_BRANCH_SHOULD_BE_EITHER_DEFAULT_OR_RELEASE_BRANCH,
      `Target branch '${targetBranch}' is not a default or release branch`);
  }
}

module.exports = { main, Response, RESPONSE_REASON };