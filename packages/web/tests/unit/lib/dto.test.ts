import { describe, it, expect } from 'vitest';
import {
  CreateShareRequestSchema,
  UpdateShareRequestSchema,
  VerifySharePasswordRequestSchema,
  AccessLevelSchema,
  GetLibraryQuerySchema,
  UpdateLibraryEntryRequestSchema,
  UpdatePositionRequestSchema,
} from '@/lib/api/dto';

describe('Share DTOs', () => {
  describe('AccessLevelSchema', () => {
    it('accepts stream', () => {
      expect(AccessLevelSchema.parse('stream')).toBe('stream');
    });

    it('accepts download', () => {
      expect(AccessLevelSchema.parse('download')).toBe('download');
    });

    it('rejects invalid values', () => {
      expect(() => AccessLevelSchema.parse('invalid')).toThrow();
    });
  });

  describe('CreateShareRequestSchema', () => {
    it('validates a minimal request', () => {
      const result = CreateShareRequestSchema.parse({
        project_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.project_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.access_level).toBe('stream'); // default
    });

    it('validates a full request', () => {
      const result = CreateShareRequestSchema.parse({
        project_id: '550e8400-e29b-41d4-a716-446655440000',
        access_level: 'download',
        expires_at: '2026-02-01T00:00:00Z',
        recipient_email: 'test@example.com',
        recipient_name: 'Test User',
        max_plays: 5,
        password: 'secret123',
      });
      expect(result.access_level).toBe('download');
      expect(result.max_plays).toBe(5);
    });

    it('rejects invalid project_id', () => {
      expect(() => CreateShareRequestSchema.parse({
        project_id: 'not-a-uuid',
      })).toThrow();
    });

    it('rejects invalid access_level', () => {
      expect(() => CreateShareRequestSchema.parse({
        project_id: '550e8400-e29b-41d4-a716-446655440000',
        access_level: 'invalid',
      })).toThrow();
    });

    it('rejects invalid email', () => {
      expect(() => CreateShareRequestSchema.parse({
        project_id: '550e8400-e29b-41d4-a716-446655440000',
        recipient_email: 'not-an-email',
      })).toThrow();
    });

    it('rejects negative max_plays', () => {
      expect(() => CreateShareRequestSchema.parse({
        project_id: '550e8400-e29b-41d4-a716-446655440000',
        max_plays: -1,
      })).toThrow();
    });

    it('rejects password shorter than 4 chars', () => {
      expect(() => CreateShareRequestSchema.parse({
        project_id: '550e8400-e29b-41d4-a716-446655440000',
        password: '123',
      })).toThrow();
    });

    it('rejects password longer than 50 chars', () => {
      expect(() => CreateShareRequestSchema.parse({
        project_id: '550e8400-e29b-41d4-a716-446655440000',
        password: 'a'.repeat(51),
      })).toThrow();
    });
  });

  describe('UpdateShareRequestSchema', () => {
    it('accepts empty object (no required fields)', () => {
      const result = UpdateShareRequestSchema.parse({});
      expect(result).toBeDefined();
    });

    it('accepts partial updates', () => {
      const result = UpdateShareRequestSchema.parse({
        is_active: false,
        max_plays: 10,
      });
      expect(result.is_active).toBe(false);
      expect(result.max_plays).toBe(10);
    });

    it('accepts nullable fields', () => {
      const result = UpdateShareRequestSchema.parse({
        expires_at: null,
        max_plays: null,
        password: null,
      });
      expect(result.expires_at).toBeNull();
    });
  });

  describe('VerifySharePasswordRequestSchema', () => {
    it('accepts valid password', () => {
      const result = VerifySharePasswordRequestSchema.parse({ password: 'test123' });
      expect(result.password).toBe('test123');
    });

    it('rejects empty password', () => {
      expect(() => VerifySharePasswordRequestSchema.parse({ password: '' })).toThrow();
    });

    it('rejects missing password', () => {
      expect(() => VerifySharePasswordRequestSchema.parse({})).toThrow();
    });
  });
});

describe('Library DTOs', () => {
  describe('GetLibraryQuerySchema', () => {
    it('accepts empty query with defaults', () => {
      const result = GetLibraryQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortOrder).toBe('desc');
    });

    it('validates source filter', () => {
      const result = GetLibraryQuerySchema.parse({ source: 'received' });
      expect(result.source).toBe('received');
    });

    it('rejects invalid source', () => {
      expect(() => GetLibraryQuerySchema.parse({ source: 'invalid' })).toThrow();
    });
  });

  describe('UpdateLibraryEntryRequestSchema', () => {
    it('validates tags array', () => {
      const result = UpdateLibraryEntryRequestSchema.parse({
        tags: ['fantasy', 'drama'],
      });
      expect(result.tags).toEqual(['fantasy', 'drama']);
    });

    it('rejects too many tags', () => {
      expect(() => UpdateLibraryEntryRequestSchema.parse({
        tags: Array(11).fill('tag'),
      })).toThrow();
    });

    it('validates notes length', () => {
      expect(() => UpdateLibraryEntryRequestSchema.parse({
        notes: 'a'.repeat(2001),
      })).toThrow();
    });
  });

  describe('UpdatePositionRequestSchema', () => {
    it('validates position update', () => {
      const result = UpdatePositionRequestSchema.parse({
        position: 120.5,
        duration: 3600,
        completed: false,
      });
      expect(result.position).toBe(120.5);
    });

    it('rejects negative position', () => {
      expect(() => UpdatePositionRequestSchema.parse({ position: -1 })).toThrow();
    });
  });
});
