#! /usr/bin/env node
const { chromium } = require("playwright");
const { program } = require("commander");
const { Authentication } = require("./auth");

program
  .name("stream-video-buddy")
  .description("stream-video-buddy")
  .version("1.0.0");

program
  .command("join")
  .description("Joins a call")
  .requiredOption("-i, --call-id <string>", "Call id")
  .option("-w, --wait <number>", "When to close the browser after action complete, in seconds", 0)
  .option("-c, --users-count <number>", "Users count", 1)
  .option("--show-window", "Should browser headless mode be turned off?", false)
  .action((options) => join(options));

program.parse();

async function join(options) {
  ensureEnvVars();
  const browser = await getBrowser(options);
  const context = await browser.newContext();
  const page = await context.newPage();
  await new Authentication(page, options).init();
  await page.waitForSelector("input[type='text']", { visible: true });
  await page.type("input[type='text']", options.callId);
  await page.click("button:text('Join')");
  if (options.usersCount > 1) { await addUsers(context, options); }
  await sleep(options.wait);
  await browser.close();
}

async function addUsers(context, options) {
  for (let i = 1; i < options.usersCount; i++) {
    const newPage = await context.newPage();
    const randomId = `buddy_${Math.floor(Math.random() * 10_000)}`;
    await newPage.goto(`${process.env.STREAM_SDK_TEST_APP}/join/${options.callId}?user_id=${randomId}`);
  }
}

async function getBrowser(options) {
  return await chromium.launch({
    headless: !options.showWindow,
    ignoreHTTPSErrors: true,
    browserName: "chromium",
    locale: "en-US",
    args: ["--disable-dev-shm-usage", "--no-sandbox"] // This makes Chrome more stable on CI
  });
}

async function sleep(sec) {
  await new Promise(resolve => setTimeout(resolve, sec * 1000));
}

function ensureEnvVars() {
  const appUrl = process.env.STREAM_SDK_TEST_APP ?? "";
  const email = process.env.STREAM_SDK_TEST_ACCOUNT_EMAIL ?? "";
  const password = process.env.STREAM_SDK_TEST_ACCOUNT_PASSWORD ?? "";

  if (appUrl == null || email == null || password == null) {
    throw new Error("Stream SDK app url, email and password should be provided.");
  }
}
