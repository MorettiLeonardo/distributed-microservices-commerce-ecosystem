import {
  OneTimeToken,
  OneTimeTokenPurpose,
} from '../../../../domain/entities/one-time-token.entity.js';
import { OneTimeTokenId, TokenHash, UserId } from '../../../../domain/value-objects/identifiers.js';
import type { OneTimeTokenModel } from '../models/one-time-token.model.js';

export const OneTimeTokenMapper = {
  toDomain(row: OneTimeTokenModel): OneTimeToken {
    return OneTimeToken.restore({
      id: OneTimeTokenId(row.id),
      userId: UserId(row.userId),
      purpose: parsePurpose(row.purpose),
      tokenHash: TokenHash(row.tokenHash),
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt,
    });
  },

  toPersistence(token: OneTimeToken) {
    return {
      id: token.id,
      userId: token.userId,
      purpose: token.purpose,
      tokenHash: token.tokenHash,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      consumedAt: token.consumedAt,
    };
  },
};

function parsePurpose(value: string): OneTimeTokenPurpose {
  const purpose = OneTimeTokenPurpose.find((known) => known === value);
  if (!purpose) throw new Error(`Unknown one-time token purpose in database: ${value}`);
  return purpose;
}
