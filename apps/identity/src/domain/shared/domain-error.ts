/**
 * Base class for business rule violations. `code` is a stable identifier that adapters
 * map to transport-specific responses (e.g. HTTP Problem Details); the domain never knows about HTTP.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
