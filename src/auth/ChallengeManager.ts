// ═══════════════════════════════════════════════════════════════
// src/auth/ChallengeManager.ts — Auth Challenge Generator
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// Generates unique, time-bound cryptographic signing challenges.
// Pattern: "Auth:[UUID]-[Timestamp]-GalacticaLendingBot"
// Borrower must sign this message with their Bitcoin private key.
// ═══════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid';
import { AuthChallenge }  from '@/types';
import { isExpired }      from '@/utils/helpers';
import Logger             from '@/utils/logger';

const CHALLENGE_EXPIRY_MS =
  parseInt(process.env.AUTH_CHALLENGE_EXPIRY_SECONDS ?? '300', 10) * 1000;

// In-memory store (use Redis/DB in production)
const challengeStore = new Map<string, AuthChallenge>();

export class ChallengeManager {
  /**
   * Generate a fresh signing challenge for a given Bitcoin address.
   * Returns the challenge object that must be presented to the borrower.
   */
  static generate(btcAddress: string): AuthChallenge {
    // Invalidate old challenges for this address
    for (const [key, ch] of challengeStore.entries()) {
      if (ch.btcAddress === btcAddress) {
        challengeStore.delete(key);
      }
    }

    const id        = uuidv4();
    const issuedAt  = Date.now();
    const expiresAt = issuedAt + CHALLENGE_EXPIRY_MS;

    // Human-readable message that the borrower's wallet will display
    const message = [
      `Auth:${id}`,
      `Address:${btcAddress}`,
      `Service:GalacticaLendingBot`,
      `Time:${new Date(issuedAt).toISOString()}`,
      `Note:Sign to verify ownership. This request will expire in 5 minutes.`,
    ].join('\n');

    const challenge: AuthChallenge = {
      id,
      message,
      btcAddress,
      issuedAt,
      expiresAt,
      used: false,
    };

    challengeStore.set(id, challenge);

    Logger.info('Challenge generated', { id, btcAddress, expiresAt });
    return challenge;
  }

  /**
   * Retrieve an active, unused challenge by its ID.
   */
  static get(challengeId: string): AuthChallenge | null {
    const challenge = challengeStore.get(challengeId);
    if (!challenge)               return null;
    if (isExpired(challenge.expiresAt)) {
      challengeStore.delete(challengeId);
      Logger.warn('Challenge expired', { challengeId });
      return null;
    }
    if (challenge.used) {
      Logger.warn('Challenge already used', { challengeId });
      return null;
    }
    return challenge;
  }

  /**
   * Mark a challenge as consumed (one-time use).
   */
  static consume(challengeId: string): boolean {
    const challenge = challengeStore.get(challengeId);
    if (!challenge) return false;
    challenge.used = true;
    challengeStore.set(challengeId, challenge);
    return true;
  }

  /**
   * Clean up expired challenges (call periodically).
   */
  static cleanup(): number {
    let removed = 0;
    for (const [key, ch] of challengeStore.entries()) {
      if (isExpired(ch.expiresAt) || ch.used) {
        challengeStore.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      Logger.info(`Cleaned up ${removed} expired challenges`);
    }
    return removed;
  }

  static get activeCount(): number {
    return challengeStore.size;
  }
}

export default ChallengeManager;
