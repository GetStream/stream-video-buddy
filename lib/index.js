#! /usr/bin/env node
const { VideoBuddyClient } = require('./client');
const { VideoBuddyServer } = require('./server');
const { program } = require('commander');

program.name('stream-video-buddy').description('Tool to test StreamVideoSDK').version('1.0.0');

program
  .command('server')
  .description('Starts a server')
  .option('-p, --port <number>', 'Port number', 4567)
  .action((options) => new VideoBuddyServer(options, program.name()).init());

program
  .command('join')
  .description('Joins a call')
  .requiredOption('-i, --call-id <string>', 'Call id')
  .option('-d, --duration <number>', 'Duration in seconds')
  .option('-c, --users-count <number>', 'Users count', 1)
  .option('--show-window', 'Should browser headless mode be turned off?')
  .action((options) => new VideoBuddyClient(options).init());

program.parse();
