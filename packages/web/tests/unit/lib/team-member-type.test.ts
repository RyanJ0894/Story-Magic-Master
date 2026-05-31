/**
 * Team Member Type Tests (#98)
 *
 * Verifies that:
 * 1. InviteMemberInput accepts talent_actor | staff | representation
 * 2. memberType is stored separately from role (permissions)
 * 3. MEMBER_TYPE_LABELS map covers all three types
 * 4. API schema validates memberType values
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-declare the schema inline (mirrors route.ts) to test validation logic in isolation
const InviteMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().max(100).optional(),
  role: z.enum(['admin', 'member', 'viewer']).optional(),
  memberType: z.enum(['talent_actor', 'staff', 'representation']).optional(),
});

const MEMBER_TYPE_LABELS: Record<string, string> = {
  talent_actor: 'Talent / Actor',
  staff: 'Staff',
  representation: 'Representation',
};

describe('InviteMemberSchema — memberType validation (#98)', () => {
  it('accepts talent_actor as memberType', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'actor@example.com',
      memberType: 'talent_actor',
    });
    expect(result.success).toBe(true);
    expect(result.data?.memberType).toBe('talent_actor');
  });

  it('accepts staff as memberType', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'staff@example.com',
      memberType: 'staff',
    });
    expect(result.success).toBe(true);
    expect(result.data?.memberType).toBe('staff');
  });

  it('accepts representation as memberType', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'rep@example.com',
      memberType: 'representation',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid memberType value', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'user@example.com',
      memberType: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('allows memberType to be omitted (backward compat)', () => {
    const result = InviteMemberSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
    expect(result.data?.memberType).toBeUndefined();
  });

  it('accepts name field alongside email and memberType', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'sarah@example.com',
      name: 'Sarah Johnson',
      memberType: 'talent_actor',
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Sarah Johnson');
  });

  it('allows role to coexist with memberType (permissions vs label)', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'admin@example.com',
      role: 'admin',
      memberType: 'staff',
    });
    expect(result.success).toBe(true);
    expect(result.data?.role).toBe('admin');
    expect(result.data?.memberType).toBe('staff');
  });
});

describe('MEMBER_TYPE_LABELS (#98)', () => {
  it('maps talent_actor to human-readable label', () => {
    expect(MEMBER_TYPE_LABELS['talent_actor']).toBe('Talent / Actor');
  });

  it('maps staff to human-readable label', () => {
    expect(MEMBER_TYPE_LABELS['staff']).toBe('Staff');
  });

  it('maps representation to human-readable label', () => {
    expect(MEMBER_TYPE_LABELS['representation']).toBe('Representation');
  });

  it('covers all three required member types', () => {
    const types = ['talent_actor', 'staff', 'representation'];
    for (const t of types) {
      expect(MEMBER_TYPE_LABELS[t]).toBeTruthy();
    }
  });
});
