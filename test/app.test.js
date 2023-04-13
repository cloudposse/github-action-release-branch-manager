const assert = require('assert');
const { main } = require('../src/app');
const fs = require('fs');
const handlebars = require('handlebars');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { execSync } = require('child_process');

const GITHUB_EVENT_SOURCE = fs.readFileSync('test/templates/github.event.json', 'utf8');
const TMP_DIR = os.tmpdir();

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
        tag: '0.0.1',
        eventName: eventName,
        isDraft: false,
        targetBranchName: targetBranchName,
    });

    fs.writeFileSync(path, output);

    return path;
}

function initializeGitRepo() {
    const uuid = uuidv4();
    const path = `${TMP_DIR}/${uuid}`;

    fs.mkdirSync(path);

    execSync('git init --initial-branch=main', { cwd: path });
    execSync('git config user.email "test@example.com"');
    execSync('git config user.name "Test User"');

    return path;
}

test('throws invalid number', async () => {
    const githubEventFile = prepareGithubEvent('abcd', '0.0.1');
    console.log(githubEventFile);

    const gitRepoPath = initializeGitRepo();
    console.log(gitRepoPath);

    await main(gitRepoPath, githubEventFile);
    assert.strictEqual(1, 1);
});
