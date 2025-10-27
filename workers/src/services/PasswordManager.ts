/**
 * Password strength level
 */
export type PasswordStrength = 'weak' | 'medium' | 'strong';

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  strength?: PasswordStrength;
  errors: string[];
}

/**
 * Password Manager
 *
 * Handles password hashing, verification, and validation
 * using bcrypt-compatible algorithms
 */
export class PasswordManager {
  private readonly minLength: number = 8;
  private readonly saltRounds: number = 10;

  /**
   * Hash a password using bcrypt-compatible algorithm
   *
   * Note: Cloudflare Workers don't support native bcrypt,
   * so we use Web Crypto API with PBKDF2
   */
  async hashPassword(plaintext: string): Promise<string> {
    // Validate password
    const validation = this.validatePassword(plaintext);
    if (!validation.valid) {
      throw new Error(`Invalid password: ${validation.errors.join(', ')}`);
    }

    // Generate salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive key using PBKDF2
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(plaintext);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000, // Recommended for PBKDF2
        hash: 'SHA-256'
      },
      keyMaterial,
      256 // 32 bytes
    );

    // Combine salt and hash
    const hashArray = new Uint8Array(derivedBits);
    const combined = new Uint8Array(salt.length + hashArray.length);
    combined.set(salt);
    combined.set(hashArray, salt.length);

    // Encode to base64
    return this.bufferToBase64(combined);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(plaintext: string, hash: string): Promise<boolean> {
    try {
      // Decode hash
      const combined = this.base64ToBuffer(hash);

      // Extract salt (first 16 bytes) and stored hash (rest)
      const salt = combined.slice(0, 16);
      const storedHash = combined.slice(16);

      // Hash the plaintext with the same salt
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(plaintext);

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );

      const computedHash = new Uint8Array(derivedBits);

      // Compare hashes (timing-safe comparison)
      return this.timingSafeEqual(storedHash, computedHash);
    } catch (error) {
      console.error('[PasswordManager] Verification failed:', error);
      return false;
    }
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // Check minimum length
    if (password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters`);
    }

    // Check for common patterns
    if (/^[0-9]+$/.test(password)) {
      errors.push('Password cannot be all numbers');
    }

    if (/^[a-zA-Z]+$/.test(password)) {
      errors.push('Password should contain numbers or special characters');
    }

    // Calculate strength
    let strength: PasswordStrength = 'weak';

    if (errors.length === 0) {
      const hasLower = /[a-z]/.test(password);
      const hasUpper = /[A-Z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[^a-zA-Z0-9]/.test(password);

      const criteriaCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

      if (password.length >= 12 && criteriaCount >= 3) {
        strength = 'strong';
      } else if (password.length >= 8 && criteriaCount >= 2) {
        strength = 'medium';
      }
    }

    return {
      valid: errors.length === 0,
      strength: errors.length === 0 ? strength : undefined,
      errors
    };
  }

  /**
   * Generate a random password
   */
  generatePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const randomValues = crypto.getRandomValues(new Uint8Array(length));

    let password = '';
    for (let i = 0; i < length; i++) {
      const charIndex = randomValues[i];
      if (charIndex !== undefined) {
        password += charset[charIndex % charset.length];
      }
    }

    return password;
  }

  /**
   * Timing-safe equality comparison
   */
  private timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      if (aVal !== undefined && bVal !== undefined) {
        result |= aVal ^ bVal;
      }
    }

    return result === 0;
  }

  /**
   * Convert buffer to base64
   */
  private bufferToBase64(buffer: Uint8Array): string {
    const bytes = Array.from(buffer);
    const binary = bytes.map(b => String.fromCharCode(b)).join('');
    return btoa(binary);
  }

  /**
   * Convert base64 to buffer
   */
  private base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      const charCode = binary.charCodeAt(i);
      if (charCode !== undefined) {
        bytes[i] = charCode;
      }
    }

    return bytes;
  }
}

/**
 * Rate limiter for password attempts
 */
export class PasswordRateLimiter {
  private readonly maxAttempts: number = 5;
  private readonly windowMs: number = 60 * 60 * 1000; // 1 hour

  constructor(private readonly kv: KVNamespace) {}

  /**
   * Check if IP has exceeded rate limit
   */
  async checkLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
    const key = `pwd-limit:${ip}`;
    const data = await this.kv.get(key, 'json') as { attempts: number; firstAttempt: number } | null;

    const now = Date.now();

    if (!data) {
      return { allowed: true, remaining: this.maxAttempts };
    }

    // Check if window has expired
    if (now - data.firstAttempt > this.windowMs) {
      // Reset
      await this.kv.delete(key);
      return { allowed: true, remaining: this.maxAttempts };
    }

    const remaining = this.maxAttempts - data.attempts;

    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining)
    };
  }

  /**
   * Record a failed attempt
   */
  async recordAttempt(ip: string): Promise<void> {
    const key = `pwd-limit:${ip}`;
    const data = await this.kv.get(key, 'json') as { attempts: number; firstAttempt: number } | null;

    const now = Date.now();

    if (!data || now - data.firstAttempt > this.windowMs) {
      // Start new window
      await this.kv.put(
        key,
        JSON.stringify({ attempts: 1, firstAttempt: now }),
        { expirationTtl: Math.floor(this.windowMs / 1000) }
      );
    } else {
      // Increment attempts
      await this.kv.put(
        key,
        JSON.stringify({ attempts: data.attempts + 1, firstAttempt: data.firstAttempt }),
        { expirationTtl: Math.floor(this.windowMs / 1000) }
      );
    }
  }

  /**
   * Reset rate limit for IP
   */
  async resetLimit(ip: string): Promise<void> {
    const key = `pwd-limit:${ip}`;
    await this.kv.delete(key);
  }
}
