const simpleGit = require('simple-git');

class GitWrapper {
  constructor() {
    this.git = null;
  }

  static async create(repoPath, repoFullName = null, token = null) {
    const instance = new GitWrapper();
    await instance.initialize(repoPath, repoFullName, token);
    return instance;
  }

  async initialize(repoPath, repoFullName, token) {
    this.git = simpleGit(repoPath);

    const remotes = await git.getRemotes(true);

    if (token != null) {
      console.log(`https://${token}@github.com/${repoFullName}.git`);
      await this.git.remote(['set-url', 'origin', `https://${token}@github.com/${repoFullName}.git`]);
    }

    // Find the origin remote
    const originRemote = remotes.find((remote) => remote.name === 'origin');

    if (originRemote) {
      console.log('Origin URL:', originRemote.refs.push);
    } else {
      console.log('No origin remote found');
    }
  }

  async getAllTags() {
    const tags = await this.git.raw(['tag', '--sort=-v:refname']);
    return tags.trim().split('\n');
  }

  async doesBranchExist(branchName) {
    try {
      await this.git.revparse(['--verify', branchName]);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getSHAForTag(tag) {
    const sha = await this.git.revparse([tag]);
    return sha.trim();
  }

  async getLastCommitOfABranch(branchName) {
    const result = await this.git.raw(['log', '-n', '1', `--pretty=format:%H`, branchName]);
    return result.trim();
  }

  async initializeGitRepo() {
    await this.git.init();
    await this.git.raw(['config', 'user.name', 'Test User']);
    await this.git.raw(['config', 'user.email', 'test@example.com']);
  }

  async commit() {
    await this.git.add('.');

    const commitResult = await this.git.commit('update');

    return commitResult.commit;
  }

  async pushToRemote(branchOrTag, flag = '--verbose') {
    await this.git.push('origin', branchOrTag, [flag]);
  }

  async createTag(tag, sha, doPush = true) {
    await this.git.tag([tag, sha]);

    if (doPush) {
      await this.pushToRemote(tag);
    }
  }

  async log(maxLines = 20) {
    const logs = await this.git.log({
      'format': { hash: '%h', author: '%an', message: '%s%d', date: '%as' },
      '--max-count': maxLines,
    });

    return logs.all.map((log) => `${log.date} ${log.hash} ${log.author} ${log.message}`);
  }

  async createBranch(branchName, source) {
    return await this.git.checkoutBranch(branchName, source);
  }

  async checkout(branchOrTagName) {
    return await this.git.checkout(branchOrTagName);
  }

  async getCurrentStateOfRepo(maxLines = 20) {
    const logs = await this.log(maxLines);
    return logs.join('\n');
  }
}

module.exports = GitWrapper;