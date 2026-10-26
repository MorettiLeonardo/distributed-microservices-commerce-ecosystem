import type { RequestHandler } from 'express';

/** An error raised by the HTTP layer itself (authentication, routing), already in HTTP terms. */
export class HttpProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    title: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(title);
  }
}

/** Mount after every route: anything unmatched becomes a 404 problem. */
export const notFoundHandler: RequestHandler = () => {
  throw new HttpProblem(404, 'NOT_FOUND', 'Resource not found');
};
