const fs = require('fs');
const github = require('@actions/github');
const log4js = require('log4js');
const gitUtils = require('../src/git_utils.js');

log4js.configure({
  appenders: {
    console: { type: 'console' },
  },
  categories: {
    default: { appenders: ['console'], level: 'info' }
  }
});

const logger = log4js.getLogger();

const SEMVER_PATTERN = /^(?<major>[0-9]+)\.(?<minor>[0-9]+)\.(?<patch>[0-9]+)$/;
const RELEASE_BRANCH_PREFIX = 'release/v';
const RELEASE_BRANCH_PATTERN = /^release\/v(?<major>[0-9]+)$/;
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

function doesMajorTagAlreadyExist(repoPath, major, tagToExclude) {
  const tagMap = buildTagMap(gitUtils.getAllTags(repoPath), tagToExclude);
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

async function main(workingDirectory, contextFile, doPush = true) {
  let context;
  if (contextFile != null) {
    const github = await readFile(contextFile);
    context = github.context;
  } else {
    context = github.context;
  }

  const response = new Response();

  const eventName = context.eventName;
  if (eventName != 'release') {
    response.succeeded = false;
    response.reason = RESPONSE_REASON.INVALID_EVENT_TYPE;
    response.message = `Unsupported event '${eventName}'. Only supported event is 'release'`;
    logger.error(response.message);
    return response;
  }

  const releaseTag = getReleaseTag(context)
  logger.info(`Release tag: ${releaseTag}`);

  if (!isSemver(releaseTag)) {
    response.succeeded = false;
    response.reason = RESPONSE_REASON.TAG_IS_NOT_SEMVER;
    response.message = `Release tag '${releaseTag}' is not in SemVer format`;
    logger.error(response.message);
    return response;
  }

  const targetBranch = getTargetBranch(context);
  logger.info(`Target branch: ${targetBranch}`);

  const majorForReleaseTag = getMajor(releaseTag);
  logger.info(`Major version for release tag branch: ${targetBranch}`);

  const defaultBranch = getDefaultBranch(context);
  logger.info(`Default branch: ${defaultBranch}`);

  if (majorForReleaseTag == '0') {
    response.succeeded = true;
    response.reason = RESPONSE_REASON.MAJOR_TAG_IS_0;
    response.message = `Major version of release tag is '0'. No release branch will be created. All good.`;
    logger.error(response.message);
    return response;
  }

  repoPath = workingDirectory;

  process.chdir(workingDirectory);

  if (targetBranch == defaultBranch) {
    if (doesMajorTagAlreadyExist(workingDirectory, majorForReleaseTag, releaseTag)) {
      response.succeeded = true;
      response.reason = RESPONSE_REASON.MAJOR_TAG_ALREADY_EXISTS;
      response.message = `Major tag '${majorForReleaseTag}' for '${releaseTag}' already exists. All good.`;
      logger.info(response.message);
      return response;
    }

    const previousCommit = gitUtils.getPreviousCommit(repoPath, getTagCommit(context));
    logger.info(`Previous commit: ${previousCommit}`);

    const previousTag = Math.max(parseInt(majorForReleaseTag, 10) - 1, 0);
    const releaseBranchName = (majorForReleaseTag == '') ? `${RELEASE_BRANCH_PREFIX}0` : `${RELEASE_BRANCH_PREFIX}${previousTag}`;
    logger.info(`Release branch to create: ${releaseBranchName}`);

    if (gitUtils.doesBranchExist(repoPath, releaseBranchName)) {
      response.succeeded = false;
      response.reason = RESPONSE_REASON.RELEASE_BRANCH_ALREADY_EXISTS;
      response.message = `Branch '${releaseBranchName}' already exists`;
      logger.info(response.message);
      return response;
    }

    logger.info(`Creating branch '${releaseBranchName}' from commit '${previousCommit}' and pushing it to origin`);
    gitUtils.createBranchFromCommitAndPush(repoPath, releaseBranchName, previousCommit, doPush);
    response.succeeded = true;
    response.reason = RESPONSE_REASON.SUCCESSFULLY_CREATED_RELEASE_BRANCH;
    response.message = `Created branch '${releaseBranchName}'`;
    logger.info(response.message);

    return response;
  } else if (isBranchAReleaseBranch(targetBranch)) {
    const majorForReleaseBranch = getMajorFromReleaseBranch(targetBranch);

    if (majorForReleaseTag == majorForReleaseBranch) {
      response.succeeded = true;
      response.reason = RESPONSE_REASON.PUBLISHED_RELEASE_TO_RELEASE_BRANCH;
      response.message = `Published release ${releaseTag} for release branch '${targetBranch}'. All good.`;
      logger.info(response.message);

      return response;
    } else {
      response.succeeded = false;
      response.reason = RESPONSE_REASON.RELEASE_TAG_AND_RELEASE_BRANCH_DOESNT_MATCH;
      response.message = `Major version in release tag '${releaseTag}' does not match release branch version '${targetBranch}'`;
      logger.error(response.message);

      return response;
    }
  } else {
    response.succeeded = false;
    response.reason = RESPONSE_REASON.TARGET_BRANCH_SHOULD_BE_EITHER_DEFAULT_OR_RELEASE_BRANCH;
    response.message = `Target branch '${targetBranch}' is not a default or release branch`;

    logger.error(response.message);

    return response;
  }
}

module.exports = { main, Response, RESPONSE_REASON };