export class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  warn(...args) {
    console.warn(...args);
  }

  error(...args) {
    console.error(...args);
  }

  info(...args) {
    console.info(...args);
  }

  debug(...args) {
    if (this.verbose) {
      console.debug(...args);
    }
  }
}
