const { logger } = require('./utils.js');

class GitHubWrapper {
  constructor(token, repoFullName) {
    this.token = token;
    this.repoFullName = repoFullName;
  }

  async findReleaseByTag(tag) {
    const url = `https://api.github.com/repos/${this.repoFullName}/releases/tags/${tag}`;

    try {
      const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      };

      const response = await axios.get(url, { headers });

      if (response.status === 200) {
        logger.info(`Found release for tag '${tag}' with target_commitish '${response.data.target_commitish}'. Release id: ${response.data.id}`);
        return response.data;
      } else {
        logger.error(`Failed to find the release by tag. Status: ${response.status}`);
      }
    } catch (error) {
      logger.error('Error:', error.message);
    }

    return null;
  }

  async createReleaseForTag(tag, targetCommitish) {
    const url = `https://api.github.com/repos/${this.repoFullName}/releases`;

    try {
      const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      };

      const payload = {
        tag_name: tag,
        name: `v${tag}`,
        body: `This is auto-generated release by Release Branch Manager for version ${tag}`,
        target_commitish: targetCommitish,
      };

      const response = await axios.post(url, payload, { headers });

      if (response.status === 201) {
        logger.info(`Created release for tag '${tag}' with target_commitish '${targetCommitish}'. Release id: ${response.data.id}`);
        return response.data;
      } else {
        logger.error(`Failed to create the release. Status: ${response.status}`);
      }
    } catch (error) {
      logger.error('Error:', error.message);
    }

    return null;
  }

  async updateTargetCommitish(releaseId, targetCommitish) {
    const url = `https://api.github.com/repos/${this.repoFullName}/releases/${releaseId}`;

    try {
      const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      };

      const payload = {
        target_commitish: targetCommitish,
      };

      const response = await axios.patch(url, payload, { headers });

      if (response.status === 200) {
        logger.info(`Updated 'target_commitish' in release '${releaseId}' successfully.`);
        return response.data;
      } else {
        logger.error(`Failed to update the target_commitish. Status: ${response.status}`);
      }
    } catch (error) {
      logger.error('Error:', error.message);
    }

    return null;
  }
}

module.exports = GitHubWrapper;