export default class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (errors && Object.keys(errors).length > 0) {
      this.errors = errors;
    }
  }
}
