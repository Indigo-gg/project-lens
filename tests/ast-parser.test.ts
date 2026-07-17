import { describe, it, expect, beforeAll } from 'vitest';
import { initParser, parseFile, isSupportedFile, isParserReady } from '../src/extractor/ast-parser.js';

describe('ast-parser', () => {
  beforeAll(async () => {
    await initParser();
  });

  describe('initParser', () => {
    it('should initialize parser successfully', () => {
      expect(isParserReady()).toBe(true);
    });
  });

  describe('isSupportedFile', () => {
    it('should support TypeScript files', () => {
      expect(isSupportedFile('src/index.ts')).toBe(true);
      expect(isSupportedFile('src/component.tsx')).toBe(true);
    });

    it('should support JavaScript files', () => {
      expect(isSupportedFile('src/app.js')).toBe(true);
      expect(isSupportedFile('src/utils.jsx')).toBe(true);
    });

    it('should support Python files', () => {
      expect(isSupportedFile('src/main.py')).toBe(true);
    });

    it('should support Go files', () => {
      expect(isSupportedFile('src/server.go')).toBe(true);
    });

    it('should not support unsupported files', () => {
      expect(isSupportedFile('README.md')).toBe(false);
      expect(isSupportedFile('style.css')).toBe(false);
    });
  });

  describe('parseFile', () => {
    it('should parse TypeScript function declarations', async () => {
      const code = `
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}

const add = (a: number, b: number) => a + b;
      `;

      const result = await parseFile('test.ts', code);

      expect(result.language).toBe('typescript');
      expect(result.nodes.length).toBeGreaterThan(0);

      // Should find the function declarations
      const funcNames = result.nodes.map(n => n.name);
      expect(funcNames).toContain('hello');
    });

    it('should parse TypeScript class declarations', async () => {
      const code = `
class Calculator {
  private value: number;

  constructor(initial: number) {
    this.value = initial;
  }

  add(n: number): Calculator {
    this.value += n;
    return this;
  }
}
      `;

      const result = await parseFile('test.ts', code);

      expect(result.language).toBe('typescript');
      expect(result.nodes.length).toBeGreaterThan(0);

      // Should find the class
      const classNames = result.nodes.filter(n => n.type === 'class_declaration').map(n => n.name);
      expect(classNames).toContain('Calculator');
    });

    it('should parse import statements', async () => {
      const code = `
import { Router } from 'express';
import fs from 'fs';
import { calculate } from './utils';
      `;

      const result = await parseFile('test.ts', code);

      expect(result.language).toBe('typescript');
      expect(result.nodes.length).toBeGreaterThan(0);

      // Should find import statements
      const importNodes = result.nodes.filter(n => n.type === 'import_statement');
      expect(importNodes.length).toBe(3);
    });

    it('should handle empty file', async () => {
      const result = await parseFile('test.ts', '');

      expect(result.language).toBe('typescript');
      expect(result.nodes.length).toBe(0);
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
      expect(result.error).toContain('Unsupported');
    });
  });
});
