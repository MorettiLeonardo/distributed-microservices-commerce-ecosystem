import {
  calculateJwkThumbprint,
  importJWK,
  jwtVerify,
  SignJWT,
  type CryptoKey,
  type JSONWebKeySet,
  type JWK,
} from 'jose';
import type {
  AccessTokenClaims,
  AccessTokenIssuer,
  IssuedAccessToken,
} from '../../../application/ports/access-token-issuer.port.js';
import type { AccessTokenVerifier } from '../../../application/ports/access-token-verifier.port.js';
import type { Clock } from '../../../application/ports/clock.port.js';
import { UserRole } from '../../../domain/entities/user.entity.js';
import { UserId } from '../../../domain/value-objects/identifiers.js';

const ALGORITHM = 'ES256';

export type JoseAccessTokensOptions = {
  issuer: string;
  audience: string;
  ttlMs: number;
  clock: Clock;
};

/**
 * ES256 JWTs (ADR 0007). Signs with the private key; publishes the public key as a JWKS so
 * other services can verify tokens locally, picking the key by the `kid` header.
 */
export class JoseAccessTokens implements AccessTokenIssuer, AccessTokenVerifier {
  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly publicKey: CryptoKey,
    private readonly publicJwk: JWK & { kid: string },
    private readonly options: JoseAccessTokensOptions,
  ) {}

  static async fromPrivateJwk(
    privateJwk: JWK,
    options: JoseAccessTokensOptions,
  ): Promise<JoseAccessTokens> {
    const { kty, crv, x, y, d } = privateJwk;
    if (kty !== 'EC' || crv !== 'P-256' || !x || !y || !d) {
      throw new Error('JWT private key must be a P-256 EC private JWK');
    }
    const publicPart = { kty, crv, x, y };
    // RFC 7638 thumbprint: a stable kid derived from the key itself when none is given.
    const kid = privateJwk.kid ?? (await calculateJwkThumbprint(publicPart));
    const publicJwk = { ...publicPart, kid, alg: ALGORITHM, use: 'sig' };

    return new JoseAccessTokens(
      await importKey(privateJwk),
      await importKey(publicJwk),
      publicJwk,
      options,
    );
  }

  async issue(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    // JWT times are whole seconds; derive expiresAt from the same value that goes into `exp`.
    const issuedAt = Math.floor(this.options.clock.now().getTime() / 1000);
    const expiresAt = issuedAt + Math.floor(this.options.ttlMs / 1000);

    const token = await new SignJWT({
      email: claims.email,
      emailVerified: claims.emailVerified,
      role: claims.role,
    })
      .setProtectedHeader({ alg: ALGORITHM, kid: this.publicJwk.kid, typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(this.options.issuer)
      .setAudience(this.options.audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.privateKey);

    return { token, expiresAt: new Date(expiresAt * 1000) };
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.publicKey, {
        algorithms: [ALGORITHM],
        issuer: this.options.issuer,
        audience: this.options.audience,
        currentDate: this.options.clock.now(),
      });
      const { sub, email, emailVerified } = payload;
      // A role outside the known set is rejected, even on a correctly signed token.
      const role = UserRole.find((known) => known === payload['role']);
      if (
        typeof sub !== 'string' ||
        typeof email !== 'string' ||
        typeof emailVerified !== 'boolean' ||
        !role
      ) {
        return null;
      }
      return { userId: UserId(sub), email, emailVerified, role };
    } catch {
      return null;
    }
  }

  jwks(): JSONWebKeySet {
    return { keys: [this.publicJwk] };
  }
}

async function importKey(jwk: JWK): Promise<CryptoKey> {
  const key = await importJWK(jwk, ALGORITHM);
  if (key instanceof Uint8Array) throw new Error('Expected an asymmetric key');
  return key;
}
