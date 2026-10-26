const terminal = require('child_process');
const http = require('http');
const fs = require('fs');
const vm = require('vm');
const { Command } = require('commander');
const path = require('path');
const { VideoBuddyServer } = require('../lib/server');

const serverToken = 'server-test-secret';

function request(server, route, body, headers = {}) {
  const payload = (typeof body === 'string' ? body : JSON.stringify(body)) || '';
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        headers: {
          Authorization: `Bearer ${serverToken}`,
          'Content-Length': Buffer.byteLength(payload),
          'Content-Type': 'application/json',
          ...headers,
        },
        hostname: '127.0.0.1',
        method: route === '/stop' ? 'GET' : 'POST',
        path: route,
        port: server.address().port,
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => resolve({ status: res.statusCode, text }));
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

describe('video buddy HTTP server security', () => {
  let server;
  let previousToken;
  let execFile;
  let execFileSync;
  let exit;

  beforeEach(async () => {
    server = undefined;
    previousToken = process.env.STREAM_VIDEO_BUDDY_SERVER_TOKEN;
    process.env.STREAM_VIDEO_BUDDY_SERVER_TOKEN = serverToken;
    execFile = jest
      .spyOn(terminal, 'execFile')
      .mockImplementation((_file, _args, _options, done) => {
        done(null, '', '');
      });
    execFileSync = jest.spyOn(terminal, 'execFileSync').mockReturnValue(Buffer.from(''));
    jest.spyOn(terminal, 'exec').mockImplementation(() => {
      throw new Error('Shell execution is forbidden');
    });
    jest.spyOn(terminal, 'execSync').mockImplementation(() => {
      throw new Error('Shell execution is forbidden');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    server = await new VideoBuddyServer({ port: 0 }).init();
  });

  afterEach(async () => {
    if (server?.listening) {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    if (previousToken === undefined) {
      delete process.env.STREAM_VIDEO_BUDDY_SERVER_TOKEN;
    } else {
      process.env.STREAM_VIDEO_BUDDY_SERVER_TOKEN = previousToken;
    }
    jest.restoreAllMocks();
  });

  it('binds to loopback by default', () => {
    expect(server.address().address).toBe('127.0.0.1');
  });

  it('accepts an explicit listen address', async () => {
    const explicitServer = await new VideoBuddyServer({ host: '0.0.0.0', port: 0 }).init();
    try {
      expect(explicitServer.address().address).toBe('0.0.0.0');
    } finally {
      await new Promise((resolve) => explicitServer.close(resolve));
    }
  });

  it('refuses startup without a token', async () => {
    delete process.env.STREAM_VIDEO_BUDDY_SERVER_TOKEN;
    await expect(new VideoBuddyServer({ port: 0 }).init()).rejects.toThrow(
      'STREAM_VIDEO_BUDDY_SERVER_TOKEN',
    );
  });

  it.each(['', '   ', 'a b', 'a\nb'])('refuses startup with invalid token %p', async (token) => {
    process.env.STREAM_VIDEO_BUDDY_SERVER_TOKEN = token;
    await expect(new VideoBuddyServer({ port: 0 }).init()).rejects.toThrow(
      'STREAM_VIDEO_BUDDY_SERVER_TOKEN',
    );
  });

  it('reports listen failures', async () => {
    await expect(new VideoBuddyServer({ port: server.address().port }).init()).rejects.toThrow(
      'EADDRINUSE',
    );
  });

  it.each(['/join', '/ring', '/stop'])('requires authentication on %s', async (route) => {
    for (const authorization of ['', 'Bearer wrong', 'Bearer server-test-secrex', serverToken]) {
      const response = await request(server, route, '{invalid json', {
        Authorization: authorization,
      });
      expect(response.status).toBe(401);
    }
    expect(execFile).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('allows authenticated shutdown', async () => {
    const response = await request(server, '/stop');
    expect(response.status).toBe(200);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it.each([
    ['true', 'execFile', 'execFileSync'],
    ['false', 'execFileSync', 'execFile'],
  ])('passes shell syntax literally with async=%s', async (async, method, otherMethod) => {
    const message =
      'hello ; echo injected $(echo substitution) `echo tick` | cat & > file\n"quotes"';
    const response = await request(server, `/join?async=${async}`, {
      'call-id': '--help',
      camera: true,
      duration: 0,
      message,
      mic: false,
      token: 'call-secret',
      'user-count': '2',
    });
    expect(response.status).toBe(200);
    const execution = terminal[method];
    const otherExecution = terminal[otherMethod];
    expect(execution).toHaveBeenCalledTimes(1);
    expect(otherExecution).not.toHaveBeenCalled();
    const [file, args, options] = execution.mock.calls[0];
    expect({ args, file, shell: options.shell }).toStrictEqual({
      args: [
        path.resolve(__dirname, '../lib/index.js'),
        'join',
        '--call-id=--help',
        '--camera',
        '--duration=0',
        `--message=${message}`,
        '--token=call-secret',
        '--user-count=2',
      ],
      file: process.execPath,
      shell: false,
    });
    expect(options.env).not.toHaveProperty('STREAM_VIDEO_BUDDY_SERVER_TOKEN');
  });

  it('preserves option-like values through the real CLI parser', async () => {
    const response = await request(server, '/join', {
      'call-id': '--help',
      message: '--camera ; echo literal',
    });
    const args = execFileSync.mock.calls[0][1];
    const program = new Command();
    const client = jest.fn().mockImplementation(() => ({ init: jest.fn() }));
    const parse = jest.spyOn(program, 'parse').mockImplementation(() => {});
    const modules = {
      './client': { VideoBuddyClient: client },
      './server': { VideoBuddyServer },
      commander: { program },
    };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../lib/index.js'), 'utf8'), {
      require: (name) => modules[name],
    });
    parse.mockRestore();
    program.parse([process.execPath, ...args]);
    expect(response.status).toBe(200);
    expect(client).toHaveBeenCalledWith(
      'join',
      expect.objectContaining({
        callId: '--help',
        camera: false,
        message: '--camera ; echo literal',
      }),
    );
  });

  it('supports ring options and JSON with a charset', async () => {
    const response = await request(
      server,
      '/ring?async=true',
      { 'audio-call': true, cascading: null, duration: '1.5', 'user-id': 'someone with spaces' },
      { 'Content-Type': 'application/json; charset=utf-8' },
    );
    expect(response.status).toBe(200);
    expect(execFile.mock.calls[0][1]).toStrictEqual([
      path.resolve(__dirname, '../lib/index.js'),
      'ring',
      '--audio-call',
      '--cascading=null',
      '--duration=1.5',
      '--user-id=someone with spaces',
    ]);
  });

  it.each([
    null,
    [],
    '"primitive"',
    '{invalid json',
    {},
    { 'call-id': '' },
    { 'call-id': ' ' },
    { 'call-id': 123 },
    { 'call-id': 'ok', 'x; echo injected': true },
    { 'call-id': 'ok', help: true },
    { 'call-id': 'ok', constructor: 'inherited' },
    '{"call-id":"ok","__proto__":{}}',
    { 'audio-call': true, 'call-id': 'ok' },
    { 'call-id': 'ok', message: {} },
    { 'call-id': 'ok', message: [] },
    { 'call-id': 'ok', message: null },
    { 'call-id': 'ok', message: false },
    { 'call-id': 'ok', message: 'null\0byte' },
    { 'call-id': 'ok', camera: 'true' },
    { 'call-id': 'ok', camera: 1 },
    { 'call-id': 'ok', duration: '; echo injected' },
    { 'call-id': 'ok', duration: -1 },
    { 'call-id': 'ok', duration: '' },
    { 'call-id': 'ok', duration: 'Infinity' },
    { 'call-id': 'ok', duration: true },
    { 'call-id': 'ok', 'user-count': 1.5 },
    { 'call-id': 'ok', concurrent: 0 },
    { 'call-id': 'ok', cascading: 2 },
  ])('rejects malformed or unsupported arguments: %p', async (body) => {
    const response = await request(server, '/join?async=true', body);
    expect(response.status).toBe(400);
    expect(execFile).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('rejects join-only options on ring', async () => {
    const response = await request(server, '/ring', { 'call-id': 'call', 'user-id': 'user' });
    expect(response.status).toBe(400);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON content type before execution', async () => {
    const response = await request(
      server,
      '/join',
      { 'call-id': 'ok' },
      { 'Content-Type': 'text/plain' },
    );
    expect(response.status).toBe(400);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('returns a sanitized error when synchronous execution fails and stays available', async () => {
    execFileSync.mockImplementationOnce(() => {
      throw new Error('sensitive child arguments');
    });
    const response = await request(server, '/join', { 'call-id': 'ok' });
    expect(response).toStrictEqual({ status: 500, text: 'Buddy command failed.' });
    expect(console.error).toHaveBeenCalledWith('Buddy join failed.');
    const next = await request(server, '/join', { 'call-id': 'ok' });
    expect(next.status).toBe(200);
  });

  it('handles asynchronous child errors without exposing arguments', async () => {
    execFile.mockImplementationOnce((_file, _args, _options, done) => {
      done(new Error('sensitive child arguments'));
    });
    const response = await request(server, '/ring?async=true', { 'user-id': 'ok' });
    expect(response.status).toBe(200);
    expect(console.error).toHaveBeenCalledWith('Buddy ring failed.');
  });
});
