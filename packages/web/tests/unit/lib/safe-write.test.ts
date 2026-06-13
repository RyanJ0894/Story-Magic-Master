import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// vi.mock factories are hoisted above imports, so the class has to live
// inside the factory closure. We export it from the mocked module and
// re-import below.
vi.mock('@story-magic/shared', () => {
  class FakePrismaKnownRequestError extends Error {
    code: string;
    meta?: unknown;
    constructor(code: string, message = 'fake', meta?: unknown) {
      super(message);
      this.code = code;
      this.meta = meta;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError: FakePrismaKnownRequestError } };
});

import { safeUpdate, safeCreate, isBenignRaceError } from '@/lib/db/safe-write';
import { log } from '@/lib/logger';
import { Prisma } from '@story-magic/shared';

// Pull the mocked class so tests can construct it explicitly without
// duplicating the class definition.
const FakePrismaKnownRequestError = Prisma.PrismaClientKnownRequestError as unknown as new (
  code: string,
  message?: string,
  meta?: unknown,
) => Error & { code: string; meta?: unknown };

const mockWarn = log.warn as ReturnType<typeof vi.fn>;

describe('safeUpdate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the updated row on success', async () => {
    const row = { id: '1', status: 'done' };
    const model = { update: vi.fn().mockResolvedValue(row) };
    const result = await safeUpdate(model, { where: { id: '1' }, data: { status: 'done' } });
    expect(result).toBe(row);
  });

  it('returns null on P2025 (row deleted between read and write) and warns', async () => {
    const model = { update: vi.fn().mockRejectedValue(new FakePrismaKnownRequestError('P2025')) };
    const result = await safeUpdate(model, { where: { id: '1' }, data: {} });
    expect(result).toBeNull();
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0][1]).toMatchObject({ code: 'P2025' });
  });

  it('returns null on P2003 (parent FK deleted) and warns', async () => {
    const model = { update: vi.fn().mockRejectedValue(new FakePrismaKnownRequestError('P2003')) };
    const result = await safeUpdate(model, { where: { id: '1' }, data: {} });
    expect(result).toBeNull();
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });

  it('propagates other Prisma errors unchanged', async () => {
    const err = new FakePrismaKnownRequestError('P2002', 'Unique constraint failed');
    const model = { update: vi.fn().mockRejectedValue(err) };
    await expect(safeUpdate(model, { where: { id: '1' }, data: {} })).rejects.toThrow(err);
  });

  it('propagates non-Prisma errors unchanged', async () => {
    const err = new Error('database connection lost');
    const model = { update: vi.fn().mockRejectedValue(err) };
    await expect(safeUpdate(model, { where: { id: '1' }, data: {} })).rejects.toThrow(err);
  });
});

describe('safeCreate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the created row on success', async () => {
    const row = { id: '1' };
    const model = { create: vi.fn().mockResolvedValue(row) };
    const result = await safeCreate(model, { data: { foo: 'bar' } });
    expect(result).toBe(row);
  });

  it('returns null on P2003 (parent FK missing) and warns', async () => {
    const model = { create: vi.fn().mockRejectedValue(new FakePrismaKnownRequestError('P2003')) };
    const result = await safeCreate(model, { data: { foo: 'bar' } }, { jobId: 'xyz' });
    expect(result).toBeNull();
    expect(mockWarn.mock.calls[0][1]).toMatchObject({ code: 'P2003', jobId: 'xyz' });
  });
});

describe('isBenignRaceError', () => {
  it('matches P2025 + P2003 prisma errors', () => {
    expect(isBenignRaceError(new FakePrismaKnownRequestError('P2025'))).toBe(true);
    expect(isBenignRaceError(new FakePrismaKnownRequestError('P2003'))).toBe(true);
  });

  it('rejects other codes', () => {
    expect(isBenignRaceError(new FakePrismaKnownRequestError('P2002'))).toBe(false);
  });

  it('rejects non-prisma errors', () => {
    expect(isBenignRaceError(new Error('any'))).toBe(false);
    expect(isBenignRaceError(null)).toBe(false);
    expect(isBenignRaceError({ code: 'P2025' })).toBe(false);
  });
});
