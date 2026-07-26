import { beforeEach, describe, expect, it } from 'vitest';
import type { Language, SDKConfig } from '../engines/ecosystem/sdk-generator';
import { SDKGenerator } from '../engines/ecosystem/sdk-generator';

// ============================================================
// Helpers
// ============================================================

const ALL_LANGUAGES: Language[] = [
  'typescript',
  'python',
  'go',
  'java',
  'rust',
  'csharp',
  'ruby',
  'php',
];

function makeMinimalConfig(language: Language): SDKConfig {
  return {
    name: 'petstore',
    version: '1.0.0',
    description: 'Pet Store API SDK',
    language,
    baseUrl: 'https://api.petstore.example.com',
    packageManager: undefined,
    endpoints: [
      {
        path: '/pets',
        method: 'GET',
        operationId: 'listPets',
        summary: 'List all pets',
        parameters: [{ name: 'limit', type: 'integer', required: false, location: 'query' }],
        responseType: 'Pet[]',
      },
      {
        path: '/pets/{petId}',
        method: 'GET',
        operationId: 'getPetById',
        summary: 'Get a pet by ID',
        parameters: [{ name: 'petId', type: 'string', required: true, location: 'path' }],
        responseType: 'Pet',
      },
      {
        path: '/pets',
        method: 'POST',
        operationId: 'createPet',
        summary: 'Create a new pet',
        parameters: [{ name: 'body', type: 'CreatePetRequest', required: true, location: 'body' }],
        responseType: 'Pet',
      },
    ],
    types: {
      Pet: {
        fields: [
          { name: 'id', type: 'string', optional: false },
          { name: 'name', type: 'string', optional: false },
          { name: 'age', type: 'integer', optional: true },
        ],
      },
      CreatePetRequest: {
        fields: [
          { name: 'name', type: 'string', optional: false },
          { name: 'age', type: 'integer', optional: true },
        ],
      },
    },
    auth: { type: 'bearer', headerName: 'Authorization' },
  };
}

function makeMinimalEndpoint() {
  return {
    path: '/health',
    method: 'GET' as const,
    operationId: 'healthCheck',
    summary: 'Health check endpoint',
    responseType: 'HealthStatus',
  };
}

// ============================================================
// SDKGenerator Tests
// ============================================================

