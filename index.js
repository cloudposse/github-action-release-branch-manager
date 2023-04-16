const core = require('@actions/core');
const { main } = require('./src/app.js');
const log4js = require('log4js');

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: { default: { appenders: ['console'], level: 'info' } },
});

const logger = log4js.getLogger();

main(process.argv[2], process.argv[3])
  .then((response) => {
    if (response.succeeded) {
      logger.info(response.message);
    } else {
      logger.error(response.message);
      core.setFailed(response.message);
    }
  })
  .catch((error) => {
    logger.error(`An error occurred: ${error}`);
    core.setFailed(error);
  });