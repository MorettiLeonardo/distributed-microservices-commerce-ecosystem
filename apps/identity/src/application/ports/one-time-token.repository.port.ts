import type {
  OneTimeToken,
  OneTimeTokenPurpose,
} from '../../domain/entities/one-time-token.entity.js';
import type { TokenHash } from '../../domain/value-objects/identifiers.js';

export interface OneTimeTokenRepository {
  findByHash(hash: TokenHash, purpose: OneTimeTokenPurpose): Promise<OneTimeToken | null>;
  save(token: OneTimeToken): Promise<void>;
}
