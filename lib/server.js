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
    invokeBuddy(`${options.programName} join`, req.body, req.query.async);
    res.status(200).send();
  });
}

function invokeBuddy(command, args, async) {
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
