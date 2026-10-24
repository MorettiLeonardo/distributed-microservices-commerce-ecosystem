/**
 * Prints a fresh ES256 private key as a JWT_PRIVATE_KEY line for the .env file.
 * The kid is the key's RFC 7638 thumbprint, so it changes whenever the key does.
 */
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose';

const { privateKey } = await generateKeyPair('ES256', { extractable: true });
const jwk = await exportJWK(privateKey);
const { kty, crv, x, y } = jwk;
if (!kty || !crv || !x || !y) throw new Error('Unexpected JWK export');
jwk.kid = await calculateJwkThumbprint({ kty, crv, x, y });

process.stdout.write(`JWT_PRIVATE_KEY='${JSON.stringify(jwk)}'\n`);
