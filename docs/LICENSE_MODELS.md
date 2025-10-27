# License Models - Subscription vs Credit Pack

Social Archiver supports **three license models** to accommodate different user needs:

## 1. Free Tier (`FREE_TIER`)

**Type:** Monthly subscription with reset
**Credits:** 10 credits/month
**Reset:** Monthly automatic reset
**Rollover:** None
**Expiration:** N/A (always active)

### Characteristics
- Credits reset on the 1st of each month
- No credit rollover to next month
- Basic features only

### Use Case
- Users trying out the plugin
- Light usage scenarios
- Testing before upgrading

---

## 2. Subscription (`SUBSCRIPTION`)

**Type:** Monthly/yearly subscription with auto-renewal
**Credits:** 500 credits/month
**Reset:** Monthly automatic reset
**Rollover:** Up to 100 credits
**Expiration:** Based on subscription status

### Characteristics
- Credits reset monthly (on activation anniversary or 1st of month)
- Unused credits rollover (max 100) to next period
- Full features including AI, deep research, permanent sharing
- Grace period: 3 days after expiration

### Use Case
- Power users with regular archiving needs
- Users wanting AI features and deep research
- Businesses needing permanent public sharing

### Gumroad Setup
```json
{
  "custom_fields": {
    "license_type": "subscription"
  },
  "subscription": true,
  "subscription_duration": "monthly"
}
```

---

## 3. Credit Pack (`CREDIT_PACK`)

**Type:** One-time purchase, credits valid until depleted or expired
**Credits:** Variable (e.g., 100, 500, 1000)
**Reset:** None (credits deplete)
**Rollover:** N/A
**Expiration:** 1 year from purchase date

### Characteristics
- Credits purchased once, used until depleted
- No monthly reset - credits persist
- Expiration date (default: 1 year from purchase)
- Grace period: 3 days after expiration or depletion
- Cannot rollover (since there's no reset)

### Use Case
- Users with sporadic archiving needs
- One-time projects (e.g., archiving an event)
- Users who don't want recurring payments
- Gift purchases

### Gumroad Setup

**Option 1: Using Custom Fields**
```json
{
  "custom_fields": {
    "license_type": "credit_pack",
    "initial_credits": "100"
  }
}
```

**Option 2: Using Product Variants**
```json
{
  "variants": "100 Credits"
}
```

The system will automatically detect credit packs if:
- `custom_fields.license_type === "credit_pack"`
- OR `variants` contains a number followed by "credits" (e.g., "100 Credits", "500 credits")

---

## Comparison Table

| Feature | Free Tier | Subscription | Credit Pack |
|---------|-----------|--------------|-------------|
| **Credits** | 10/month | 500/month | Variable (100-1000+) |
| **Monthly Reset** | ✅ Yes | ✅ Yes | ❌ No |
| **Credit Rollover** | ❌ No | ✅ Yes (max 100) | N/A |
| **Expiration** | Never | Subscription end | 1 year |
| **AI Features** | ❌ | ✅ | ✅ |
| **Deep Research** | ❌ | ✅ | ✅ |
| **Public Sharing** | 30 days | Permanent | Permanent |
| **Grace Period** | N/A | 3 days | 3 days |
| **Price** | Free | $19.99/month | $9.99-$99.99 |

---

## Implementation Details

### Type Detection

The system detects license type in this priority:

1. **Custom Field**: `purchase.custom_fields['license_type']`
2. **Variants**: Parse `purchase.variants` for credit amounts
3. **Subscription**: Check `purchase.subscription_id`
4. **Default**: Fall back to `FREE_TIER`

### Credit Depletion vs Expiration

**Subscription/Free Tier:**
- Credits reset monthly
- Expiration based on subscription status
- Grace period triggers on subscription expiration

**Credit Pack:**
- Credits deplete with usage
- No reset - once depleted, license expires
- Expiration also triggered by time (1 year)
- Grace period triggers on **either**:
  - Credit depletion (0 credits remaining)
  - OR time expiration (1 year elapsed)

### Grace Period Behavior

All license types support a **3-day grace period**:

**During Grace Period:**
- Basic archiving: Limited to 5 per day
- AI features: Disabled (configurable)
- Deep research: Disabled
- Public sharing: Disabled (configurable)

**Subscription:**
- Grace period after subscription cancellation/expiration
- Users can renew subscription to restore full access

**Credit Pack:**
- Grace period after credit depletion OR expiration
- Users must purchase new credit pack

---

## Code Examples

### Checking License Type

```typescript
import { LicenseType } from '../types/license';

// In CreditManager
const licenseType = creditManager.getLicenseType();

if (licenseType === LicenseType.CREDIT_PACK) {
  // No monthly reset
  console.log('Credit pack license - credits valid until depleted');
} else if (licenseType === LicenseType.SUBSCRIPTION) {
  // Monthly reset with rollover
  console.log('Subscription license - credits reset monthly');
}
```

### UI Display

```svelte
{#if isCreditPack}
  <div>Credits valid until: {expirationDate}</div>
  <div>Initial credits: {initialCredits}</div>
{:else if isSubscription}
  <div>Next reset: {resetDate}</div>
  <div>Rollover credits: {rolloverCredits}</div>
{/if}
```

### Creating Credit Pack on Gumroad

1. Create product with variant options:
   - "100 Credits" - $9.99
   - "500 Credits" - $39.99
   - "1000 Credits" - $69.99

2. Add custom field `license_type` = `credit_pack`

3. (Optional) Add custom field `initial_credits` = variant amount

The system will automatically:
- Parse the credit amount from variant name
- Set expiration to 1 year from purchase
- Disable monthly reset
- Track credit depletion

---

## Migration Path

Users can switch between models:

### Free → Subscription
- Apply monthly credits (500)
- Enable rollover
- Activate AI features

### Free → Credit Pack
- Apply purchased credits
- Set 1-year expiration
- No monthly reset

### Credit Pack → Subscription
- Remaining credits become rollover (max 100)
- Start monthly reset cycle
- Set subscription expiration

### Subscription → Credit Pack
- Stop monthly reset
- Current balance becomes total credits
- Set 1-year expiration from conversion

---

## Future Enhancements

Potential additions for credit pack model:

1. **Multi-tier Packs**
   - Small (100 credits) - $9.99
   - Medium (500 credits) - $39.99
   - Large (1000 credits) - $69.99

2. **Bonus Packs**
   - Purchase 500, get 50 bonus (10% bonus)
   - Purchase 1000, get 200 bonus (20% bonus)

3. **Credit Gifting**
   - Purchase credit packs as gifts
   - Gift codes with expiration

4. **Credit Pooling** (Teams)
   - Shared credit pack for team
   - Team admin manages credits

5. **Auto-Refill**
   - Auto-purchase new pack when depleted
   - Configurable threshold (e.g., buy when < 10 credits)

---

## Testing

See `/src/__tests__/services/CreditManager-CreditPack.test.ts` for comprehensive test coverage of both models.

**Key Test Scenarios:**
- Credit pack doesn't trigger monthly reset
- Subscription triggers monthly reset with rollover
- Free tier resets without rollover
- Grace period works for both models
- UI displays correct info per license type
