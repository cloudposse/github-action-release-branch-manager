const fs = require('fs');
const os = require('os');
const assert = require('assert');
const { main, Response, RESPONSE_REASON } = require('../src/app');
const handlebars = require('handlebars');
const { v4: uuidv4 } = require('uuid');
const gitUtils = require('../src/git_utils.js');

const TMP_DIR = os.tmpdir();
const GITHUB_EVENT_SOURCE = fs.readFileSync('test/templates/github.event.json', 'utf8');

function prepareGithubEvent(
    sha,
    tag,
    eventName = 'release',
    targetBranchName = 'main') {
    const uuid = uuidv4();
    const path = `${TMP_DIR}/${uuid}.json`;
    const template = handlebars.compile(GITHUB_EVENT_SOURCE);

    const output = template({
        sha: sha,
        tag: tag,
        eventName: eventName,
        isDraft: false,
        targetBranchName: targetBranchName,
    });

    fs.writeFileSync(path, output);

    return path;
}

test('fail if github event is not "release" event', async () => {
    // prepare
    const githubEventFile = prepareGithubEvent('abcd', '0.0.1', 'push');

    // test
    response = await main('path/to/test/repo', githubEventFile);

    // verify
    assert.strictEqual(response.succeeded, false);
    assert.strictEqual(response.reason, RESPONSE_REASON.INVALID_EVENT_TYPE);
});

test('fail if github event has tag not in semver format', async () => {
    let githubEventFile = prepareGithubEvent('abcd', '1');
    response = await main('path/to/test/repo', githubEventFile);
    assert.strictEqual(response.succeeded, false);
    assert.strictEqual(response.reason, RESPONSE_REASON.TAG_IS_NOT_SEMVER);

    githubEventFile = prepareGithubEvent('abcd', 'aaaa');
    response = await main('path/to/test/repo', githubEventFile);
    assert.strictEqual(response.succeeded, false);
    assert.strictEqual(response.reason, RESPONSE_REASON.TAG_IS_NOT_SEMVER);

    githubEventFile = prepareGithubEvent('abcd', 'aaaa.bbb');
    response = await main('path/to/test/repo', githubEventFile);
    assert.strictEqual(response.succeeded, false);
    assert.strictEqual(response.reason, RESPONSE_REASON.TAG_IS_NOT_SEMVER);

    githubEventFile = prepareGithubEvent('abcd', 'aaaa.bbb.ccc');
    response = await main('path/to/test/repo', githubEventFile);
    assert.strictEqual(response.succeeded, false);
    assert.strictEqual(response.reason, RESPONSE_REASON.TAG_IS_NOT_SEMVER);

    githubEventFile = prepareGithubEvent('abcd', '1.2');
    response = await main('path/to/test/repo', githubEventFile);
    assert.strictEqual(response.succeeded, false);
    assert.strictEqual(response.reason, RESPONSE_REASON.TAG_IS_NOT_SEMVER);

    githubEventFile = prepareGithubEvent('abcd', '1.2.a');
    response = await main('path/to/test/repo', githubEventFile);
    assert.strictEqual(response.succeeded, false);
    assert.strictEqual(response.reason, RESPONSE_REASON.TAG_IS_NOT_SEMVER);
});

test('succeed if major tag already exist', async () => {
    // prepare
    const githubEventFile = prepareGithubEvent('abcd', '2.1.5');
    const repoPath = gitUtils.initializeGitRepo();
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createTag(repoPath, '2.0.0');

    // test
    response = await main(repoPath, githubEventFile);

    // verify
    assert.strictEqual(response.succeeded, true);
    assert.strictEqual(response.reason, RESPONSE_REASON.MAJOR_TAG_ALREADY_EXISTS);
});

test('major tag is 0', async () => {
    // prepare
    const githubEventFile = prepareGithubEvent('abcd', '0.1.5');

    // test
    response = await main('path/to/repo', githubEventFile);

    // verify
    assert.strictEqual(response.succeeded, true);
    assert.strictEqual(response.reason, RESPONSE_REASON.MAJOR_TAG_IS_0);
});


