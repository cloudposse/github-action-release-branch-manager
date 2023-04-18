const os = require('os');
const assert = require('assert');
const { main, RESPONSE_REASON } = require('../src/app');
const { v4: uuidv4 } = require('uuid');
const gitUtils = require('../src/git_utils.js');

const TMP_DIR = os.tmpdir();
const GITHUB_EVENT_FILE = 'test/github.event.json';

const log4js = require('log4js');

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: { default: { appenders: ['console'], level: 'debug' } },
});

const logger = log4js.getLogger();

test('no tags', async () => {
  // prepare
  const repoPath = `${TMP_DIR}/${uuidv4()}`;
  logger.debug(`repoPath: ${repoPath}`);

  gitUtils.initializeGitRepo(repoPath);
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());

  // test
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);
  response = await main(repoPath, GITHUB_EVENT_FILE, false);
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.NO_CHANGES);
  assert.strictEqual(Object.keys(response.data).length, 0);
});

test('only 0 level tags', async () => {
  // prepare
  const repoPath = `${TMP_DIR}/${uuidv4()}`;
  logger.debug(`repoPath: ${repoPath}`);

  gitUtils.initializeGitRepo(repoPath);
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '0.1.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '0.1.1');

  // test
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);
  response = await main(repoPath, GITHUB_EVENT_FILE, false);
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.NO_CHANGES);
  assert.strictEqual(Object.keys(response.data).length, 0);
});

test('only 1 level tags', async () => {
  // prepare
  const repoPath = `${TMP_DIR}/${uuidv4()}`;
  logger.debug(`repoPath: ${repoPath}`);

  gitUtils.initializeGitRepo(repoPath);
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '1.1.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '1.1.1');

  // test
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);
  response = await main(repoPath, GITHUB_EVENT_FILE, false);
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.NO_CHANGES);
  assert.strictEqual(Object.keys(response.data).length, 0);
});

test('release branches exist for all tags', async () => {
  // prepare
  const repoPath = `${TMP_DIR}/${uuidv4()}`;
  logger.debug(`repoPath: ${repoPath}`);

  gitUtils.initializeGitRepo(repoPath);
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '1.0.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '1.1.0');
  gitUtils.createBranch(repoPath, 'release/v1');
  gitUtils.checkoutBranch(repoPath, 'main');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '2.0.0');
  gitUtils.createBranch(repoPath, 'release/v2');
  gitUtils.checkoutBranch(repoPath, 'main');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '3.0.0');

  // test
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);
  response = await main(repoPath, GITHUB_EVENT_FILE, false);
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.NO_CHANGES);
  assert.strictEqual(Object.keys(response.data).length, 0);
});

test('create release branch for tag', async () => {
  // prepare
  const repoPath = `${TMP_DIR}/${uuidv4()}`;
  logger.debug(`repoPath: ${repoPath}`);

  gitUtils.initializeGitRepo(repoPath);
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '1.0.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '1.1.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '2.0.0');

  // test
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);
  response = await main(repoPath, GITHUB_EVENT_FILE, false);
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.CREATED_BRANCHES);
  assert.strictEqual(Object.keys(response.data).length, 1);
  assert.strictEqual(response.data['release/v1'], '1.1.0');
});

test('create multiple release branches', async () => {
  // prepare
  const repoPath = `${TMP_DIR}/${uuidv4()}`;
  logger.debug(`repoPath: ${repoPath}`);

  gitUtils.initializeGitRepo(repoPath);
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '1.0.0');
  const sha1 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '1.1.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  const sha2 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '2.0.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '3.0.0');
  const sha3 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '3.1.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '4.0.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '4.0.1');

  // test
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);
  const response = await main(repoPath, GITHUB_EVENT_FILE, false);
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);

  logger.info(JSON.stringify(response));

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.CREATED_BRANCHES);
  assert.strictEqual(Object.keys(response.data).length, 3);
  assert.strictEqual(response.data['release/v1'], '1.1.0');
  assert.strictEqual(response.data['release/v2'], '2.0.0');
  assert.strictEqual(response.data['release/v3'], '3.1.0');
  assert.strictEqual(gitUtils.getCommitForTag(repoPath, '1.1.0'), sha1);
  assert.strictEqual(gitUtils.getLastCommitOfABranch(repoPath, 'release/v1'), sha1);
  assert.strictEqual(gitUtils.getCommitForTag(repoPath, '2.0.0'), sha2);
  assert.strictEqual(gitUtils.getLastCommitOfABranch(repoPath, 'release/v2'), sha2);
  assert.strictEqual(gitUtils.getCommitForTag(repoPath, '3.1.0'), sha3);
  assert.strictEqual(gitUtils.getLastCommitOfABranch(repoPath, 'release/v3'), sha3);
});

test('create multiple release branches', async () => {
  // prepare
  const repoPath = `${TMP_DIR}/${uuidv4()}`;
  logger.debug(`repoPath: ${repoPath}`);

  gitUtils.initializeGitRepo(repoPath);
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '1.0.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '1.1.0');
  gitUtils.createBranch(repoPath, 'release/v1');
  gitUtils.checkoutBranch(repoPath, 'main');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '2.0.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '3.0.0');
  gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
  gitUtils.createTag(repoPath, '3.1.0');

  // test
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);
  const response = await main(repoPath, GITHUB_EVENT_FILE, false);
  logger.debug(`State of repo:\n${gitUtils.getCurrentStateOfRepo(repoPath)}`);

  // verify
  assert.strictEqual(response.succeeded, true);
  assert.strictEqual(response.reason, RESPONSE_REASON.CREATED_BRANCHES);
  assert.strictEqual(Object.keys(response.data).length, 1);
  assert.strictEqual(response.data['release/v2'], '2.0.0');
});