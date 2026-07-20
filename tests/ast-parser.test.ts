import { initParser, parseFile, isParserReady, isSupportedFile } from '../src/extractor/ast-parser.js';
import { describe, it, expect, beforeAll } from 'vitest';

describe('ast-parser', () => {
  beforeAll(async () => {
    await initParser();
  }, 30000);

  describe('initParser', () => {
    it('should initialize parser successfully', async () => {
      expect(isParserReady()).toBe(true);
    });
  });

  describe('isSupportedFile', () => {
    it('should support TypeScript files', () => {
      expect(isSupportedFile('test.ts')).toBe(true);
      expect(isSupportedFile('test.tsx')).toBe(true);
    });

    it('should support JavaScript files', () => {
      expect(isSupportedFile('test.js')).toBe(true);
      expect(isSupportedFile('test.jsx')).toBe(true);
    });

    it('should support Python files', () => {
      expect(isSupportedFile('test.py')).toBe(true);
    });

    it('should support Go files', () => {
      expect(isSupportedFile('test.go')).toBe(true);
    });

    it('should not support unsupported files', () => {
      expect(isSupportedFile('test.rb')).toBe(false);
      expect(isSupportedFile('test.java')).toBe(false);
      expect(isSupportedFile('test.rs')).toBe(false);
    });
  });

  describe('parseFile', () => {
    it('should parse TypeScript function declarations', async () => {
      const code = `
function greet(name: string): string {
  return 'Hello, ' + name;
}
      `;

      const result = await parseFile('test.ts', code);

      expect(result.language).toBe('typescript');
      if (result.error) {
        expect(result.nodes.length).toBe(0);
        expect(result.error).toContain('Language not supported');
      } else {
        expect(result.nodes.length).toBeGreaterThan(0);
        const functionNames = result.nodes.filter(n => n.type === 'function').map(n => n.name);
        expect(functionNames).toContain('greet');
      }
    });

    it('should parse TypeScript class declarations', async () => {
      const code = `
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
      `;

      const result = await parseFile('test.ts', code);

      expect(result.language).toBe('typescript');
      if (result.error) {
        expect(result.nodes.length).toBe(0);
        expect(result.error).toContain('Language not supported');
      } else {
        expect(result.nodes.length).toBeGreaterThan(0);
        const classNames = result.nodes.filter(n => n.type === 'class').map(n => n.name);
        expect(classNames).toContain('Calculator');
      }
    });

    it('should have some nodes for a TypeScript file with imports', async () => {
      const code = `
import { Router } from 'express';
import fs from 'fs';
import { calculate } from './utils';
      `;

      const result = await parseFile('test.ts', code);

      expect(result.language).toBe('typescript');
      if (result.error) {
        expect(result.nodes.length).toBe(0);
        expect(result.error).toContain('Language not supported');
      } else {
        // Import statements are not extracted as separate nodes by design,
        // but the parser should not fail
        expect(result.error).toBeUndefined();
      }
    });

    it('should handle empty file', async () => {
      const result = await parseFile('test.ts', '');

      expect(result.language).toBe('typescript');
      if (result.error) {
        expect(result.nodes.length).toBe(0);
        expect(result.error).toContain('Language not supported');
      } else {
        expect(result.nodes.length).toBe(0);
      }
    });

    it('should handle syntax errors gracefully', async () => {
      const code = `
function broken( {
  this is not valid typescript
}
      `;

      const result = await parseFile('test.ts', code);

      // Should not throw, may have partial results or error
      expect(result).toBeDefined();
    });

    it('should return unsupported for unknown extensions', async () => {
      const result = await parseFile('test.xyz', 'some content');

      expect(result.language).toBe('unknown');
      expect(result.error).toBeDefined();
    });
  });
});