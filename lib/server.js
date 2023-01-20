const terminal = require('child_process');
const express = require('express');

class VideoBuddyServer {
  constructor(options, programName) {
    this.options = options;
    this.programName = programName;
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

  app.post(`/${this.programName}`, (req, res) => {
    callBuddy(req.body, req.query.async);
    res.status(200).send();
  });
}

function callBuddy(args, async) {
  let command = `${this.programName} join`;

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
