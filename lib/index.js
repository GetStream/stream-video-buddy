#! /usr/bin/env node
const { Authentication } = require('./auth');
const { chromium } = require('playwright');
const { program } = require('commander');
const terminal = require('child_process');
const express = require('express');

program
  .name('stream-video-buddy')
  .description('Short story about stream-video-buddy')
  .version('1.0.0');

program
  .command('server')
  .description('Starts a server')
  .option('-p, --port <number>', 'Port number', 4567)
  .action((options) => startServer(options));

program
  .command('join')
  .description('Joins a call')
  .requiredOption('-i, --call-id <string>', 'Call id')
  .option('-w, --wait <number>', 'When to close the browser after action complete, in seconds', 0)
  .option('-c, --users-count <number>', 'Users count', 1)
  .option('--show-window', 'Should browser headless mode be turned off?', false)
  .action((options) => joinCall(options));

program.parse();

function startServer(options) {
  const app = express();

  app.use(express.json());

  app.listen(options.port);

  app.post(`/${program.name()}`, (req, res) => {
    buddy(req.body, req.query.async);
    res.status(200).send();
  });
}

function buddy(args, async) {
  let command = `${program.name()} join`;

  Object.keys(args).forEach(function (key) {
    if (args[key] === true) {
      command += ` --${key}`;
    } else if (args[key] !== false) {
      command += ` --${key} ${args[key]}`;
    }
  });

  if (async === 'true') {
    return terminal.exec(command);
  } else {
    return terminal.execSync(command);
  }
}

async function joinCall(options) {
  ensureEnvVars();
  const browser = await getBrowser(options);
  const context = await browser.newContext();
  const page = await context.newPage();
  await new Authentication(page, options).init();
  await page.waitForSelector("input[type='text']", { visible: true });
  await page.type("input[type='text']", options.callId);
  await page.click("button:text('Join')");
  if (options.usersCount > 1) {
    await addUsers(context, options);
  }
  await sleep(options.wait);
  await browser.close();
}

async function addUsers(context, options) {
  for (let i = 1; i < options.usersCount; i++) {
    const newPage = await context.newPage();
    const randomId = `buddy_${Math.floor(Math.random() * 10_000)}`;
    await newPage.goto(
      `${process.env.STREAM_SDK_TEST_APP}/join/${options.callId}?user_id=${randomId}`,
    );
  }
}

async function getBrowser(options) {
  return await chromium.launch({
    args: ['--disable-dev-shm-usage', '--no-sandbox'], // This makes Chrome more stable on CI
    browserName: 'chromium',
    headless: !options.showWindow,
    ignoreHTTPSErrors: true,
    locale: 'en-US',
  });
}

async function sleep(ms) {
  return await new Promise((resolve) => setTimeout(resolve, ms * 1000));
}

function ensureEnvVars() {
  const appUrl = process.env.STREAM_SDK_TEST_APP ?? '';
  const email = process.env.STREAM_SDK_TEST_ACCOUNT_EMAIL ?? '';
  const password = process.env.STREAM_SDK_TEST_ACCOUNT_PASSWORD ?? '';

  if (appUrl == null || email == null || password == null) {
    throw new Error('App url, email and password should be provided.');
  }
}
