'use strict';

// Node 24 supplies fetch and WebSocket. No npm packages or installed drivers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');

const ROOT = path.resolve(__dirname, '..');
const REQUEST_MS = 15_000;
const READY_MS = 75_000;

async function waitFor(label, read, { timeout = 15_000, interval = 75, signal } = {}) {
  const end = Date.now() + timeout;
  let last;
  do {
    signal?.throwIfAborted();
    last = await read();
    if (last) return last;
    const left = end - Date.now();
    if (left <= 0) break;
    await delay(Math.min(interval, left), undefined, { signal });
  } while (Date.now() < end);
  throw new Error(`Timed out after ${timeout}ms: ${label}; last result: ${JSON.stringify(last)}`);
}

function bounded(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out (${ms}ms)`)), ms); })
  ]).finally(() => clearTimeout(timer));
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function browserExecutable() {
  const env = process.env;
  const candidates = env.BC_BROWSER ? [env.BC_BROWSER] : [
    path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ...String(env.PATH || '').split(path.delimiter).flatMap((dir) =>
      ['msedge', 'chrome', 'chromium', 'chromium-browser', 'google-chrome'].map((name) =>
        path.join(dir, name + (process.platform === 'win32' ? '.exe' : ''))))
  ];
  const found = candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
  assert.ok(found, 'Chromium/Edge not found. Set BC_BROWSER to its executable path.');
  return found;
}

function asURL(value) {
  return /^(https?|file):/i.test(value) ? new URL(value) : pathToFileURL(path.resolve(value));
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextID = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.error) entry.reject(new Error(`${entry.method}: ${JSON.stringify(message.error)}`));
        else entry.resolve(message.result);
      } else {
        for (const listener of this.listeners) listener(message);
      }
    });
    const lost = () => {
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new Error(`CDP disconnected during ${entry.method}`));
      }
      this.pending.clear();
    };
    ws.addEventListener('close', lost);
    ws.addEventListener('error', lost);
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    try {
      await bounded(new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', () => reject(new Error(`Cannot connect CDP: ${url}`)), { once: true });
      }), REQUEST_MS, 'CDP connection');
      return new CDP(ws);
    } catch (error) {
      ws.close();
      throw error;
    }
  }

  send(method, params = {}, sessionId, timeout = REQUEST_MS) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextID;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out (${timeout}ms)`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer, method });
      try { this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }

  close() { this.ws.close(); }
}

class Page {
  constructor(lab, contextID, sessionID, label) {
    this.lab = lab;
    this.contextID = contextID;
    this.sessionID = sessionID;
    this.label = label;
    this.exceptions = [];
    this.consoleErrors = [];
    this.log = [];
    this.frames = [];
    this.listener = (message) => {
      if (message.sessionId !== sessionID) return;
      const p = message.params;
      if (message.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text);
      }
      if (message.method === 'Runtime.consoleAPICalled' && p.type === 'error') {
        this.consoleErrors.push(p.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
      if (message.method === 'Log.entryAdded') {
        this.log.push(p.entry);
        if (this.log.length > 100) this.log.shift();
      }
      if (message.method === 'Network.webSocketFrameReceived' || message.method === 'Network.webSocketFrameSent') {
        try {
          const value = JSON.parse(p.response.payloadData);
          this.frames.push({ direction: message.method.endsWith('Received') ? 'in' : 'out', value });
          if (this.frames.length > 300) this.frames.shift();
        } catch { /* MQTT/binary payloads are not LAN JSON. */ }
      }
    };
    lab.cdp.listeners.add(this.listener);
  }

  send(method, params, timeout) { return this.lab.cdp.send(method, params, this.sessionID, timeout); }

  async evaluate(code, arg) {
    const expression = typeof code === 'function' ? `(${code.toString()})(${JSON.stringify(arg) ?? ''})` : code;
    const response = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true, userGesture: true, timeout: REQUEST_MS - 1_000
    });
    if (response.exceptionDetails) {
      throw new Error(`${this.label}: ${response.exceptionDetails.exception?.description || response.exceptionDetails.text}`);
    }
    assert.notEqual(response.result?.subtype, 'error', `${this.label}: ${response.result?.description}`);
    return response.result?.value;
  }

  async wait(label, code, arg, options) {
    let observation;
    try {
      return await waitFor(`${this.label}: ${label}`, async () => {
        observation = await this.evaluate(code, arg);
        return observation;
      }, options);
    } catch (error) {
      error.message += `\nLast observation: ${JSON.stringify(observation)}\nExceptions: ${JSON.stringify(this.exceptions)}`;
      throw error;
    }
  }

  async viewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: height
    });
    await this.wait('viewport resize', ({ width, height }) => innerWidth === width && innerHeight === height, { width, height });
  }

  async click(selector) {
    const point = await this.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`Missing click target ${selector}`);
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (!el.contains(document.elementFromPoint(x, y))) throw new Error(`Click target occluded: ${selector}`);
      return { x, y };
    }, selector);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  }

  async play() {
    await this.click('#play');
    await this.wait('real pointer lock and ready gameplay', () =>
      document.pointerLockElement === window.__blockcraft.renderer.domElement &&
      window.__bcTest.api('isGameplayInputActive')() && !window.__bcTest.api('gameplayKeyboardCapture').starting);
  }

  async lock() {
    await this.send('Page.bringToFront');
    const restart = await this.evaluate(() => {
      document.activeElement?.blur();
      if (document.pointerLockElement === window.__blockcraft.renderer.domElement && window.__bcTest.api('isGameplayInputActive')()) return false;
      if (document.pointerLockElement) document.exitPointerLock();
      return true;
    });
    if (restart) {
      await this.wait('previous input capture released', () => !document.pointerLockElement);
      // Re-enter through a real click so pointer/fullscreen/keyboard requests carry
      // transient user activation. Raw evaluate calls cannot do that reliably.
      const menuUp = await this.evaluate(() => !document.getElementById('hint').classList.contains('hidden'));
      if (menuUp) {
        await this.click('#play');
      } else {
        // API-driven combat mode hides the menu without starting pointer lock.
        // Restore the real resume surface, then use its activation path.
        await this.evaluate(() => document.getElementById('hint').classList.remove('hidden'));
        await this.click('#play');
      }
    }
    try {
      await this.wait('active gameplay pointer lock', () =>
        window.__bcTest.api('isGameplayInputActive')() && !window.__bcTest.api('gameplayKeyboardCapture').starting);
    } catch (error) {
      const state = await this.evaluate(() => ({
        pointer: document.pointerLockElement === window.__blockcraft.renderer.domElement,
        active: window.__bcTest.api('isGameplayInputActive')(),
        focus: document.activeElement.id || document.activeElement.tagName,
        hasFocus: document.hasFocus(), hidden: document.hidden,
        alwaysOnTop: !!document.fullscreenElement,
        hintHidden: document.getElementById('hint').classList.contains('hidden'),
        capture: { ...window.__bcTest.api('gameplayKeyboardCapture') }
      })).catch((e) => ({ unavailable: e.message }));
      error.message += `\nlock state: ${JSON.stringify(state)}`;
      throw error;
    }
  }

  async screenshot(name) {
    const result = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    return this.lab.image(name, result.data);
  }

  assertHealthy() {
    assert.deepEqual(this.exceptions, [], `${this.label}: uncaught JavaScript exceptions`);
    assert.deepEqual(this.consoleErrors, [], `${this.label}: application console errors`);
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    this.lab.record(`page:${this.label}`, {
      exceptions: this.exceptions, consoleErrors: this.consoleErrors, log: this.log, frames: this.frames.slice(-30)
    });
    this.lab.cdp.listeners.delete(this.listener);
    await this.lab.cdp.send('Target.disposeBrowserContext', { browserContextId: this.contextID });
  }
}

