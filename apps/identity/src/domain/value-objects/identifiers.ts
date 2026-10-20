import type { Brand } from '../shared/brand.js';

export type UserId = Brand<string, 'UserId'>;
export const UserId = (value: string): UserId => value as UserId;

export type SessionId = Brand<string, 'SessionId'>;
export const SessionId = (value: string): SessionId => value as SessionId;

export type OneTimeTokenId = Brand<string, 'OneTimeTokenId'>;
export const OneTimeTokenId = (value: string): OneTimeTokenId => value as OneTimeTokenId;

/** SHA-256 of a refresh or one-time token. Raw tokens are never stored. */
export type TokenHash = Brand<string, 'TokenHash'>;
export const TokenHash = (value: string): TokenHash => value as TokenHash;

/** Output of the password hashing algorithm (bcrypt). */
export type PasswordHash = Brand<string, 'PasswordHash'>;
export const PasswordHash = (value: string): PasswordHash => value as PasswordHash;
