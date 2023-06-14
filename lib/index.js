#! /usr/bin/env node
const { VideoBuddyAuth } = require('./auth');
const { VideoBuddyClient } = require('./client');
const { VideoBuddyServer } = require('./server');
const { program } = require('commander');
const storageStatePath = 'video-buddy-session.json';

program
  .name('stream-video-buddy')
  .description('A CLI tool to test Stream Video SDKs')
  .version('1.6.7');

program
  .command('server')
  .description('Starts a server')
  .option('-p, --port <number>', 'Port number', 4567)
  .action((options) => {
    options.programName = program.name();
    new VideoBuddyServer(options).init();
  });

program
  .command('auth')
  .description('Authenticate Stream Video Buddy with Dogfooding app')
  .option('--show-window', 'Should browser window be visible?', false)
  .option('--record-session', 'Should buddy record the session?', false)
  .action((options) => {
    options.storageStatePath = storageStatePath;
    new VideoBuddyAuth(options).init();
  });

program
  .command('join')
  .description('Emulates the participant(s)')
  .requiredOption('-i, --call-id <string>', 'Which call should participant join?')
  .option('-d, --duration <seconds>', 'How long should participant stay on the call?')
  .option('-c, --user-count <number>', 'How many participants should join the call?', 1)
  .option('-m, --message <string>', 'What message should participant send?')
  .option('--message-count <number>', 'How many messages should participant send?', 1)
  .option('--camera', 'Should participant turn on the camera?', false)
  .option('--mic', 'Should participant turn on the microphone?', false)
  .option('--silent', 'Should participant be silent when the mic is on?', false)
  .option('--screen-share', 'Should participant share the screen?', false)
  .option('--screen-sharing-duration <seconds>', 'How long should participant share the screen?')
  .option('--record', 'Should participant record the call?', false)
  .option('--recording-duration <seconds>', 'How long should participant record the call?')
  .option('--show-window', 'Should browser window be visible?', false)
  .option('--record-session', 'Should buddy record the session?', false)
  .action((options) => {
    options.storageStatePath = storageStatePath;
    new VideoBuddyClient(options).init();
  });

program.parse();
