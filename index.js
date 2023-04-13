const core = require('@actions/core');
const { main } = require('./src/app.js');

response = main(process.argv[2], process.argv[3]);

if (!response.succeeded) {
    core.setFailed(response.message);
}