test('fail if release branch already exist', async () => {
    // prepare
    const repoPath = gitUtils.initializeGitRepo();
    const commitSHA1 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createTag(repoPath, '1.0.0');
    const commitSHA2 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const githubEventFile = prepareGithubEvent(commitSHA2, '2.0.0');
    gitUtils.createBranch(repoPath, 'release/v1');

    // test
    response = await main(repoPath, githubEventFile, false);

    // verify
    assert.strictEqual(response.succeeded, false);
    assert.strictEqual(response.reason, RESPONSE_REASON.RELEASE_BRANCH_ALREADY_EXISTS);
});

test('successfully create release branch', async () => {
    // prepare
    const repoPath = gitUtils.initializeGitRepo();
    const commitSHA1 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createTag(repoPath, '1.0.0');
    const commitSHA2 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const githubEventFile = prepareGithubEvent(commitSHA2, '2.0.0');

    // test
    response = await main(repoPath, githubEventFile, false);

    // verify
    assert.strictEqual(response.succeeded, true);
    assert.strictEqual(response.reason, RESPONSE_REASON.SUCCESSFULLY_CREATED_RELEASE_BRANCH);
    assert.strictEqual(gitUtils.doesBranchExist(repoPath, 'release/v1'), true);
});

test('succeed to release into release branch', async () => {
    // prepare
    const repoPath = gitUtils.initializeGitRepo();
    const commitSHA1 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createBranch(repoPath, 'release/v2');
    const commitSHA2 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const githubEventFile = prepareGithubEvent(commitSHA2, '2.2.3', 'release', 'release/v2');

    // test
    response = await main(repoPath, githubEventFile, false);

    // verify
    assert.strictEqual(response.succeeded, true);
    assert.strictEqual(response.reason, RESPONSE_REASON.PUBLISHED_RELEASE_TO_RELEASE_BRANCH);
});

test('fail if major version of release is different from version of release branch', async () => {
    // prepare
    const repoPath = gitUtils.initializeGitRepo();
    const commitSHA1 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createBranch(repoPath, 'release/v2');
    const commitSHA2 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const githubEventFile = prepareGithubEvent(commitSHA2, '1.2.3', 'release', 'release/v2');

    // test
    response = await main(repoPath, githubEventFile, false);

    // verify
    assert.strictEqual(response.succeeded, false);
    assert.strictEqual(response.reason, RESPONSE_REASON.RELEASE_TAG_AND_RELEASE_BRANCH_DOESNT_MATCH);
});

test('fail if target release branch is not default or "release/vN" branch', async () => {
    // prepare
    const repoPath = gitUtils.initializeGitRepo();
    const commitSHA = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const githubEventFile = prepareGithubEvent(commitSHA, '1.2.3', 'release', 'some-non-default-branch');

    // test
    response = await main(repoPath, githubEventFile, false);

    // verify
    assert.strictEqual(response.succeeded, false);
    assert.strictEqual(response.reason, RESPONSE_REASON.TARGET_BRANCH_SHOULD_BE_EITHER_DEFAULT_OR_RELEASE_BRANCH);
});


test('succeeed on very first zero release', async () => {
    // prepare
    const repoPath = gitUtils.initializeGitRepo();
    const commitSHA1 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const githubEventFile = prepareGithubEvent(commitSHA1, '0.0.1');

    // test
    response = await main(repoPath, githubEventFile, false);

    // verify
    assert.strictEqual(response.succeeded, true);
    assert.strictEqual(response.reason, RESPONSE_REASON.MAJOR_TAG_IS_0);
});

test('succeeed on first zero when no previous `0` release exist', async () => {
    // prepare
    const repoPath = gitUtils.initializeGitRepo();
    const commitSHA1 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const commitSHA2 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const githubEventFile = prepareGithubEvent(commitSHA2, '1.0.1');

    // test
    response = await main(repoPath, githubEventFile, false);

    // verify
    assert.strictEqual(response.succeeded, true);
    assert.strictEqual(response.reason, RESPONSE_REASON.SUCCESSFULLY_CREATED_RELEASE_BRANCH);
    assert.strictEqual(gitUtils.doesBranchExist(repoPath, 'release/v0'), true);
    assert.strictEqual(gitUtils.getLastCommitOfABranch(repoPath, 'release/v0'), commitSHA1);
});


