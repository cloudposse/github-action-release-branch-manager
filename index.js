const core = require('@actions/core');
const { main } = require('./src/app.js');

main(process.argv[2], process.argv[3])
    .then(response => {
        if (!response.succeeded) {
            core.setFailed(response.message);
        }
    })
    .catch(error => {
        core.setFailed(error);
    });