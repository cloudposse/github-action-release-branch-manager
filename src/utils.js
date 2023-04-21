const log4js = require('log4js');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: { default: { appenders: ['console'], level: LOG_LEVEL } },
});

const logger = log4js.getLogger();

module.exports = { logger };