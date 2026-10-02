/** Error con código HTTP (sin dependencias de servidor, se puede usar en scripts). */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
