const core = require('@actions/core');
const { main } = require('./src/app.js');

try {
    main(process.argv[2], process.argv[3]);
} catch (error) {
    core.setFailed(error.message);
}
