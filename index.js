const core = require('@actions/core');
const { main } = require('./src/app.js');

response = main(process.argv[2], process.argv[3]);
console.log(response.succeeded);

if (!response.succeeded) {
    console.log(response.message);
    core.setFailed(response.message);
}
