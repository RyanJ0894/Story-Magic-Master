import { describe, it, expect } from 'vitest';
import {
  LIMITS,
  validateScriptText,
  validatePdfFile,
  validatePageCount,
  validateProjectName,
  validateJsonPayload,
  validateGenerationRequest,
} from '@/lib/validation/request-limits';

describe('Request Limits', () => {
  describe('LIMITS constants', () => {
    it('should have all required limits defined', () => {
      expect(LIMITS.SCRIPT_TEXT_MAX_BYTES).toBe(1024 * 1024); // 1MB
      expect(LIMITS.SCRIPT_TEXT_MAX_CHARS).toBe(500_000);
      expect(LIMITS.PDF_MAX_BYTES).toBe(10 * 1024 * 1024); // 10MB
      expect(LIMITS.JSON_PAYLOAD_MAX_BYTES).toBe(5 * 1024 * 1024); // 5MB
      expect(LIMITS.AUDIO_MAX_BYTES).toBe(100 * 1024 * 1024); // 100MB
      expect(LIMITS.PROJECT_NAME_MAX_CHARS).toBe(200);
      expect(LIMITS.PROJECT_DESCRIPTION_MAX_CHARS).toBe(2000);
      expect(LIMITS.MIN_PAGE_COUNT).toBe(1);
      expect(LIMITS.MAX_PAGE_COUNT).toBe(200);
    });
  });

  describe('validateScriptText', () => {
    it('should reject null or undefined text', () => {
      expect(validateScriptText(null).valid).toBe(false);
      expect(validateScriptText(undefined).valid).toBe(false);
      expect(validateScriptText(null).error).toBe('Script text is required');
    });

    it('should accept valid script text', () => {
      const validText = 'INT. COFFEE SHOP - DAY\n\nA busy morning scene...';
      const result = validateScriptText(validText);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject text exceeding max characters', () => {
      const longText = 'A'.repeat(LIMITS.SCRIPT_TEXT_MAX_CHARS + 1);
      const result = validateScriptText(longText);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
      expect(result.details?.charCount).toBe(longText.length);
    });

    it('should reject suspicious script patterns', () => {
      const injectionPatterns = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img onerror="alert(1)">',
        'data:text/html,<script>alert(1)</script>',
      ];

      for (const pattern of injectionPatterns) {
        const result = validateScriptText(`Normal text ${pattern} more text`);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('potentially unsafe content');
      }
    });

    it('should accept clean script text', () => {
      const cleanScript = `
        INT. DETECTIVE'S OFFICE - NIGHT

        DETECTIVE MILLER (40s, weathered) sits at his desk.

        MILLER
        (sighing)
        Another cold case... just what I needed.
      `;
      const result = validateScriptText(cleanScript);
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePageCount', () => {
    it('should reject non-integer page counts', () => {
      expect(validatePageCount(1.5).valid).toBe(false);
      expect(validatePageCount(1.5).error).toBe('Page count must be an integer');
    });

    it('should reject page count below minimum', () => {
      expect(validatePageCount(0).valid).toBe(false);
      expect(validatePageCount(0).error).toContain('at least');
    });

    it('should reject page count above maximum', () => {
      expect(validatePageCount(LIMITS.MAX_PAGE_COUNT + 1).valid).toBe(false);
      expect(validatePageCount(LIMITS.MAX_PAGE_COUNT + 1).error).toContain('exceeds maximum');
    });

    it('should accept valid page counts', () => {
      expect(validatePageCount(1).valid).toBe(true);
      expect(validatePageCount(50).valid).toBe(true);
      expect(validatePageCount(LIMITS.MAX_PAGE_COUNT).valid).toBe(true);
    });
  });

  describe('validateProjectName', () => {
    it('should reject null or empty names', () => {
      expect(validateProjectName(null).valid).toBe(false);
      expect(validateProjectName(undefined).valid).toBe(false);
      expect(validateProjectName('').valid).toBe(false);
      expect(validateProjectName('   ').valid).toBe(false);
    });

    it('should reject names exceeding max length', () => {
      const longName = 'A'.repeat(LIMITS.PROJECT_NAME_MAX_CHARS + 1);
      const result = validateProjectName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should accept valid project names', () => {
      expect(validateProjectName('My Script').valid).toBe(true);
      expect(validateProjectName('The Great Adventure - Episode 1').valid).toBe(true);
    });
  });

  describe('validateJsonPayload', () => {
    it('should accept valid JSON payloads', () => {
      const payload = { key: 'value', nested: { array: [1, 2, 3] } };
      const result = validateJsonPayload(payload);
      expect(result.valid).toBe(true);
    });

    it('should reject oversized payloads', () => {
      // Create a large payload (over 5MB when stringified)
      const largeArray = new Array(1000000).fill({ data: 'some repeated content here' });
      const result = validateJsonPayload(largeArray);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum size');
    });
  });

  describe('validateGenerationRequest', () => {
    it('should validate complete request', () => {
      const result = validateGenerationRequest({
        scriptText: 'INT. OFFICE - DAY\n\nJOHN enters.',
        pageCount: 10,
        projectName: 'My Project',
      });
      expect(result.valid).toBe(true);
    });

    it('should fail if scriptText is invalid', () => {
      const result = validateGenerationRequest({
        scriptText: '',
        pageCount: 10,
      });
      expect(result.valid).toBe(false);
    });

    it('should fail if pageCount is invalid', () => {
      const result = validateGenerationRequest({
        scriptText: 'Valid script content here.',
        pageCount: 999, // Over max
      });
      expect(result.valid).toBe(false);
    });

    it('should skip optional validations if not provided', () => {
      const result = validateGenerationRequest({
        scriptText: 'Valid script content here.',
      });
      expect(result.valid).toBe(true);
    });
  });
});