describe('SDKGenerator', () => {
  let gen: SDKGenerator;

  beforeEach(() => {
    gen = new SDKGenerator();
  });

  // ─── generate() ──────────────────────────────────────────

  describe('generate()', () => {
    it.each(ALL_LANGUAGES)('should create files for %s language', (language) => {
      const config = makeMinimalConfig(language);
      const files = gen.generate(config);

      expect(files.length).toBeGreaterThanOrEqual(4);
      expect(files.every((f) => f.language === language)).toBe(true);

      const paths = files.map((f) => f.path);
      expect(paths).toContain('README.md');

      const configPatterns = [
        'package.json',
        'pyproject.toml',
        'go.mod',
        'pom.xml',
        'Cargo.toml',
        '.gemspec',
        '.csproj',
        'composer.json',
      ];
      const hasConfigFile = configPatterns.some((c) => paths.some((p) => p.endsWith(c)));
      expect(hasConfigFile).toBe(true);
    });

    it('should generate 4 files for TypeScript', () => {
      const config = makeMinimalConfig('typescript');
      const files = gen.generate(config);

      expect(files).toHaveLength(4);
      expect(files.find((f) => f.path === 'src/client.ts')).toBeDefined();
      expect(files.find((f) => f.path === 'package.json')).toBeDefined();
      expect(files.find((f) => f.path === 'src/types.ts')).toBeDefined();
      expect(files.find((f) => f.path === 'README.md')).toBeDefined();
    });

    it('should generate 5 files for Python (includes __init__.py)', () => {
      const config = makeMinimalConfig('python');
      const files = gen.generate(config);

      expect(files).toHaveLength(5);
      expect(files.find((f) => f.path === 'petstore/__init__.py')).toBeDefined();
      expect(files.find((f) => f.path === 'petstore/client.py')).toBeDefined();
      expect(files.find((f) => f.path === 'pyproject.toml')).toBeDefined();
    });
  });

  // ─── generateClientClass() ───────────────────────────────

  describe('generateClientClass()', () => {
    it.each(ALL_LANGUAGES)('should return a non-empty string for %s', (language) => {
      const config = makeMinimalConfig(language);
      const code = gen.generateClientClass(config);

      expect(code).toBeTruthy();
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(50);
    });

    it('should generate TypeScript client with correct class name', () => {
      const config = makeMinimalConfig('typescript');
      const code = gen.generateClientClass(config);

      expect(code).toContain('class PetstoreClient');
      expect(code).toContain('private baseUrl');
      expect(code).toContain('private headers');
    });

    it('should include endpoint methods in TypeScript client', () => {
      const config = makeMinimalConfig('typescript');
      const code = gen.generateClientClass(config);

      expect(code).toContain('listPets');
      expect(code).toContain('getPetById');
      expect(code).toContain('createPet');
      expect(code).toContain('async listPets');
      expect(code).toContain('async getPetById');
      expect(code).toContain('async createPet');
    });

    it('should include auth header when configured', () => {
      const config = makeMinimalConfig('typescript');
      const code = gen.generateClientClass(config);

      expect(code).toContain("'Authorization'");
    });

    it('should not include auth when not configured', () => {
      const config = makeMinimalConfig('typescript');
      config.auth = undefined;
      const code = gen.generateClientClass(config);

      expect(code).not.toContain("'Authorization'");
    });

    it('should generate Python client with correct class and imports', () => {
      const config = makeMinimalConfig('python');
      const code = gen.generateClientClass(config);

      expect(code).toContain('class PetstoreClient');
      expect(code).toContain('import requests');
      expect(code).toContain('import json');
      expect(code).toContain('def list_pets');
      expect(code).toContain('def get_pet_by_id');
      expect(code).toContain('def create_pet');
    });

    it('should generate Go client with correct struct and constructor', () => {
      const config = makeMinimalConfig('go');
      const code = gen.generateClientClass(config);

      expect(code).toContain('type PetstoreClient struct');
      expect(code).toContain('func NewPetstoreClient');
      expect(code).toContain('package petstore');
    });

    it('should generate Java client with correct class', () => {
      const config = makeMinimalConfig('java');
      const code = gen.generateClientClass(config);

      expect(code).toContain('class PetstoreClient');
      expect(code).toContain('package com.petstore.sdk;');
    });

    it('should generate Rust client with correct struct and impl', () => {
      const config = makeMinimalConfig('rust');
      const code = gen.generateClientClass(config);

      expect(code).toContain('struct PetstoreClient');
      expect(code).toContain('impl PetstoreClient');
      expect(code).toContain('use reqwest');
    });

    it('should generate C# client with correct class and namespace', () => {
      const config = makeMinimalConfig('csharp');
      const code = gen.generateClientClass(config);

      expect(code).toContain('class PetstoreClient');
      expect(code).toContain('namespace Petstore.Sdk');
    });

    it('should generate Ruby client with correct class', () => {
      const config = makeMinimalConfig('ruby');
      const code = gen.generateClientClass(config);

      expect(code).toContain('class PetstoreClient');
      expect(code).toContain("require 'httparty'");
      expect(code).toContain('include HTTParty');
    });

    it('should generate PHP client with correct class and namespace', () => {
      const config = makeMinimalConfig('php');
      const code = gen.generateClientClass(config);

      expect(code).toContain('class PetstoreClient');
      expect(code).toContain('namespace Petstore\\Sdk;');
      expect(code).toContain('use GuzzleHttp\\Client');
    });
  });

  // ─── generatePackageConfig() ─────────────────────────────

  describe('generatePackageConfig()', () => {
    it('should generate valid package.json for TypeScript', () => {
      const config = makeMinimalConfig('typescript');
      const pkg = gen.generatePackageConfig(config);

      expect(() => JSON.parse(pkg)).not.toThrow();
      const parsed = JSON.parse(pkg);
      expect(parsed.name).toBe('petstore');
      expect(parsed.version).toBe('1.0.0');
    });

    it('should generate pyproject.toml for Python', () => {
      const config = makeMinimalConfig('python');
      const result = gen.generatePackageConfig(config);

      expect(result).toContain('[project]');
      expect(result).toContain('name = "petstore"');
      expect(result).toContain('version = "1.0.0"');
      expect(result).toContain('requires-python = ">=3.10"');
    });

    it('should generate go.mod for Go', () => {
      const config = makeMinimalConfig('go');
      const result = gen.generatePackageConfig(config);

      expect(result).toContain('module github.com/petstore/sdk');
      expect(result).toContain('go 1.22');
    });

    it('should generate pom.xml for Java', () => {
      const config = makeMinimalConfig('java');
      const result = gen.generatePackageConfig(config);

      expect(result).toContain('<groupId>com.petstore</groupId>');
      expect(result).toContain('<artifactId>petstore-sdk</artifactId>');
    });

    it('should generate Cargo.toml for Rust', () => {
      const config = makeMinimalConfig('rust');
      const result = gen.generatePackageConfig(config);

      expect(result).toContain('[package]');
      expect(result).toContain('name = "petstore-sdk"');
      expect(result).toContain('reqwest');
    });

    it('should generate .csproj for C#', () => {
      const config = makeMinimalConfig('csharp');
      const result = gen.generatePackageConfig(config);

      expect(result).toContain('<PackageId>Petstore.Sdk</PackageId>');
      expect(result).toContain('<TargetFramework>net8.0</TargetFramework>');
    });

    it('should generate .gemspec for Ruby', () => {
      const config = makeMinimalConfig('ruby');
      const result = gen.generatePackageConfig(config);

      expect(result).toContain('s.name        = "petstore_sdk"');
      expect(result).toContain('s.version     = "1.0.0"');
      expect(result).toContain('httparty');
    });

    it('should generate composer.json for PHP', () => {
      const config = makeMinimalConfig('php');
      const result = gen.generatePackageConfig(config);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe('petstore/sdk');
      expect(parsed.require.php).toBe('>=8.1');
    });
  });

  // ─── generateTypeDefinitions() ───────────────────────────

  describe('generateTypeDefinitions()', () => {
    it('should generate TypeScript interfaces', () => {
      const config = makeMinimalConfig('typescript');
      const types = gen.generateTypeDefinitions(config);

      expect(types).toContain('export interface Pet');
      expect(types).toContain('export interface CreatePetRequest');
      expect(types).toContain('id: string');
      expect(types).toContain('age?: number');
    });

    it('should generate Python TypedDict classes', () => {
      const config = makeMinimalConfig('python');
      const types = gen.generateTypeDefinitions(config);

      expect(types).toContain('from typing import TypedDict');
      expect(types).toContain('class Pet(TypedDict)');
      expect(types).toContain('name: str');
      expect(types).toContain('age: int | None');
    });

    it('should generate Go structs', () => {
      const config = makeMinimalConfig('go');
      const types = gen.generateTypeDefinitions(config);

      expect(types).toContain('type Pet struct');
      expect(types).toContain('package petstore');
      expect(types).toContain('json:"name"');
    });

    it('should generate Rust structs with derives', () => {
      const config = makeMinimalConfig('rust');
      const types = gen.generateTypeDefinitions(config);

      expect(types).toContain('#[derive(Debug, Clone, Serialize, Deserialize)]');
      expect(types).toContain('pub struct Pet');
      expect(types).toContain('pub name: String');
    });

    it('should generate Java classes with getters/setters', () => {
      const config = makeMinimalConfig('java');
      const types = gen.generateTypeDefinitions(config);

      expect(types).toContain('public class Pet');
      expect(types).toContain('getName()');
      expect(types).toContain('setName');
    });

    it('should generate C# classes with properties', () => {
      const config = makeMinimalConfig('csharp');
      const types = gen.generateTypeDefinitions(config);

      expect(types).toContain('public class Pet');
      expect(types).toContain('public string Name { get; set; }');
    });

    it('should generate Ruby classes with attr_accessor', () => {
      const config = makeMinimalConfig('ruby');
      const types = gen.generateTypeDefinitions(config);

      expect(types).toContain('class Pet');
      expect(types).toContain('attr_accessor :name');
    });

    it('should generate PHP classes with typed properties', () => {
      const config = makeMinimalConfig('php');
      const types = gen.generateTypeDefinitions(config);

      expect(types).toContain('class Pet');
      expect(types).toContain('public string $name;');
    });
  });

  // ─── generateReadme() ────────────────────────────────────

  describe('generateReadme()', () => {
    it('should include project name and description', () => {
      const config = makeMinimalConfig('typescript');
      const readme = gen.generateReadme(config);

      expect(readme).toContain('# petstore SDK');
      expect(readme).toContain('Pet Store API SDK');
    });

    it('should include auth section when configured', () => {
      const config = makeMinimalConfig('typescript');
      const readme = gen.generateReadme(config);

      expect(readme).toContain('Authentication');
      expect(readme).toContain('bearer');
    });

    it('should omit auth section when not configured', () => {
      const config = makeMinimalConfig('typescript');
      config.auth = undefined;
      const readme = gen.generateReadme(config);

      expect(readme).not.toContain('Authentication');
    });

    it('should include endpoints section', () => {
      const config = makeMinimalConfig('typescript');
      const readme = gen.generateReadme(config);

      expect(readme).toContain('Endpoints');
      expect(readme).toContain('GET /pets');
      expect(readme).toContain('POST /pets');
    });

    it('should include installation section', () => {
      const config = makeMinimalConfig('typescript');
      const readme = gen.generateReadme(config);

      expect(readme).toContain('Installation');
      expect(readme).toContain('npm install');
    });

    it('should include license section', () => {
      const config = makeMinimalConfig('typescript');
      const readme = gen.generateReadme(config);

      expect(readme).toContain('License');
      expect(readme).toContain('MIT');
    });
  });

  // ─── getDefaultConfig() ──────────────────────────────────

  describe('getDefaultConfig()', () => {
    it('should return a config with expected fields', () => {
      const config = gen.getDefaultConfig(
        'mylib',
        '2.0.0',
        'https://api.example.com',
        'typescript',
      );

      expect(config.name).toBe('mylib');
      expect(config.version).toBe('2.0.0');
      expect(config.baseUrl).toBe('https://api.example.com');
      expect(config.language).toBe('typescript');
      expect(config.description).toBe('SDK for mylib');
    });

    it('should have empty endpoints and types', () => {
      const config = gen.getDefaultConfig('x', '0.1.0', 'http://localhost', 'python');

      expect(config.endpoints).toEqual([]);
      expect(config.types).toEqual({});
    });

    it('should set default package manager per language', () => {
      const ts = gen.getDefaultConfig('a', '1', 'u', 'typescript');
      expect(ts.packageManager).toBe('npm');

      const py = gen.getDefaultConfig('a', '1', 'u', 'python');
      expect(py.packageManager).toBe('pip');

      const go = gen.getDefaultConfig('a', '1', 'u', 'go');
      expect(go.packageManager).toBe('go');

      const rust = gen.getDefaultConfig('a', '1', 'u', 'rust');
      expect(rust.packageManager).toBe('cargo');
    });
  });

  // ─── addEndpoint() / addType() ───────────────────────────

  describe('addEndpoint() / addType()', () => {
    it('should add an endpoint to config', () => {
      const config = gen.getDefaultConfig('svc', '1.0.0', 'https://api.dev', 'typescript');
      expect(config.endpoints).toHaveLength(0);

      gen.addEndpoint(config, makeMinimalEndpoint());
      expect(config.endpoints).toHaveLength(1);
      expect(config.endpoints[0].operationId).toBe('healthCheck');
    });

    it('should add multiple endpoints', () => {
      const config = gen.getDefaultConfig('svc', '1.0.0', 'https://api.dev', 'typescript');

      gen.addEndpoint(config, makeMinimalEndpoint());
      gen.addEndpoint(config, {
        path: '/version',
        method: 'GET',
        operationId: 'getVersion',
        summary: 'Get API version',
        responseType: 'string',
      });

      expect(config.endpoints).toHaveLength(2);
    });

    it('should add a type to config', () => {
      const config = gen.getDefaultConfig('svc', '1.0.0', 'https://api.dev', 'typescript');

      gen.addType(config, 'User', [
        { name: 'id', type: 'string' },
        { name: 'email', type: 'string' },
      ]);

      expect(config.types.User).toBeDefined();
      expect(config.types.User.fields).toHaveLength(2);
    });

    it('should generate client class with newly added endpoint', () => {
      const config = gen.getDefaultConfig('svc', '1.0.0', 'https://api.dev', 'typescript');

      gen.addEndpoint(config, makeMinimalEndpoint());
      gen.addType(config, 'HealthStatus', [{ name: 'ok', type: 'boolean' }]);

      const code = gen.generateClientClass(config);
      expect(code).toContain('healthCheck');
    });
  });
});
