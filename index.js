const core = require('@actions/core');
const github = require('@actions/github');

try {
    console.log('Hello World!');
//   const token = core.getInput('token');
//   const title = core.getInput('title');
//   const body = core.getInput('body');
  // const octokit = github.getOctokit(token);
  const context = github.context;

  const repo = context.payload.repository.full_name;
  const owner = context.payload.repository.owner.login;

  console.log('repo', repo);
  console.log('owner', owner);

//   const response = await octokit.issues.create({
//     owner,
//     repo,
//     title,
//     body
//   });

//   core.setOutput('issue-number', response.data.number);
} catch (error) {
  core.setFailed(error.message);
}