class Lab {
  constructor() {
    assert.ok(Number(process.versions.node.split('.')[0]) >= 24, 'Regression verification requires Node 24+.');
    this.processes = [];
    this.pages = [];
    this.results = {};
    this.onExit = () => {
      for (const child of this.processes) {
        if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
        if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 4_000 });
        else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } }
      }
    };
    this.onSignal = (signal) => {
      this.close().catch((error) => console.error(error)).finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
    };
    this.sigint = () => this.onSignal('SIGINT');
    this.sigterm = () => this.onSignal('SIGTERM');
    process.once('exit', this.onExit);
    process.once('SIGINT', this.sigint);
    process.once('SIGTERM', this.sigterm);
  }

  async start() {
    const temp = path.join(process.env.TEMP || os.tmpdir(), 'opencode');
    await fsp.mkdir(temp, { recursive: true });
    this.artifacts = await fsp.mkdtemp(path.join(temp, 'blockcraft-regression-'));
    this.profile = path.join(this.artifacts, 'browser-profile');
    await fsp.mkdir(this.profile);
    console.log(`Regression artifacts: ${this.artifacts}`);

    const port = await freePort();
    this.httpURL = `http://127.0.0.1:${port}/index.html`;
    this.wsURL = `ws://127.0.0.1:${port}`;
    this.fileURL = pathToFileURL(path.join(ROOT, 'index.html')).href;
    this.baseURL = process.env.BC_BASE ? asURL(process.env.BC_BASE).href : this.httpURL;
    const server = this.launch(process.execPath, [path.join(ROOT, 'server.js')], 'server', { ...process.env, PORT: String(port) });
    await waitFor('owned HTTP server', async () => {
      this.checkChild(server, 'server');
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1_000) });
        const value = await res.json();
        return res.ok && value.ok;
      } catch { return false; }
    }, { timeout: 15_000 });

    const browser = this.launch(browserExecutable(), [
      '--headless=new', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows', '--mute-audio', '--window-size=1280,720',
      '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
      `--user-data-dir=${this.profile}`,
      ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      'about:blank'
    ], 'chromium');
    // Chromium binds port 0 atomically; concurrent runs cannot choose the same port.
    const endpoint = await waitFor('owned Chromium DevTools endpoint', async () => {
      this.checkChild(browser, 'Chromium');
      try {
        const [port, route] = (await fsp.readFile(path.join(this.profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
        return /^\d+$/.test(port) && route?.startsWith('/devtools/browser/') ? `ws://127.0.0.1:${port}${route}` : false;
      } catch { return false; }
    }, { timeout: 30_000 });
    this.cdp = await CDP.connect(endpoint);
    this.record('environment', { node: process.version, browser: await this.cdp.send('Browser.getVersion'), base: this.baseURL });
    return this;
  }

  launch(executable, args, label, env = process.env) {
    const child = spawn(executable, args, { cwd: ROOT, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    this.processes.push(child);
    child.startError = null;
    child.once('error', (error) => { child.startError = error; });
    child.done = new Promise((resolve) => { child.once('exit', resolve); child.once('error', resolve); });
    const log = fs.createWriteStream(path.join(this.artifacts, `${label}.log`));
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.once('close', () => log.end());
    return child;
  }

  checkChild(child, label) {
    if (child.startError) throw child.startError;
    assert.equal(child.exitCode, null, `${label} exited early (${child.exitCode}); see ${this.artifacts}`);
    assert.equal(child.signalCode, null, `${label} was terminated; see ${this.artifacts}`);
  }

  async page(label, { base = this.baseURL, solo = true, width = 1280, height = 720 } = {}) {
    const { browserContextId } = await this.cdp.send('Target.createBrowserContext');
    let page;
    try {
      const { targetId } = await this.cdp.send('Target.createTarget', { url: 'about:blank', browserContextId, newWindow: true });
      const { sessionId } = await this.cdp.send('Target.attachToTarget', { targetId, flatten: true });
      page = new Page(this, browserContextId, sessionId, label);
      this.pages.push(page);
      await Promise.all(['Runtime.enable', 'Page.enable', 'Log.enable', 'Network.enable'].map((method) => page.send(method)));
      await page.viewport(width, height);
      const url = asURL(base);
      // Every connection goes to this run's disposable server, including BC_BASE.
      // A supplied room code never joins a retained public MQTT room.
      url.searchParams.delete('room');
      url.searchParams.delete('shot');
      url.searchParams.set('server', this.wsURL);
      await page.send('Page.navigate', { url: url.href });
      await page.wait('world boot', () => {
        const err = document.getElementById('err');
        if (err && getComputedStyle(err).display !== 'none' && err.textContent.trim()) throw new Error(err.textContent);
        const b = window.__blockcraft;
        return !!b && !document.getElementById('play')?.disabled && b.renderer.info.render.triangles > 0;
      }, undefined, { timeout: READY_MS, interval: 200 });
      if (solo) {
        await page.evaluate(() => {
          const n = window.__blockcraft.net;
          n.closedByUs = true;
          if (n.ws) n.ws.close();
        });
        await page.wait('solo socket closed', () => !window.__blockcraft.net.ws);
      }
      const { installKit } = require('./page-kit.cjs');
      await page.evaluate(installKit);
      page.assertHealthy();
      return page;
    } catch (error) {
      if (page) await page.close().catch(() => {});
      else await this.cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
      throw error;
    }
  }

  record(name, value) { this.results[name] = value; }

  async image(name, base64) {
    const file = path.join(this.artifacts, name.replace(/[^a-zA-Z0-9._-]/g, '-') + '.png');
    await fsp.writeFile(file, Buffer.from(base64.replace(/^data:image\/png;base64,/, ''), 'base64'));
    return file;
  }

  close() {
    if (!this.closing) this.closing = this.cleanup();
    return this.closing;
  }

  async cleanup() {
    const errors = [];
    const attempt = async (run) => { try { await run(); } catch (error) { errors.push(error.message); } };
    if (this.cdp) {
      for (const page of this.pages) await attempt(() => page.close());
      this.cdp.close();
    }
    // Terminate the owned tree while its root PID still exists. Closing the root
    // first can orphan Chromium helpers before Windows taskkill /T can find them.
    for (const child of [...this.processes].reverse()) {
      if (!child.pid) continue;
      if (child.exitCode === null && child.signalCode === null) {
        if (process.platform === 'win32') {
          const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
          try {
            await attempt(() => bounded(new Promise((resolve, reject) => {
              killer.once('error', reject);
              killer.once('exit', resolve);
            }), 5_000, `taskkill ${child.pid}`));
          } finally { if (killer.exitCode === null) killer.kill(); }
        } else { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') errors.push(error.message); } }
      }
      await attempt(() => bounded(child.done, 5_000, `process ${child.pid} exit`));
    }
    if (this.profile) await attempt(() => fsp.rm(this.profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 }));
    if (this.artifacts) {
      this.record('cleanup', { errors });
      await fsp.writeFile(path.join(this.artifacts, 'report.json'), JSON.stringify(this.results, null, 2));
    }
    // Keep the synchronous fallback installed if any child is still owned/live.
    if (this.processes.every((p) => !p.pid || p.exitCode !== null || p.signalCode !== null)) process.removeListener('exit', this.onExit);
    process.removeListener('SIGINT', this.sigint);
    process.removeListener('SIGTERM', this.sigterm);
    assert.deepEqual(errors, [], 'Regression resource cleanup failed');
  }
}

module.exports = { Lab, waitFor, ROOT };