test('succeed if skipped few major versions', async () => {
    // prepare
    const repoPath = gitUtils.initializeGitRepo();
    const commitSHA1 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const commitSHA2 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const githubEventFile = prepareGithubEvent(commitSHA2, '3.0.0');

    // test
    response = await main(repoPath, githubEventFile, false);

    // verify
    assert.strictEqual(response.succeeded, true);
    assert.strictEqual(response.reason, RESPONSE_REASON.SUCCESSFULLY_CREATED_RELEASE_BRANCH);
    assert.strictEqual(gitUtils.doesBranchExist(repoPath, 'release/v0'), true);
    assert.strictEqual(gitUtils.getLastCommitOfABranch(repoPath, 'release/v0'), commitSHA1);
});

test('succeed if skipped few major versions, test 2', async () => {
    // prepare
    const repoPath = gitUtils.initializeGitRepo();
    const commitSHA1 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const commitSHA2 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createTag(repoPath, '2.0.0');
    const commitSHA3 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createTag(repoPath, '2.1.0');
    const commitSHA4 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const githubEventFile = prepareGithubEvent(commitSHA4, '5.0.0');

    // test
    response = await main(repoPath, githubEventFile, false);

    // verify
    assert.strictEqual(response.succeeded, true);
    assert.strictEqual(response.reason, RESPONSE_REASON.SUCCESSFULLY_CREATED_RELEASE_BRANCH);
    assert.strictEqual(gitUtils.doesBranchExist(repoPath, 'release/v2'), true);
    assert.strictEqual(gitUtils.getLastCommitOfABranch(repoPath, 'release/v2'), commitSHA3);

    gitUtils.checkoutBranch(repoPath, 'main');
    console.log("Current state of repo:\n" + gitUtils.getCurrentStateOfRepo(repoPath));
});

test('succeed when multiple commit are pushed between last tags version', async () => {
    // prepare
    const repoPath = gitUtils.initializeGitRepo();
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createTag(repoPath, '1.0.0');
    const commitSHA1 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createTag(repoPath, '1.1.0');
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const commitSHA2 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const githubEventFile = prepareGithubEvent(commitSHA2, '2.0.0');

    // test
    response = await main(repoPath, githubEventFile, false);

    // verify
    assert.strictEqual(response.succeeded, true);
    assert.strictEqual(response.reason, RESPONSE_REASON.SUCCESSFULLY_CREATED_RELEASE_BRANCH);
    assert.strictEqual(gitUtils.doesBranchExist(repoPath, 'release/v1'), true);
    assert.strictEqual(gitUtils.getLastCommitOfABranch(repoPath, 'release/v1'), commitSHA1);

    gitUtils.checkoutBranch(repoPath, 'main');
    console.log("Current state of repo:\n" + gitUtils.getCurrentStateOfRepo(repoPath));
});

test('succeed when multiple commit are pushed between last tags version + mix ', async () => {
    // prepare
    const repoPath = gitUtils.initializeGitRepo();
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createBranch(repoPath, 'release/v0');
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.checkoutBranch(repoPath, 'main');
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createTag(repoPath, '1.0.0');
    const commitSHA1 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createTag(repoPath, '1.1.0');
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.checkoutBranch(repoPath, 'release/v0');
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    gitUtils.createTag(repoPath, '0.3.5');
    gitUtils.checkoutBranch(repoPath, 'main');
    const commitSHA2 = gitUtils.createAndCommitFile(repoPath, uuidv4(), uuidv4());
    const githubEventFile = prepareGithubEvent(commitSHA2, '2.0.0');

    console.log(gitUtils.getCurrentStateOfRepo(repoPath));

    // test
    response = await main(repoPath, githubEventFile, false);

    // verify
    assert.strictEqual(response.succeeded, true);
    assert.strictEqual(response.reason, RESPONSE_REASON.SUCCESSFULLY_CREATED_RELEASE_BRANCH);
    assert.strictEqual(gitUtils.doesBranchExist(repoPath, 'release/v1'), true);
    assert.strictEqual(gitUtils.getLastCommitOfABranch(repoPath, 'release/v1'), commitSHA1);

    gitUtils.checkoutBranch(repoPath, 'main');
    console.log(gitUtils.getCurrentStateOfRepo(repoPath));
    console.log(gitUtils.getCurrentStateOfRepo(repoPath, 'release/v0'));
    console.log(gitUtils.getCurrentStateOfRepo(repoPath, 'release/v1'));
});
