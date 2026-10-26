const terminal = require('child_process');
const express = require('express');
const path = require('path');
const { timingSafeEqual } = require('crypto');

// Only options supported by the corresponding CLI command may cross the HTTP boundary.
const commonOptions = {
  cascading: 'cascading',
  duration: 'duration',
  'record-session': 'boolean',
  sfu: 'string',
  'show-window': 'boolean',
  'test-name': 'string',
  verbose: 'boolean',
};
const commandOptions = {
  join: {
    ...commonOptions,
    'api-key': 'string',
    app: 'string',
    'call-id': 'string',
    'call-type': 'string',
    camera: 'boolean',
    concurrent: 'count',
    message: 'string',
    'message-count': 'count',
    mic: 'boolean',
    parallel: 'boolean',
    record: 'boolean',
    'recording-duration': 'duration',
    'screen-share': 'boolean',
    'screen-sharing-duration': 'duration',
    silent: 'boolean',
    token: 'string',
    'use-main-page': 'boolean',
    'user-count': 'count',
  },
  ring: {
    ...commonOptions,
    'audio-call': 'boolean',
    'user-id': 'string',
  },
};

class VideoBuddyServer {
  constructor(options) {
    this.options = options;
  }

  async init() {
    this.server = await startServer(this.options);
    return this.server;
  }
}

module.exports = { VideoBuddyServer };

function startServer(options) {
  const token = process.env.STREAM_VIDEO_BUDDY_SERVER_TOKEN;
  if (!token || !token.trim() || /\s/.test(token)) {
    throw new Error('Set STREAM_VIDEO_BUDDY_SERVER_TOKEN to a non-empty token without whitespace.');
  }

  const expectedAuthorization = Buffer.from(`Bearer ${token}`);
  const app = express();
  app.use((req, res, next) => {
    const authorization = Buffer.from(req.get('Authorization') || '');
    if (
      authorization.length !== expectedAuthorization.length ||
      !timingSafeEqual(authorization, expectedAuthorization)
    ) {
      return res.status(401).send('Unauthorized');
    }
    next();
  });
  app.use(express.json());

  for (const command of ['join', 'ring']) {
    app.post(`/${command}`, (req, res) => {
      if (!req.is('application/json')) {
        return res.status(400).send('Content-Type must be application/json.');
      }

      let args;
      try {
        args = buildArguments(command, req.body);
      } catch (error) {
        return res.status(400).send(error.message);
      }

      try {
        invokeBuddy(command, args, req.query.async === 'true');
        res.status(200).send();
      } catch (_error) {
        // Child-process errors can contain command arguments, including call tokens.
        console.error(`Buddy ${command} failed.`);
        res.status(500).send('Buddy command failed.');
      }
    });
  }

  app.get('/stop', (_req, res) => {
    res.on('finish', () => {
      process.exit(0);
    });
    res.status(200).send('Server shutting down...');
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(options.port, options.host || '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
}

function buildArguments(command, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Body must be a JSON object.');
  }

  const required = command === 'join' ? 'call-id' : 'user-id';
  if (typeof body[required] !== 'string' || !body[required].trim()) {
    throw new Error(`A non-empty ${required} is required.`);
  }

  const schema = commandOptions[command];
  const args = [path.join(__dirname, 'index.js'), command];
  for (const key of Object.keys(body).sort()) {
    if (!Object.prototype.hasOwnProperty.call(schema, key)) {
      throw new Error('Unsupported option.');
    }
    const value = body[key];
    const type = schema[key];
    if (!isValidOption(type, value)) {
      throw new Error(`Invalid value for ${key}.`);
    }
    if (type === 'boolean') {
      if (value) args.push(`--${key}`);
    } else {
      // Attach values so leading dashes cannot be interpreted as another CLI option.
      args.push(`--${key}=${value}`);
    }
  }
  return args;
}

function isValidOption(type, value) {
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'string') return typeof value === 'string' && !value.includes('\0');
  if (type === 'cascading') return [0, 1, '0', '1', 'null', null].includes(value);
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  if (typeof value === 'string' && !value.trim()) return false;
  const number = Number(value);
  return type === 'count'
    ? Number.isSafeInteger(number) && number > 0
    : Number.isFinite(number) && number >= 0;
}

function invokeBuddy(command, args, asyncMode) {
  const env = { ...process.env };
  delete env.STREAM_VIDEO_BUDDY_SERVER_TOKEN;
  const executionOptions = { env, shell: false };
  if (asyncMode) {
    terminal.execFile(process.execPath, args, executionOptions, (error) => {
      if (error) console.error(`Buddy ${command} failed.`);
    });
  } else {
    terminal.execFileSync(process.execPath, args, executionOptions);
  }
}
