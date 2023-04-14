const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const TMP_DIR = os.tmpdir();

function getAllTags(repoPath) {
  const output = execSync('git tag --sort=-v:refname', { cwd: repoPath }).toString();
  return output.split('\n').filter(Boolean);
}

function gitLog(repoPath, branchName = 'main', maxLines = 20) {
  const output = execSync(`git log ${branchName} --date=short --pretty=format:"%C(124)%ad %C(24)%h %C(34)%an %C(252)%s%C(178)%d" | head -n ${maxLines}`, { cwd: repoPath }).toString();
  return output.split('\n').filter(Boolean);
}

function gitCheckoutAtTag(repoPath, tag) {
  try {
    execSync(`git checkout ${tag}`, { cwd: repoPath });
  } catch (error) {
    // do nothing
  }
}

function getCommitForTag(repoPath, tag) {
  return execSync(`git rev-list -n 1 ${tag}`, { cwd: repoPath }).toString().trim();
}

function getPreviousCommit(repoPath, sha) {
  return execSync(`git rev-parse ${sha}^`, { cwd: repoPath }).toString().trim();
}

function doesBranchExist(repoPath, branchName) {
  try {
    execSync(`git rev-parse --verify "${branchName}"`, { cwd: repoPath });
    return true;
  } catch (error) {
    return false;
  }
}

function createBranchFromCommitAndPush(repoPath, branchName, commit, doPush = true) {
  execSync(`git checkout -b ${branchName} ${commit}`, { cwd: repoPath });
  if (doPush) {
    execSync(`git push origin ${branchName}`, { cwd: repoPath });
  }
}

function initializeGitRepo() {
  const uuid = uuidv4();
  const path = `${TMP_DIR}/${uuid}`;

  fs.mkdirSync(path);

  execSync('git init --initial-branch=main', { cwd: path });
  execSync('git config user.email "test@example.com"', { cwd: path });
  execSync('git config user.name "Test User"', { cwd: path });

  return path;
}

function createAndCommitFile(repoPath, fileName, content) {
  const path = repoPath + "/" + fileName;
  fs.writeFileSync(path, content);

  execSync('git add .', { cwd: repoPath });
  execSync('git commit -m "update"', { cwd: repoPath });

  return getLastCommitSHA(repoPath);
}

function getLastCommitSHA(repoPath) {
  return execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim();
}

function createTag(repoPath, tag) {
  execSync(`git tag ${tag}`, { cwd: repoPath });
}

function createBranch(repoPath, branchName) {
  execSync(`git checkout -b ${branchName}`, { cwd: repoPath });
}

function getLastCommitOfABranch(repoPath, branchName) {
  return execSync(`git log -n 1 --pretty=format:%H ${branchName}`, { cwd: repoPath }).toString().trim();
}

function checkoutBranch(repoPath, branchName) {
  execSync(`git checkout ${branchName}`, { cwd: repoPath });
}

function getCurrentStateOfRepo(repoPath, branchName = 'main', maxLines = 20) {
  return gitLog(repoPath, branchName, maxLines).join('\n');
}

module.exports = {
  getAllTags,
  getPreviousCommit,
  doesBranchExist,
  createBranchFromCommitAndPush,
  initializeGitRepo,
  createAndCommitFile,
  getLastCommitSHA,
  createTag,
  createBranch,
  gitCheckoutAtTag,
  gitLog,
  getCommitForTag,
  getLastCommitOfABranch,
  checkoutBranch,
  getCurrentStateOfRepo,
};