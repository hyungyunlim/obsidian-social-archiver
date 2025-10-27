import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PasswordManager, PasswordRateLimiter, type PasswordValidationResult } from '@/services/PasswordManager';

describe('PasswordManager', () => {
  let passwordManager: PasswordManager;

  beforeEach(() => {
    passwordManager = new PasswordManager();
  });

  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'MySecure123!';
      const hash = await passwordManager.hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'MySecure123!';
      const hash1 = await passwordManager.hashPassword(password);
      const hash2 = await passwordManager.hashPassword(password);

      // Should be different due to random salt
      expect(hash1).not.toBe(hash2);
    });

    it('should reject password shorter than 8 characters', async () => {
      const shortPassword = 'abc123';

      await expect(passwordManager.hashPassword(shortPassword))
        .rejects.toThrow('Invalid password');
    });

    it('should reject all-numeric password', async () => {
      const numericPassword = '12345678';

      await expect(passwordManager.hashPassword(numericPassword))
        .rejects.toThrow('Invalid password');
    });

    it('should reject all-alphabetic password', async () => {
      const alphaPassword = 'abcdefgh';

      await expect(passwordManager.hashPassword(alphaPassword))
        .rejects.toThrow('Invalid password');
    });

    it('should accept password with letters and numbers', async () => {
      const validPassword = 'Passw0rd123';
      const hash = await passwordManager.hashPassword(validPassword);

      expect(hash).toBeDefined();
    });

    it('should accept password with special characters', async () => {
      const validPassword = 'P@ssw0rd!';
      const hash = await passwordManager.hashPassword(validPassword);

      expect(hash).toBeDefined();
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'MySecure123!';
      const hash = await passwordManager.hashPassword(password);

      const isValid = await passwordManager.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'MySecure123!';
      const wrongPassword = 'WrongPass456!';
      const hash = await passwordManager.hashPassword(password);

      const isValid = await passwordManager.verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should reject password with slight variations', async () => {
      const password = 'MySecure123!';
      const hash = await passwordManager.hashPassword(password);

      // Test various incorrect variations
      expect(await passwordManager.verifyPassword('MySecure123', hash)).toBe(false);
      expect(await passwordManager.verifyPassword('mysecure123!', hash)).toBe(false);
      expect(await passwordManager.verifyPassword('MySecure123! ', hash)).toBe(false);
    });

    it('should handle invalid hash format gracefully', async () => {
      const password = 'MySecure123!';
      const invalidHash = 'not-a-valid-hash';

      const isValid = await passwordManager.verifyPassword(password, invalidHash);

      expect(isValid).toBe(false);
    });

    it('should be case-sensitive', async () => {
      const password = 'Password123!';
      const hash = await passwordManager.hashPassword(password);

      expect(await passwordManager.verifyPassword('password123!', hash)).toBe(false);
      expect(await passwordManager.verifyPassword('PASSWORD123!', hash)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const result = passwordManager.validatePassword('MyP@ssw0rd123');

      expect(result.valid).toBe(true);
      expect(result.strength).toBe('strong');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate medium strength password', () => {
      const result = passwordManager.validatePassword('Password123');

      expect(result.valid).toBe(true);
      expect(result.strength).toBe('medium');
      expect(result.errors).toHaveLength(0);
    });

    it('should classify weak but valid password', () => {
      const result = passwordManager.validatePassword('pass1234');

      expect(result.valid).toBe(true);
      // 'pass1234' has lowercase + numbers (2 criteria), 8 chars = medium
      expect(result.strength).toBe('medium');
    });

    it('should reject password shorter than 8 characters', () => {
      const result = passwordManager.validatePassword('abc123');

      expect(result.valid).toBe(false);
      expect(result.strength).toBeUndefined();
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject all-numeric password', () => {
      const result = passwordManager.validatePassword('12345678');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password cannot be all numbers');
    });

    it('should reject all-alphabetic password', () => {
      const result = passwordManager.validatePassword('abcdefgh');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password should contain numbers or special characters');
    });

    it('should allow very long passwords', () => {
      const longPassword = 'ThisIsAVeryLongPasswordWithNumbers123AndSpecialCharacters!';
      const result = passwordManager.validatePassword(longPassword);

      expect(result.valid).toBe(true);
    });

    it('should calculate strength based on character diversity', () => {
      // Medium: lowercase + numbers only (2 criteria)
      expect(passwordManager.validatePassword('password123').strength).toBe('medium');

      // Medium: lowercase + uppercase + numbers (3 criteria, but < 12 chars)
      expect(passwordManager.validatePassword('Password123').strength).toBe('medium');

      // Strong: lowercase + uppercase + numbers + special + 12+ chars
      expect(passwordManager.validatePassword('Password123!@#').strength).toBe('strong');
    });
  });

  describe('generatePassword', () => {
    it('should generate password with default length (16)', () => {
      const password = passwordManager.generatePassword();

      expect(password).toHaveLength(16);
    });

    it('should generate password with custom length', () => {
      const lengths = [8, 12, 20, 32];

      lengths.forEach(length => {
        const password = passwordManager.generatePassword(length);
        expect(password).toHaveLength(length);
      });
    });

    it('should generate different passwords each time', () => {
      const password1 = passwordManager.generatePassword();
      const password2 = passwordManager.generatePassword();

      expect(password1).not.toBe(password2);
    });

    it('should only contain allowed characters', () => {
      const password = passwordManager.generatePassword(100);
      const allowedChars = /^[a-zA-Z0-9!@#$%^&*]+$/;

      expect(password).toMatch(allowedChars);
    });

    it('should generate valid passwords', () => {
      const password = passwordManager.generatePassword(16);
      const validation = passwordManager.validatePassword(password);

      // Generated passwords should be valid
      expect(validation.valid).toBe(true);
    });

    it('should generate passwords with good entropy', () => {
      const passwords = new Set();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        passwords.add(passwordManager.generatePassword());
      }

      // All passwords should be unique
      expect(passwords.size).toBe(iterations);
    });
  });

  describe('edge cases', () => {
    it('should handle empty password', async () => {
      const result = passwordManager.validatePassword('');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle password with unicode characters', async () => {
      const unicodePassword = 'P@ssw0rd123好';
      const hash = await passwordManager.hashPassword(unicodePassword);
      const isValid = await passwordManager.verifyPassword(unicodePassword, hash);

      expect(isValid).toBe(true);
    });

    it('should handle password with spaces', async () => {
      const passwordWithSpaces = 'My Pass 123!';
      const hash = await passwordManager.hashPassword(passwordWithSpaces);
      const isValid = await passwordManager.verifyPassword(passwordWithSpaces, hash);

      expect(isValid).toBe(true);
    });
  });
});

