const terminal = require('child_process');
const express = require('express');

class VideoBuddyServer {
  constructor(options) {
    this.options = options;
  }

  async init() {
    await startServer(this.options);
  }
}

module.exports = { VideoBuddyServer };

function startServer(options) {
  const app = express();

  app.use(express.json());

  app.listen(options.port);

  app.post('/join', (req, res) => {
    ensureRequiredHeaders(req, res);
    invokeBuddy(`${options.programName} join`, req.body, req.query.async);
  });

  app.post('/ring', (req, res) => {
    ensureRequiredHeaders(req, res);
    invokeBuddy(`${options.programName} ring`, req.body, req.query.async);
  });

  app.get('/stop', (_req, res) => {
    res.status(200).send('Server shutting down...');
    res.on('finish', () => {
      process.exit(0);
    });
  });
}

function invokeBuddy(command, args, async) {
  const asyncMode = async === 'true';
  const keys = Object.keys(args).sort();

  keys.forEach(function (key) {
    if (args[key] === true) {
      command += ` --${key}`;
    } else if (args[key] !== false) {
      command += ` --${key} ${args[key]}`;
    }
  });

  console.log(`$ ${command} (async: ${asyncMode})`);
  if (asyncMode) {
    return terminal.exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr);
      } else {
        console.log(stdout);
      }
    });
  } else {
    console.log(terminal.execSync(command).toString());
  }
}

function ensureRequiredHeaders(req, res) {
  const contentType = req.get('Content-Type') || '';
  const statusCode = contentType.includes('application/json') ? 200 : 400;
  res.status(statusCode).send();
  if (statusCode === 400) throw new Error('`Content-Type` header must include `application/json`.');
}
