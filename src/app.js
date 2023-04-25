const semver = require('semver');
const { logger } = require('./utils.js');
const GitWrapper = require('../src/git_wrapper.js');
const GitHubWrapper = require('../src/github_wrapper.js');

const RELEASE_BRANCH_PREFIX = 'release/v';
const RESPONSE_REASON = {
  NO_CHANGES: 'NO_CHANGES',
  CREATED_BRANCHES: 'CREATED_BRANCHES',
};

class Response {
  constructor(succeeded, reason, message, data) {
    this.succeeded = succeeded;
    this.reason = reason;
    this.message = message;
    this.data = data;
  }
}

function getDefaultBranch(context) {
  return context.payload.repository.default_branch;
}

function isSemver(version) {
  return semver.valid(version) != null;
}

function getLatestSemVerTagsForPerMajor(tags) {
  const latestTagsPerMajorVersion = new Map();

  for (const tag of tags) {
    if (isSemver(tag)) {
      const major = semver.major(tag);
      const key = `${major}`;

      if (!latestTagsPerMajorVersion.has(key)) {
        latestTagsPerMajorVersion.set(key, tag);
      }
    }
  }

  return latestTagsPerMajorVersion;
}

async function updateGitHubRelease(githubWrapper, releaseBranch, tag) {
  const release = await githubWrapper.findReleaseByTag(tag);

  if (release != null) {
    if (release.target_commitish !== releaseBranch) {
      logger.info(`Release for tag (${tag}) already exists but has incorrect target_commitish (${release.target_commitish}). Updating to ${releaseBranch}.`);
      await githubWrapper.updateTargetCommitish(release.id, releaseBranch);
    } else {
      logger.info(`Release for tag (${tag}) already exists and has correct target_commitish (${releaseBranch}).`);
    }
  } else {
    logger.info(`Release for tag (${tag}) does not exist. Creating.`);
    await githubWrapper.createReleaseForTag(tag, releaseBranch);
  }
}

async function main(repoPath, minimalVersion, context, token, doPush = true) {
  try {
    const defaultBranch = getDefaultBranch(context);
    const gitWrapper = new GitWrapper(repoPath);
    const repoFullName = context.payload.repository.full_name;
    const githubWrapper = new GitHubWrapper(token, repoFullName);

    const allTags = await gitWrapper.getAllTags();
    logger.debug(`All available tags:\n${allTags.join('\n')}`);

    const latestSemVerTagsPerMajor = getLatestSemVerTagsForPerMajor(allTags);
    logger.info(`Latest SemVer tags:\n${Array.from(latestSemVerTagsPerMajor.values()).join('\n')}`);

    if (latestSemVerTagsPerMajor.size === 0) {
      return new Response(true, RESPONSE_REASON.NO_CHANGES, 'No SemVer tags found', {});
    }

    let highestMajor = -1;
    for (const major of latestSemVerTagsPerMajor.keys()) {
      const majorInt = parseInt(major);
      if (majorInt > highestMajor) {
        highestMajor = majorInt;
      }
    }

    const responseData = {};

    for (const [major, tag] of latestSemVerTagsPerMajor) {
      const releaseBranch = `${RELEASE_BRANCH_PREFIX}${major}`;
      const releaseBranchExists = await gitWrapper.branchExists(releaseBranch);

      await gitWrapper.checkout(defaultBranch);

      if (releaseBranchExists) {
        logger.info(`Release branch '${releaseBranch}' for major tag ${major} already exists. Skipping.`);
        continue;
      }

      if (major < minimalVersion) {
        logger.info(`Skipping creation of release branch '${releaseBranch}' for tag (${tag}) as it is below the minimal version.`);
        continue;
      }

      if (major === `${highestMajor}`) {
        logger.info(`Skipping creation of release branch '${releaseBranch}' for tag (${tag}) as it is the highest major version.`);
        continue;
      }

      await gitWrapper.checkout(tag);
      await gitWrapper.createBranch(releaseBranch, tag);

      logger.info(`Created release branch '${releaseBranch}' for tag (${tag}).`);

      if (doPush) {
        logger.info(`Pushing release branch '${releaseBranch}' to remote.`);
        await gitWrapper.pushToRemote(releaseBranch);

        // In order for "release-drafter" to update versions in order we have to make sure that the release points to the correct release branch.
        // To achieve this we have to make sure that target_commitish is set to the release branch.
        logger.info(`Updating 'target_commitish' in GitHub release for tag ${tag} if needed.`);
        await updateGitHubRelease(githubWrapper, releaseBranch, tag);
      }

      responseData[releaseBranch] = tag;
    }

    if (Object.keys(responseData).length === 0) {
      return new Response(true, RESPONSE_REASON.NO_CHANGES, 'No changes were made', {});
    } else {
      return new Response(true, RESPONSE_REASON.CREATED_BRANCHES, `Successfully created release branches`, responseData);
    }
  } catch (error) {
    logger.error(error);
    return new Response(false, null, error.message, {});
  }
}

module.exports = { main, Response, RESPONSE_REASON };