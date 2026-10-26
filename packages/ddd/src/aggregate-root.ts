/**
 * Aggregates record domain events as part of their state changes.
 * The application layer pulls them after persisting the aggregate and publishes them.
 */
export abstract class AggregateRoot<TEvent> {
  #events: TEvent[] = [];

  protected record(event: TEvent): void {
    this.#events.push(event);
  }

  pullEvents(): TEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }
}
