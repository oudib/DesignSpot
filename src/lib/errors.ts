// A failure a caller can show to a user or map to an HTTP status. Thrown by the
// shared ticket/delivery services (src/lib/tickets.ts, src/lib/deliveries.ts),
// which sit under both the /manage server actions and the /api/v1 routes.
export class ServiceError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409,
    message: string
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const badRequest = (m: string) => new ServiceError(400, m);
export const forbidden = (m = "You can't modify this item.") => new ServiceError(403, m);
export const notFound = (m = "Not found.") => new ServiceError(404, m);
