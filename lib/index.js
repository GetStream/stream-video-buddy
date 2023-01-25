#! /usr/bin/env node
const { VideoBuddyClient } = require('./client');
const { VideoBuddyServer } = require('./server');
const { program } = require('commander');

program.name('stream-video-buddy').description('Tool to test StreamVideoSDK').version('1.1.0');

program
  .command('server')
  .description('Starts a server')
  .option('-p, --port <number>', 'Port number', 4567)
  .action((options) => {
    options.programName = program.name();
    new VideoBuddyServer(options).init();
  });

program
  .command('join')
  .description('Emulates the participant(s)')
  .requiredOption('-i, --call-id <string>', 'Call id')
  .option('-d, --duration <number>', 'Duration in seconds')
  .option('-c, --users-count <number>', 'Users count', 1)
  .option('--camera', 'Should participant enable camera?', false)
  .option('--mic', 'Should participant enable microphone?', false)
  .option('--silent', 'Should participant be silent when the mic on?', false)
  .option('--frozen', 'Should participant be frozen when the camera on?', false)
  .option('--show-window', 'Should browser headless mode be off?', false)
  .action((options) => new VideoBuddyClient(options).init());

program.parse();
