const simpleGit = require('simple-git');

class GitWrapper {
  constructor(repoPath) {
    this.git = simpleGit(repoPath);
  }

  async getAllTags() {
    const tags = await this.git.raw(['tag', '--sort=-v:refname']);
    return tags.trim().split('\n');
  }

  async branchExists(branchName) {
    try {
      const { all: localBranches } = await this.git.branchLocal();
      const existsLocally = localBranches.includes(branchName);

      if (existsLocally) {
        return true;
      }

      const { all: remoteBranches } = await this.git.branch();
      const existsRemotely = remoteBranches.includes(`origin/${branchName}`);

      return existsRemotely;
    } catch (err) {
      console.error(`Error checking if branch '${branchName}' exists:`, err);
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