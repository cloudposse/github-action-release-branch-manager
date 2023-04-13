const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const TMP_DIR = os.tmpdir();

function getAllTags(repoPath) {
  const output = execSync('git tag -l', { cwd: repoPath }).toString();
  return output.split('\n').filter(Boolean);
}

function getPreviousCommit(repoPath, sha) {
  const output = execSync(`git rev-parse ${sha}^`, { cwd: repoPath }).toString();
  return output.trim();
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
  execSync(`git checkout -b "${branchName}"`, { cwd: repoPath });
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
  createBranch
};