import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '@/types/bindings';
import { ValidateLicenseRequestSchema, type LicenseResponse } from '@/types/api';
import { ValidationError, AuthenticationError, InsufficientCreditsError } from '@/utils/errors';
import { Logger } from '@/utils/logger';

export const licenseRouter = new Hono<Env>();

// POST /api/license/validate - Validate license key
licenseRouter.post('/validate', async (c) => {
  try {
    const body = await c.req.json();
    const request = ValidateLicenseRequestSchema.parse(body);
    
    // Get license from KV
    const license = await c.env.LICENSE_KEYS.get(
      `license:${request.licenseKey}`,
      'json'
    ) as any;
    
    if (!license) {
      // Check if it's a new license from Gumroad
      const gumroadValidation = await validateWithGumroad(
        request.licenseKey,
        c.env.GUMROAD_API_KEY
      );
      
      if (!gumroadValidation.valid) {
        return c.json({
          success: false,
          error: {
            code: 'INVALID_LICENSE',
            message: 'Invalid license key'
          }
        }, 401);
      }
      
      // Store new license
      const newLicense = {
        key: request.licenseKey,
        plan: 'pro',
        creditsRemaining: 500,
        creditLimit: 500,
        resetDate: getNextResetDate(),
        createdAt: Date.now(),
        email: gumroadValidation.email
      };
      
      await c.env.LICENSE_KEYS.put(
        `license:${request.licenseKey}`,
        JSON.stringify(newLicense)
      );
      
      const response: LicenseResponse = {
        valid: true,
        plan: 'pro',
        creditsRemaining: 500,
        creditLimit: 500,
        resetDate: newLicense.resetDate,
        features: ['ai_analysis', 'deep_research', 'unlimited_sharing', 'priority_support']
      };
      
      return c.json({
        success: true,
        data: response
      });
    }
    
    // Check if credits need reset
    if (new Date(license.resetDate) < new Date()) {
      license.creditsRemaining = license.creditLimit;
      license.resetDate = getNextResetDate();
      
      await c.env.LICENSE_KEYS.put(
        `license:${request.licenseKey}`,
        JSON.stringify(license)
      );
    }
    
    const response: LicenseResponse = {
      valid: true,
      plan: license.plan,
      creditsRemaining: license.creditsRemaining,
      creditLimit: license.creditLimit,
      resetDate: license.resetDate,
      features: license.plan === 'pro' 
        ? ['ai_analysis', 'deep_research', 'unlimited_sharing', 'priority_support']
        : ['basic_archive']
    };
    
    return c.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors
        }
      }, 400);
    }
    throw error;
  }
});

// POST /api/license/use-credits - Deduct credits
licenseRouter.post('/use-credits', async (c) => {
  const licenseKey = c.req.header('X-License-Key');
  const credits = parseInt(c.req.query('credits') || '1');
  
  if (!licenseKey) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'License key required'
      }
    }, 401);
  }
  
  const license = await c.env.LICENSE_KEYS.get(
    `license:${licenseKey}`,
    'json'
  ) as any;
  
  if (!license) {
    return c.json({
      success: false,
      error: {
        code: 'INVALID_LICENSE',
        message: 'Invalid license key'
      }
    }, 401);
  }
  
  if (license.creditsRemaining < credits) {
    return c.json({
      success: false,
      error: {
        code: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient credits'
      }
    }, 402);
  }
  
  license.creditsRemaining -= credits;
  await c.env.LICENSE_KEYS.put(
    `license:${licenseKey}`,
    JSON.stringify(license)
  );
  
  return c.json({
    success: true,
    data: {
      creditsUsed: credits,
      creditsRemaining: license.creditsRemaining
    }
  });
});

// Helper functions
async function validateWithGumroad(
  licenseKey: string,
  apiKey?: string
): Promise<{ valid: boolean; email?: string }> {
  if (!apiKey) {
    return { valid: false };
  }
  
  try {
    // TODO: Implement actual Gumroad API call
    // For now, return mock validation
    if (licenseKey.startsWith('GUMROAD-')) {
      return {
        valid: true,
        email: 'user@example.com'
      };
    }
    return { valid: false };
  } catch (error) {
    console.error('Gumroad validation error:', error);
    return { valid: false };
  }
}

function getNextResetDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}