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
  .requiredOption('-i, --call-id <string>', 'Which call should participant join?')
  .option('-d, --duration <seconds>', 'How long should participant stay on the call?')
  .option('-c, --users-count <number>', 'How many participants should join the call?', 1)
  .option('--camera', 'Should participant turn on the camera?', false)
  .option('--frozen', 'Should participant be frozen when the camera is on?', false)
  .option('--mic', 'Should participant turn on the microphone?', false)
  .option('--silent', 'Should participant be silent when the mic is on?', false)
  .option('--screen-share', 'Should participant share the screen?', false)
  .option('--screen-sharing-duration <seconds>', 'How long should participant share the screen?')
  .option('--record', 'Should participant record the call?', false)
  .option('--recording-duration <seconds>', 'How long should participant record the call?')
  .option('--show-window', 'Should browser window be visible?', false)
  .action((options) => new VideoBuddyClient(options).init());

program.parse();
