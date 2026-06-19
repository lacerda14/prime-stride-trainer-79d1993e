// Polyfills for Cloudflare Workers
if (typeof window === 'undefined') {
  globalThis.window = undefined;
}

// Browser globals needed by TanStack Router scroll restoration
if (typeof history === 'undefined') {
  globalThis.history = { scrollRestoration: 'auto', state: null, length: 1, pushState() {}, replaceState() {}, go() {}, back() {}, forward() {} };
}
if (typeof location === 'undefined') {
  globalThis.location = { href: 'http://localhost/', pathname: '/', search: '', hash: '', origin: 'http://localhost', host: 'localhost', protocol: 'http:', hostname: 'localhost', port: '' };
}
if (typeof document === 'undefined') {
  globalThis.document = { addEventListener() {}, removeEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, cookie: '', title: '' };
}

if (typeof MessageChannel === 'undefined') {
  class _MessagePort {
    constructor() { this.onmessage = null; }
    postMessage(data) {
      const port = this._partner;
      if (port && port.onmessage) {
        Promise.resolve().then(() => port.onmessage({ data, target: port }));
      }
    }
    close() {}
    addEventListener(type, fn) { if (type === 'message') this.onmessage = fn; }
    removeEventListener() {}
    start() {}
  }
  class _MessageChannel {
    constructor() {
      this.port1 = new _MessagePort();
      this.port2 = new _MessagePort();
      this.port1._partner = this.port2;
      this.port2._partner = this.port1;
    }
  }
  globalThis.MessageChannel = _MessageChannel;
}
