const os = require('os');
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const { main, RESPONSE_REASON } = require('../src/app');
const { v4: uuidv4 } = require('uuid');
const GitWrapper = require('../src/git_wrapper.js');

const TMP_DIR = os.tmpdir();
const GITHUB_EVENT_FILE = 'test/github.event.json';

const log4js = require('log4js');

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: { default: { appenders: ['console'], level: 'debug' } },
});

const logger = log4js.getLogger();

function createRepoDir() {
  const repoPath = `${TMP_DIR}/${uuidv4()}`;
  logger.debug(`repoPath: ${repoPath}`);
  fs.mkdirSync(repoPath);
  return repoPath;
}

async function createFileAndCommit(gitWrapper, repoPath) {
  fs.writeFileSync(path.join(repoPath, uuidv4()), uuidv4());
  return await gitWrapper.commit();
}

test('no tags', async () => {
  // prepare
  const repoPath = createRepoDir();
  const gitWrapper = await GitWrapper.create(repoPath);

  await gitWrapper.initializeGitRepo();
  await createFileAndCommit(gitWrapper, repoPath);

  // test
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);
  response = await main(repoPath, false, null, GITHUB_EVENT_FILE);
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.NO_CHANGES);
  assert.strictEqual(Object.keys(response.data).length, 0);
});

test('only 0 level tags', async () => {
  // prepare
  const repoPath = createRepoDir();
  const gitWrapper = await GitWrapper.create(repoPath);

  await gitWrapper.initializeGitRepo();
  await createFileAndCommit(gitWrapper, repoPath);
  const sha1 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('0.1.0', sha1, false);
  const sha2 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('0.1.1', sha2, false);

  // test
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);
  response = await main(repoPath, false, null, GITHUB_EVENT_FILE);
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.NO_CHANGES);
  assert.strictEqual(Object.keys(response.data).length, 0);
});

test('only 1 level tags', async () => {
  // prepare
  const repoPath = createRepoDir();
  const gitWrapper = await GitWrapper.create(repoPath);

  await gitWrapper.initializeGitRepo();
  await createFileAndCommit(gitWrapper, repoPath);
  const sha1 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('1.1.0', sha1, false);
  const sha2 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('1.1.1', sha2, false);

  // test
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);
  response = await main(repoPath, false, null, GITHUB_EVENT_FILE);
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.NO_CHANGES);
  assert.strictEqual(Object.keys(response.data).length, 0);
});

test('release branches exist for all tags', async () => {
  // prepare
  const repoPath = createRepoDir();
  const gitWrapper = await GitWrapper.create(repoPath);

  await gitWrapper.initializeGitRepo();
  await createFileAndCommit(gitWrapper, repoPath);
  const sha1 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('1.0.0', sha1, false);
  const sha2 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('1.1.0', sha2, false);
  await gitWrapper.createBranch('release/v1', sha2);
  await gitWrapper.checkout('master');
  await createFileAndCommit(gitWrapper, repoPath);
  const sha3 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('2.0.0', sha3, false);
  await gitWrapper.createBranch('release/v2', sha3);
  await gitWrapper.checkout('master');
  await createFileAndCommit(gitWrapper, repoPath);
  const sha4 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('3.0.0', sha4, false);

  // test
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);
  response = await main(repoPath, false, null, GITHUB_EVENT_FILE);
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.NO_CHANGES);
  assert.strictEqual(Object.keys(response.data).length, 0);
});

test('create release branch for tag', async () => {
  // prepare
  const repoPath = createRepoDir();
  const gitWrapper = await GitWrapper.create(repoPath);

  await gitWrapper.initializeGitRepo();
  await createFileAndCommit(gitWrapper, repoPath);
  const sha1 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('1.0.0', sha1, false);
  const sha2 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('1.1.0', sha2, false);
  await createFileAndCommit(gitWrapper, repoPath);
  const sha3 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('2.0.0', sha3, false);

  // test
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);
  response = await main(repoPath, false, null, GITHUB_EVENT_FILE);
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.CREATED_BRANCHES);
  assert.strictEqual(Object.keys(response.data).length, 1);
  assert.strictEqual(response.data['release/v1'], '1.1.0');
});

test('create multiple release branches 1', async () => {
  // prepare
  const repoPath = createRepoDir();
  const gitWrapper = await GitWrapper.create(repoPath);

  await gitWrapper.initializeGitRepo();
  await createFileAndCommit(gitWrapper, repoPath);
  const sha1 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('1.0.0', sha1, false);
  const sha2 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('1.1.0', sha2, false);
  await createFileAndCommit(gitWrapper, repoPath);
  const sha3 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('2.0.0', sha3, false);
  await createFileAndCommit(gitWrapper, repoPath);
  const sha4 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('3.0.0', sha4, false);
  const sha5 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('3.1.0', sha5, false);
  await createFileAndCommit(gitWrapper, repoPath);
  const sha6 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('4.0.0', sha6, false);
  const sha7 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('4.0.1', sha7, false);

  // test
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);
  const response = await main(repoPath, false, null, GITHUB_EVENT_FILE);
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);

  logger.info(JSON.stringify(response));

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.CREATED_BRANCHES);
  assert.strictEqual(Object.keys(response.data).length, 3);
  assert.strictEqual(response.data['release/v1'], '1.1.0');
  assert.strictEqual(response.data['release/v2'], '2.0.0');
  assert.strictEqual(response.data['release/v3'], '3.1.0');
  assert.strictEqual(await gitWrapper.getSHAForTag('1.1.0'), sha2);
  assert.strictEqual(await gitWrapper.getLastCommitOfABranch('release/v1'), sha2);
  assert.strictEqual(await gitWrapper.getSHAForTag('2.0.0'), sha3);
  assert.strictEqual(await gitWrapper.getLastCommitOfABranch('release/v2'), sha3);
  assert.strictEqual(await gitWrapper.getSHAForTag('3.1.0'), sha5);
  assert.strictEqual(await gitWrapper.getLastCommitOfABranch('release/v3'), sha5);
});

test('create multiple release branches 2', async () => {
  // prepare
  const repoPath = createRepoDir();
  const gitWrapper = await GitWrapper.create(repoPath);

  await gitWrapper.initializeGitRepo();
  await createFileAndCommit(gitWrapper, repoPath);
  const sha1 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('1.0.0', sha1, false);
  const sha2 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('1.1.0', sha2, false);
  await gitWrapper.createBranch('release/v1', sha2);
  await gitWrapper.checkout('master');
  await createFileAndCommit(gitWrapper, repoPath);
  const sha3 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('2.0.0', sha3, false);
  await createFileAndCommit(gitWrapper, repoPath);
  const sha4 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('3.0.0', sha4, false);
  const sha5 = await createFileAndCommit(gitWrapper, repoPath);
  await gitWrapper.createTag('3.1.0', sha5, false);

  // test
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);
  const response = await main(repoPath, false, null, GITHUB_EVENT_FILE);
  logger.debug(`State of repo:\n${await gitWrapper.getCurrentStateOfRepo()}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.CREATED_BRANCHES);
  assert.strictEqual(Object.keys(response.data).length, 1);
  assert.strictEqual(response.data['release/v2'], '2.0.0');
});