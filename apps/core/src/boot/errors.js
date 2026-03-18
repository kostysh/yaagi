export class BootInvariantError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "BootInvariantError";
    this.code = code;
    this.details = details;
  }
}
