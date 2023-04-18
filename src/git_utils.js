const fs = require('fs');
const { execSync } = require('child_process');

function getAllTags(repoPath) {
  const output = execSync('git tag --sort=-v:refname', { cwd: repoPath }).toString();
  return output.split('\n').filter(Boolean);
}

function initializeGitRepo(repoPath) {
  fs.mkdirSync(repoPath);

  execSync('git init --initial-branch=main', { cwd: repoPath });
  execSync('git config user.email "test@example.com"', { cwd: repoPath });
  execSync('git config user.name "Test User"', { cwd: repoPath });
}

function gitLog(repoPath, branchName = 'main', maxLines = 20) {
  const output = execSync(`git log ${branchName} --date=short --pretty=format:"%C(124)%ad %C(24)%h %C(34)%an %C(252)%s%C(178)%d" | head -n ${maxLines}`, { cwd: repoPath }).toString();
  return output.split('\n').filter(Boolean);
}

function createAndCommitFile(repoPath, fileName, content) {
  const path = repoPath + '/' + fileName;
  fs.writeFileSync(path, content);

  execSync('git add .', { cwd: repoPath });
  execSync('git commit -m "update"', { cwd: repoPath });

  return getLastCommitSHA(repoPath);
}

function createTag(repoPath, tag) {
  execSync(`git tag ${tag}`, { cwd: repoPath });
}

function createBranch(repoPath, branchName) {
  execSync(`git checkout -b ${branchName}`, { cwd: repoPath });
}

function getCurrentStateOfRepo(repoPath, branchName = 'main', maxLines = 20) {
  return gitLog(repoPath, branchName, maxLines).join('\n');
}

function doesBranchExist(repoPath, branchName) {
  try {
    execSync(`git rev-parse --verify "${branchName}"`, { cwd: repoPath });
    return true;
  } catch (error) {
    return false;
  }
}

function getLastCommitSHA(repoPath) {
  return execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim();
}

function checkoutBranch(repoPath, branchName) {
  execSync(`git checkout ${branchName}`, { cwd: repoPath });
}

function gitCheckoutAtTag(repoPath, tag) {
  execSync(`git checkout ${tag}`, { cwd: repoPath });
}

function getCommitForTag(repoPath, tag) {
  return execSync(`git rev-list -n 1 ${tag}`, { cwd: repoPath }).toString().trim();
}

function getLastCommitOfABranch(repoPath, branchName) {
  return execSync(`git log -n 1 --pretty=format:%H ${branchName}`, { cwd: repoPath }).toString().trim();
}

module.exports = {
  getAllTags,
  initializeGitRepo,
  createAndCommitFile,
  createTag,
  gitLog,
  createBranch,
  doesBranchExist,
  getCurrentStateOfRepo,
  checkoutBranch,
  gitCheckoutAtTag,
  getCommitForTag,
  getLastCommitOfABranch,
};