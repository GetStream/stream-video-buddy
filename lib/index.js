#! /usr/bin/env node
const { VideoBuddyClient } = require('./client');
const { VideoBuddyServer } = require('./server');
const { LivestreamBench } = require('./bench');
const { program } = require('commander');

program
  .name('stream-video-buddy')
  .description('A CLI tool to test Stream Video SDKs')
  .version('1.8.1');

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
  .description('Join the call as a participant(s)')
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
  .option('--use-main-page', 'Should buddy join the call from the main page?', false)
  .option('--api-key <string>', 'Should buddy use the API key for the call?')
  .option('--token <string>', 'If API key is provided, buddy needs the token to join the call.')
  .option('--call-type <string>', 'Custom type of the call.', 'default')
  .option('--show-window', 'Should browser window be visible?', false)
  .option('--record-session', 'Should buddy record the session?', false)
  .option('--verbose', 'Should console logs be recorded?', false)
  .option('--test-name <string>', 'Test name for the logs.')
  .option('--sfu <string>', 'Which SFU should buddy use? Needs only for the SFU testing purposes.')
  .option(
    '--cascading <number>',
    'Should cascading be used? `1` - true, `0` - false, `null` - default.  Needs only for the SFU testing purposes.',
  )
  .option(
    '--app <string>',
    'App URL to join the call. If not provided, the environment variable `STREAM_SDK_TEST_APP` will be used. If not set, the default app will be used.',
  )
  .option('--parallel', 'Should participants join in parallel?', false)
  .option(
    '--concurrent <number>',
    'How many participants should join concurrently when using --parallel?',
    3,
  )
  .action((options) => {
    new VideoBuddyClient('join', options).init();
  });

program
  .command('ring')
  .description('Ring someone by user id')
  .requiredOption('-i, --user-id <string>', 'Which user should participant call?')
  .option('-d, --duration <seconds>', 'How long should participant ring?')
  .option('--audio-call', 'Should it be an audio call?', false)
  .option('--show-window', 'Should browser window be visible?', false)
  .option('--record-session', 'Should buddy record the session?', false)
  .option('--verbose', 'Should console logs be recorded?', false)
  .option('--test-name <string>', 'Test name for the logs.')
  .option('--sfu <string>', 'Which SFU should buddy use? Needs only for the SFU testing purposes.')
  .option(
    '--cascading <number>',
    'Should cascading be used? `1` - true, `0` - false, `null` - default.  Needs only for the SFU testing purposes.',
  )
  .action((options) => {
    new VideoBuddyClient('ring', options).init();
  });

program
  .command('livestream-bench')
  .description('Load a livestream call with receive-only viewers that also chat')
  .requiredOption('-i, --call-id <string>', 'Which livestream call should the bots watch?')
  .requiredOption('--api-key <string>', 'Stream app API key.')
  .requiredOption(
    '--api-secret <string>',
    'Stream app API secret, used locally to mint a token per bot. Never sent anywhere.',
  )
  .option('--call-type <string>', 'Type of the call.', 'livestream')
  .option('--channel-id <string>', 'Chat channel the bots post in. Omit to skip chat entirely.')
  .option('--channel-type <string>', 'Type of the chat channel.', 'livestream')
  .option('-c, --user-count <number>', 'How many bots should join?', 50)
  .option('-d, --duration <seconds>', 'How long should the benchmark run?', 300)
  .option('--user-id-prefix <string>', 'Prefix for the generated bot user ids.', 'bench')
  .option('--run-id <string>', 'Run id used in bot ids and results. Defaults to a timestamp.')
  .option('--pages-per-browser <number>', 'How many bot pages share one chromium process?', 10)
  .option('--pages-per-context <number>', 'How many bot pages share one BrowserContext?', 2)
  .option('--ramp-chunk <number>', 'How many bots should start per ramp step?', 5)
  .option('--ramp-delay <ms>', 'Delay between ramp steps.', 1000)
  .option('--join-retries <number>', 'How many times should a failed join be retried?', 3)
  .option(
    '--churn-interval <seconds>',
    'How often should some viewers leave and rejoin? 0 = never.',
    0,
  )
  .option('--churn-fraction <ratio>', 'What fraction of viewers should churn each time?', 0.2)
  .option('--video-width <number>', 'Preferred incoming video width.', 256)
  .option('--video-height <number>', 'Preferred incoming video height.', 144)
  .option('--no-video', 'Do not subscribe to incoming video at all.')
  .option('--message-interval <seconds>', "Base interval between a bot's messages.", 10)
  .option('--message-interval-jitter <ratio>', 'Random +/- fraction applied to the interval.', 0.4)
  .option('--message-text <string>', 'Fixed message body. Defaults to varied chatter.')
  .option('--bench-port <number>', 'Port for the local viewer page server. 0 picks a free one.', 0)
  .option('-o, --out <path>', 'Where to write the JSON results file.', './bench-results.json')
  .option(
    '--emit-dart-defines <path>',
    'Write a --dart-define-from-file JSON for the Flutter sample (api key, call id, user tokens).',
  )
  .option('--browser-channel <string>', 'Browser channel to launch (e.g. `chrome`, `msedge`).')
  .option('--show-window', 'Should browser windows be visible?', false)
  .option('--verbose', 'Should page console logs be recorded?', false)
  .action((options) => {
    new LivestreamBench(options).init();
  });

program.parse();