describe('PasswordRateLimiter', () => {
  let rateLimiter: PasswordRateLimiter;
  let mockKV: KVNamespace;

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    } as any;

    rateLimiter = new PasswordRateLimiter(mockKV);
  });

  describe('checkLimit', () => {
    it('should allow access when no previous attempts', async () => {
      vi.mocked(mockKV.get).mockResolvedValueOnce(null);

      const result = await rateLimiter.checkLimit('192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it('should track remaining attempts', async () => {
      const attemptData = {
        attempts: 2,
        firstAttempt: Date.now()
      };

      vi.mocked(mockKV.get).mockResolvedValueOnce(attemptData as any);

      const result = await rateLimiter.checkLimit('192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
    });

    it('should block after max attempts (5)', async () => {
      const attemptData = {
        attempts: 5,
        firstAttempt: Date.now()
      };

      vi.mocked(mockKV.get).mockResolvedValueOnce(attemptData as any);

      const result = await rateLimiter.checkLimit('192.168.1.1');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after time window (1 hour)', async () => {
      const oldAttemptData = {
        attempts: 5,
        firstAttempt: Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago
      };

      vi.mocked(mockKV.get).mockResolvedValueOnce(oldAttemptData as any);

      const result = await rateLimiter.checkLimit('192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(mockKV.delete).toHaveBeenCalledWith('pwd-limit:192.168.1.1');
    });

    it('should handle different IPs independently', async () => {
      const ip1Data = { attempts: 5, firstAttempt: Date.now() };
      const ip2Data = null;

      vi.mocked(mockKV.get)
        .mockResolvedValueOnce(ip1Data as any)
        .mockResolvedValueOnce(ip2Data);

      const result1 = await rateLimiter.checkLimit('192.168.1.1');
      const result2 = await rateLimiter.checkLimit('192.168.1.2');

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('recordAttempt', () => {
    it('should start new window for first attempt', async () => {
      vi.mocked(mockKV.get).mockResolvedValueOnce(null);

      await rateLimiter.recordAttempt('192.168.1.1');

      expect(mockKV.put).toHaveBeenCalledWith(
        'pwd-limit:192.168.1.1',
        expect.stringContaining('"attempts":1'),
        expect.objectContaining({
          expirationTtl: 3600 // 1 hour
        })
      );
    });

    it('should increment existing attempts', async () => {
      const existingData = {
        attempts: 2,
        firstAttempt: Date.now()
      };

      vi.mocked(mockKV.get).mockResolvedValueOnce(existingData as any);

      await rateLimiter.recordAttempt('192.168.1.1');

      expect(mockKV.put).toHaveBeenCalledWith(
        'pwd-limit:192.168.1.1',
        expect.stringContaining('"attempts":3'),
        expect.any(Object)
      );
    });

    it('should reset window if expired', async () => {
      const expiredData = {
        attempts: 5,
        firstAttempt: Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago
      };

      vi.mocked(mockKV.get).mockResolvedValueOnce(expiredData as any);

      await rateLimiter.recordAttempt('192.168.1.1');

      // Should start new window with attempts = 1
      const putCall = vi.mocked(mockKV.put).mock.calls[0];
      const savedData = JSON.parse(putCall[1] as string);

      expect(savedData.attempts).toBe(1);
    });
  });

  describe('resetLimit', () => {
    it('should delete rate limit entry', async () => {
      await rateLimiter.resetLimit('192.168.1.1');

      expect(mockKV.delete).toHaveBeenCalledWith('pwd-limit:192.168.1.1');
    });

    it('should allow access after reset', async () => {
      // First, block the IP
      const blockedData = {
        attempts: 5,
        firstAttempt: Date.now()
      };

      vi.mocked(mockKV.get).mockResolvedValueOnce(blockedData as any);

      let result = await rateLimiter.checkLimit('192.168.1.1');
      expect(result.allowed).toBe(false);

      // Reset the limit
      await rateLimiter.resetLimit('192.168.1.1');

      // Now should be allowed
      vi.mocked(mockKV.get).mockResolvedValueOnce(null);
      result = await rateLimiter.checkLimit('192.168.1.1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('security considerations', () => {
    it('should prevent brute force attacks', async () => {
      let attemptData = null;

      for (let i = 1; i <= 5; i++) {
        vi.mocked(mockKV.get).mockResolvedValueOnce(attemptData as any);
        await rateLimiter.recordAttempt('attacker-ip');

        attemptData = {
          attempts: i,
          firstAttempt: Date.now()
        };
      }

      // After 5 attempts, should be blocked
      vi.mocked(mockKV.get).mockResolvedValueOnce(attemptData as any);
      const result = await rateLimiter.checkLimit('attacker-ip');

      expect(result.allowed).toBe(false);
    });

    it('should isolate attempts by IP', async () => {
      const ips = ['1.1.1.1', '2.2.2.2', '3.3.3.3'];

      for (const ip of ips) {
        vi.mocked(mockKV.get).mockResolvedValueOnce(null);
        await rateLimiter.recordAttempt(ip);
      }

      // Each IP should have independent counter
      for (const ip of ips) {
        vi.mocked(mockKV.get).mockResolvedValueOnce({
          attempts: 1,
          firstAttempt: Date.now()
        } as any);

        const result = await rateLimiter.checkLimit(ip);
        expect(result.remaining).toBe(4);
      }
    });
  });
});
