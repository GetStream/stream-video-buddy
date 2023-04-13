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

  app.post(`/${options.programName}`, (req, res) => {
    ensureRequiredHeaders(req, res);
    invokeBuddy(`${options.programName} join`, req.body, req.query.async);
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

  console.log(`[async: ${asyncMode}] ${command}`);
  if (asyncMode) {
    return terminal.exec(command);
  } else {
    return terminal.execSync(command);
  }
}

function ensureRequiredHeaders(req, res) {
  const statusCode = req.get('Content-Type') === 'application/json' ? 200 : 400;
  res.status(statusCode).send();
  if (statusCode === 400) throw new Error('`Content-Type` header has to be `application/json`.');
}
