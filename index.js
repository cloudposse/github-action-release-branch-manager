const core = require('@actions/core');
const { main } = require('./src/app.js');
const log4js = require('log4js');

const logLevel = process.env.LOG_LEVEL || 'info';

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: { default: { appenders: ['console'], level: logLevel } },
});

const logger = log4js.getLogger();

main(process.argv[2])
  .then((response) => {
    if (response.succeeded) {
      const responseJson = JSON.stringify(response);
      logger.info(`Response: ${responseJson}`);
      core.setOutput('response', responseJson);
    } else {
      logger.error(response.message);
      core.setFailed(response.message);
    }
  })
  .catch((error) => {
    logger.error(`An error occurred: ${error}`);
    core.setFailed(error);
  });