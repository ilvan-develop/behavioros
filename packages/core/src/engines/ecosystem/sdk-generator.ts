/**
 * BehaviorOS SDK Generator — Multi-language SDK code generation engine.
 *
 * Generates client SDKs in 8 languages (TypeScript, Python, Go, Java,
 * Rust, C#, Ruby, PHP) from a unified SDKConfig schema.
 */

// ============================================================
// Types
// ============================================================

/**
 * Language — Union type: typescript, python, go, java, rust, csharp, ....
 */
export type Language = 'typescript' | 'python' | 'go' | 'java' | 'rust' | 'csharp' | 'ruby' | 'php';

/**
 * SDKConfig — Configuration and options interface.
 */
export interface SDKConfig {
  name: string;
  version: string;
  description: string;
  language: Language;
  baseUrl: string;
  packageManager?: string;
  endpoints: {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    operationId: string;
    summary?: string;
    parameters?: {
      name: string;
      type: string;
      required: boolean;
      location: 'query' | 'path' | 'header' | 'body';
    }[];
    responseType: string;
  }[];
  types: Record<string, { fields: { name: string; type: string; optional?: boolean }[] }>;
  auth?: { type: 'apiKey' | 'bearer' | 'oauth2'; headerName?: string };
}

/**
 * GeneratedFile — Configuration and options interface.
 */
export interface GeneratedFile {
  path: string;
  content: string;
  language: Language;
}

// ============================================================
// SDKGenerator
// ============================================================

/**
 * SDKGenerator — ============================================================.
 */
export class SDKGenerator {
  generate(config: SDKConfig): GeneratedFile[] {
    const files: GeneratedFile[] = [
      {
        path: this.clientFileName(config),
        content: this.generateClientClass(config),
        language: config.language,
      },
      {
        path: this.packageConfigFileName(config),
        content: this.generatePackageConfig(config),
        language: config.language,
      },
      {
        path: this.typeDefinitionsFileName(config),
        content: this.generateTypeDefinitions(config),
        language: config.language,
      },
      {
        path: 'README.md',
        content: this.generateReadme(config),
        language: config.language,
      },
    ];

    if (config.language === 'python') {
      files.push({
        path: `${config.name}/__init__.py`,
        content: this.generatePythonInit(config),
        language: 'python',
      });
    }

    return files;
  }

  getDefaultConfig(name: string, version: string, baseUrl: string, language: Language): SDKConfig {
    return {
      name,
      version,
      description: `SDK for ${name}`,
      language,
      baseUrl,
      packageManager: this.defaultPackageManager(language),
      endpoints: [],
      types: {},
    };
  }

  addEndpoint(config: SDKConfig, endpoint: SDKConfig['endpoints'][0]): void {
    config.endpoints.push(endpoint);
  }

  addType(
    config: SDKConfig,
    name: string,
    fields: { name: string; type: string; optional?: boolean }[],
  ): void {
    config.types[name] = { fields };
  }

  // ─── Client Class Generation ──────────────────────────────

  generateClientClass(config: SDKConfig): string {
    switch (config.language) {
      case 'typescript':
        return this.generateTypeScriptClient(config);
      case 'python':
        return this.generatePythonClient(config);
      case 'go':
        return this.generateGoClient(config);
      case 'java':
        return this.generateJavaClient(config);
      case 'rust':
        return this.generateRustClient(config);
      case 'csharp':
        return this.generateCSharpClient(config);
      case 'ruby':
        return this.generateRubyClient(config);
      case 'php':
        return this.generatePhpClient(config);
      default:
        return '';
    }
  }

  // ─── Package Config Generation ────────────────────────────

  generatePackageConfig(config: SDKConfig): string {
    switch (config.language) {
      case 'typescript':
        return this.generatePackageJson(config);
      case 'python':
        return this.generatePyprojectToml(config);
      case 'go':
        return this.generateGoMod(config);
      case 'java':
        return this.generatePomXml(config);
      case 'rust':
        return this.generateCargoToml(config);
      case 'csharp':
        return this.generateCsproj(config);
      case 'ruby':
        return this.generateGemspec(config);
      case 'php':
        return this.generateComposerJson(config);
      default:
        return '';
    }
  }

  // ─── Type Definitions Generation ──────────────────────────

  generateTypeDefinitions(config: SDKConfig): string {
    switch (config.language) {
      case 'typescript':
        return this.generateTypeScriptTypes(config);
      case 'python':
        return this.generatePythonTypes(config);
      case 'go':
        return this.generateGoTypes(config);
      case 'java':
        return this.generateJavaTypes(config);
      case 'rust':
        return this.generateRustTypes(config);
      case 'csharp':
        return this.generateCSharpTypes(config);
      case 'ruby':
        return this.generateRubyTypes(config);
      case 'php':
        return this.generatePhpTypes(config);
      default:
        return '';
    }
  }

  generateReadme(config: SDKConfig): string {
    const authSection = config.auth
      ? `\n## Authentication\n\nThis SDK uses ${config.auth.type} authentication.`
      : '';

    const endpointsSection = config.endpoints.length
      ? `\n## Endpoints\n\n${config.endpoints.map((e) => `- \`${e.method} ${e.path}\` — ${e.summary || e.operationId}`).join('\n')}`
      : '';

    return `# ${config.name} SDK

${config.description}

## Installation

\`\`\`${this.installCommand(config)}\`\`\`

## Quick Start

\`\`\`${config.language}
// TODO: Add quick start example
\`\`\`
${authSection}${endpointsSection}

## License

MIT
`;
  }

  // ─── Language-Specific TypeScript Client ──────────────────

  private generateTypeScriptClient(config: SDKConfig): string {
    const className = `${this.pascalCase(config.name)}Client`;
    const authHeader = config.auth?.headerName || 'Authorization';
    const methods = config.endpoints
      .map((ep) => {
        const params = ep.parameters || [];
        const queryParams = params.filter((p) => p.location === 'query');
        const pathParams = params.filter((p) => p.location === 'path');
        const bodyParam = params.find((p) => p.location === 'body');

        const args: string[] = [];
        if (pathParams.length) {
          args.push(...pathParams.map((p) => `${p.name}: ${this.tsType(p.type)}`));
        }
        if (queryParams.length) {
          args.push(
            `params: { ${queryParams.map((p) => `${p.name}${p.required ? '' : '?'}: ${this.tsType(p.type)}`).join('; ')} }`,
          );
        }
        if (bodyParam) {
          args.push(`data: ${this.tsType(bodyParam.type) || 'Record<string, unknown>'}`);
        }

        const returnType = ep.responseType
          ? `Promise<${this.tsType(ep.responseType)}>`
          : 'Promise<void>';

        let path = ep.path;
        for (const pp of pathParams) {
          path = path.replace(`{${pp.name}}`, `$\{${pp.name}}`);
        }

        const queryStr =
          queryParams.length > 0
            ? `const query = new URLSearchParams();\n${queryParams.map((p) => `    if (params.${p.name} !== undefined) query.set('${p.name}', String(params.${p.name}));`).join('\n')}\n    `
            : '';

        const queryStrExpr = queryParams.length
          ? " + (params ? `?${new URLSearchParams(params).toString()}` : '')"
          : '';
        return `  async ${ep.operationId}(${args.join(', ')}): ${returnType} {
    ${queryStr}const url = \`$\{this.baseUrl}${path}\`${queryStrExpr};
    const res = await fetch(url, {
      method: '${ep.method}',
      headers: this.headers,
      ${bodyParam ? 'body: JSON.stringify(data),' : ''}
    });
    if (!res.ok) throw new Error(\`HTTP $\{res.status}: $\{res.statusText}\`);
    return res.json();
  }`;
      })
      .join('\n\n');

    return `export class ${className} {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string = '${config.baseUrl}', token?: string) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      ${config.auth ? `'${authHeader}': token ? \`Bearer $\{token}\` : '',` : ''}
    };
  }

${methods}
}
`;
  }

  // ─── Language-Specific Python Client ──────────────────────

  private generatePythonClient(config: SDKConfig): string {
    const className = `${this.pascalCase(config.name)}Client`;
    const methods = config.endpoints
      .map((ep) => {
        const params = ep.parameters || [];
        const bodyParam = params.find((p) => p.location === 'body');
        const pathParams = params.filter((p) => p.location === 'path');
        const queryParams = params.filter((p) => p.location === 'query');

        const args: string[] = ['self'];
        args.push(...pathParams.map((p) => p.name));
        if (queryParams.length) {
          args.push(`**params`);
        }
        if (bodyParam) {
          args.push(`data=None`);
        }

        let path = ep.path;
        for (const pp of pathParams) {
          path = path.replace(`{${pp.name}}`, `{${pp.name}}`);
        }

        return `  def ${this.snakeCase(ep.operationId)}(${args.join(', ')}):
    ${queryParams.length ? 'params_dict = {k: v for k, v in params.items() if v is not None}' : ''}
    url = f'{self.base_url}${path}'
    ${queryParams.length ? 'url = url + "?" + "&".join(f"{k}={v}" for k, v in params_dict.items())' : ''}
    ${bodyParam ? 'if data is not None:\n        data = json.dumps(data)' : ''}
    resp = requests.request(
      method='${ep.method}',
      url=url,
      ${bodyParam ? 'json=data,' : ''}
      headers=self.headers
    )
    resp.raise_for_status()
    return resp.json()`;
      })
      .join('\n\n');

    return `import json
import requests


class ${className}:
  def __init__(self, base_url: str = '${config.baseUrl}', token: str | None = None):
    self.base_url = base_url
    self.headers = {'Content-Type': 'application/json'}
    ${config.auth ? "if token:\n      self.headers['Authorization'] = f'Bearer {token}'" : ''}

${methods}
`;
  }

  // ─── Language-Specific Go Client ──────────────────────────

  private generateGoClient(config: SDKConfig): string {
    const structName = `${this.pascalCase(config.name)}Client`;
    const methods = config.endpoints
      .map((ep) => {
        const funcName = this.pascalCase(ep.operationId);
        const params = ep.parameters || [];
        const bodyParam = params.find((p) => p.location === 'body');
        const pathParams = params.filter((p) => p.location === 'path');

        const args: string[] = [];
        args.push(...pathParams.map((p) => `${p.name} string`));
        if (bodyParam) {
          args.push(`data interface{}`);
        }

        let path = ep.path;
        for (const pp of pathParams) {
          path = path.replace(`{${pp.name}}`, `%s`);
        }

        const pathArgs = pathParams.map((p) => p.name).join(', ');

        return `func (c *${structName}) ${funcName}(${args.join(', ')}) ([]byte, error) {
  url := fmt.Sprintf("%s${path}", c.baseUrl${pathArgs ? `, ${pathArgs}` : ''})
  req, err := http.NewRequest("${ep.method}", url, ${bodyParam ? 'json.NewReader(data)' : 'nil'})
  if err != nil {
    return nil, err
  }
  for k, v := range c.headers {
    req.Header.Set(k, v)
  }
  resp, err := c.http.Do(req)
  if err != nil {
    return nil, err
  }
  defer resp.Body.Close()
  return io.ReadAll(resp.Body)
}`;
      })
      .join('\n\n');

    return `package ${config.name}

import (
  "bytes"
  "encoding/json"
  "fmt"
  "io"
  "net/http"
)

type ${structName} struct {
  baseUrl string
  headers map[string]string
  http    *http.Client
}

func New${structName}(baseUrl string, token string) *${structName} {
  headers := map[string]string{"Content-Type": "application/json"}
  ${config.auth ? 'headers["Authorization"] = "Bearer " + token' : ''}
  return &${structName}{
    baseUrl: baseUrl,
    headers: headers,
    http:    &http.Client{},
  }
}

${methods}
`;
  }

  // ─── Language-Specific Java Client ────────────────────────

  private generateJavaClient(config: SDKConfig): string {
    const className = `${this.pascalCase(config.name)}Client`;
    const methods = config.endpoints
      .map((ep) => {
        const funcName = this.camelCase(ep.operationId);
        const params = ep.parameters || [];
        const bodyParam = params.find((p) => p.location === 'body');
        const pathParams = params.filter((p) => p.location === 'path');

        const args: string[] = [];
        args.push(...pathParams.map((p) => `String ${p.name}`));
        if (bodyParam) {
          args.push(`Object data`);
        }

        let path = ep.path;
        for (const pp of pathParams) {
          path = path.replace(`{${pp.name}}`, `" + ${pp.name} + "`);
        }

        return `  public String ${funcName}(${args.join(', ')}) throws IOException {
    URL url = new URL(this.baseUrl + "${path}");
    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
    conn.setRequestMethod("${ep.method}");
    for (Map.Entry<String, String> entry : this.headers.entrySet()) {
      conn.setRequestProperty(entry.getKey(), entry.getValue());
    }
    ${bodyParam ? 'conn.setDoOutput(true);\n    try (OutputStream os = conn.getOutputStream()) {\n      os.write(data.toString().getBytes());\n    }' : ''}
    int status = conn.getResponseCode();
    if (status >= 400) throw new IOException("HTTP " + status);
    try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
      return br.lines().collect(Collectors.joining());
    }
  }`;
      })
      .join('\n\n');

    return `package com.${config.name}.sdk;

import java.io.*;
import java.net.*;
import java.util.*;
import java.util.stream.*;

public class ${className} {
  private String baseUrl;
  private Map<String, String> headers;

  public ${className}(String baseUrl${config.auth ? ', String token' : ''}) {
    this.baseUrl = baseUrl;
    this.headers = new HashMap<>();
    this.headers.put("Content-Type", "application/json");
    ${config.auth ? 'this.headers.put("Authorization", "Bearer " + token);' : ''}
  }

${methods}
}
`;
  }

  // ─── Language-Specific Rust Client ────────────────────────

  private generateRustClient(config: SDKConfig): string {
    const structName = `${this.pascalCase(config.name)}Client`;
    const methods = config.endpoints
      .map((ep) => {
        const funcName = this.snakeCase(ep.operationId);
        const params = ep.parameters || [];
        const bodyParam = params.find((p) => p.location === 'body');
        const pathParams = params.filter((p) => p.location === 'path');

        const args: string[] = [];
        args.push('&self');
        args.push(...pathParams.map((p) => `${p.name}: &str`));
        if (bodyParam) {
          args.push(`data: serde_json::Value`);
        }

        let path = ep.path;
        for (const pp of pathParams) {
          path = path.replace(`{${pp.name}}`, `{${pp.name}}`);
        }

        return `  pub async fn ${funcName}(${args.join(', ')}) -> Result<String, reqwest::Error> {
    let url = format!("{}{}", self.base_url, "${path}");
    let resp = self.client
      .${ep.method.toLowerCase()}(${bodyParam ? 'url' : '&url'})
      ${bodyParam ? '.json(&data)' : ''}
      .send()
      .await?;
    Ok(resp.text().await?)
  }`;
      })
      .join('\n\n');

    return `use reqwest;

pub struct ${structName} {
  base_url: String,
  client: reqwest::Client,
}

impl ${structName} {
  pub fn new(base_url: &str${config.auth ? ', token: &str' : ''}) -> Self {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Content-Type", "application/json".parse().unwrap());
    ${config.auth ? 'headers.insert("Authorization", format!("Bearer {}", token).parse().unwrap());' : ''}
    let client = reqwest::Client::builder()
      .default_headers(headers)
      .build()
      .unwrap();
    Self { base_url: base_url.to_string(), client }
  }

${methods}
}
`;
  }

  // ─── Language-Specific C# Client ──────────────────────────

  private generateCSharpClient(config: SDKConfig): string {
    const className = `${this.pascalCase(config.name)}Client`;
    const methods = config.endpoints
      .map((ep) => {
        const funcName = this.pascalCase(ep.operationId);
        const params = ep.parameters || [];
        const bodyParam = params.find((p) => p.location === 'body');
        const pathParams = params.filter((p) => p.location === 'path');

        const args: string[] = [];
        args.push(...pathParams.map((p) => `string ${this.camelCase(p.name)}`));
        if (bodyParam) {
          args.push('object data');
        }

        let path = ep.path;
        for (const pp of pathParams) {
          path = path.replace(`{${pp.name}}`, `{${this.camelCase(pp.name)}}`);
        }

        return `    public async Task<string> ${funcName}(${args.join(', ')})
    {
      var url = $"{_baseUrl}${path}";
      var request = new HttpRequestMessage(HttpMethod.${this.pascalCase(ep.method.toLowerCase()) === ep.method ? ep.method : this.pascalCase(ep.method.toLowerCase())}, url);
      foreach (var header in _headers)
      {
        request.Headers.TryAddWithoutValidation(header.Key, header.Value);
      }
      ${bodyParam ? 'request.Content = new StringContent(JsonSerializer.Serialize(data), Encoding.UTF8, "application/json");' : ''}
      var response = await _http.SendAsync(request);
      response.EnsureSuccessStatusCode();
      return await response.Content.ReadAsStringAsync();
    }`;
      })
      .join('\n\n');

    return `using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace ${this.pascalCase(config.name)}.Sdk;

public class ${className}
{
  private readonly HttpClient _http;
  private readonly string _baseUrl;
  private readonly Dictionary<string, string> _headers;

  public ${className}(string baseUrl = "${config.baseUrl}"${config.auth ? ', string token = ""' : ''})
  {
    _baseUrl = baseUrl;
    _http = new HttpClient();
    _headers = new Dictionary<string, string> { { "Content-Type", "application/json" } };
    ${config.auth ? 'if (!string.IsNullOrEmpty(token)) _headers["Authorization"] = "Bearer " + token;' : ''}
  }

${methods}
}
`;
  }

  // ─── Language-Specific Ruby Client ────────────────────────

  private generateRubyClient(config: SDKConfig): string {
    const className = `${this.pascalCase(config.name)}Client`;
    const methods = config.endpoints
      .map((ep) => {
        const funcName = this.snakeCase(ep.operationId);
        const params = ep.parameters || [];
        const bodyParam = params.find((p) => p.location === 'body');
        const pathParams = params.filter((p) => p.location === 'path');

        const args: string[] = [];
        args.push(...pathParams.map((p) => p.name));
        if (bodyParam) {
          args.push('data = {}');
        }

        let path = ep.path;
        for (const pp of pathParams) {
          path = path.replace(`{${pp.name}}`, `#{${pp.name}}`);
        }

        return `  def ${funcName}(${args.join(', ')})
    url = "#{@base_url}${path}"
    response = HTTParty.send(:${ep.method.toLowerCase()}, url,
      headers: @headers,
      ${bodyParam ? 'body: data.to_json,' : ''}
      format: :json)
    response.parsed_response
  end`;
      })
      .join('\n\n');

    return `require 'httparty'

class ${className}
  include HTTParty

  def initialize(base_url = '${config.baseUrl}'${config.auth ? ', token = nil' : ''})
    @base_url = base_url
    @headers = { 'Content-Type' => 'application/json' }
    ${config.auth ? '@headers[\'Authorization\'] = "Bearer #{token}" if token' : ''}
  end

${methods}
end
`;
  }

  // ─── Language-Specific PHP Client ─────────────────────────

  private generatePhpClient(config: SDKConfig): string {
    const className = `${this.pascalCase(config.name)}Client`;
    const methods = config.endpoints
      .map((ep) => {
        const funcName = this.camelCase(ep.operationId);
        const params = ep.parameters || [];
        const bodyParam = params.find((p) => p.location === 'body');
        const pathParams = params.filter((p) => p.location === 'path');

        const args: string[] = [];
        args.push(...pathParams.map((p) => `string $${p.name}`));
        if (bodyParam) {
          args.push('array $data = []');
        }

        let path = ep.path;
        for (const pp of pathParams) {
          path = path.replace(`{${pp.name}}`, `{$${pp.name}}`);
        }

        return `  public function ${funcName}(${args.join(', ')}): string
  {
    $url = $this->baseUrl . "${path}";
    $options = [
      'headers' => $this->headers,
      ${bodyParam ? "'json' => $data," : ''}
    ];
    $response = $this->client->${String(ep.method.toLowerCase()) === 'delete' ? 'delete' : ep.method.toLowerCase()}($url, $options);
    return $response->getBody()->getContents();
  }`;
      })
      .join('\n\n');

    return `<?php

namespace ${this.pascalCase(config.name)}\\Sdk;

use GuzzleHttp\\Client;

class ${className}
{
  private string $baseUrl;
  private array $headers;
  private Client $client;

  public function __construct(string $baseUrl = '${config.baseUrl}'${config.auth ? ", string $token = ''" : ''})
  {
    $this->baseUrl = $baseUrl;
    $this->headers = ['Content-Type' => 'application/json'];
    ${config.auth ? "if ($token) $this->headers['Authorization'] = 'Bearer ' . $token;" : ''}
    $this->client = new Client();
  }

${methods}
}
`;
  }

  // ─── Package Config Helpers ───────────────────────────────

  private generatePackageJson(config: SDKConfig): string {
    return JSON.stringify(
      {
        name: config.name,
        version: config.version,
        description: config.description,
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        scripts: {
          build: 'tsc',
          test: 'vitest run',
        },
        dependencies: {
          'node-fetch': '^2.6.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          vitest: '^1.0.0',
        },
      },
      null,
      2,
    );
  }

  private generatePyprojectToml(config: SDKConfig): string {
    return `[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.backends._legacy:_Backend"

[project]
name = "${config.name}"
version = "${config.version}"
description = "${config.description}"
requires-python = ">=3.10"
dependencies = [
  "requests>=2.28.0",
]
`;
  }

  private generateGoMod(config: SDKConfig): string {
    return `module github.com/${config.name}/sdk

go 1.22
`;
  }

  private generatePomXml(config: SDKConfig): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.${config.name}</groupId>
  <artifactId>${config.name}-sdk</artifactId>
  <version>${config.version}</version>
  <packaging>jar</packaging>
  <dependencies/>
</project>
`;
  }

  private generateCargoToml(config: SDKConfig): string {
    return `[package]
name = "${config.name}-sdk"
version = "${config.version}"
description = "${config.description}"
edition = "2021"

[dependencies]
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
`;
  }

  private generateCsproj(config: SDKConfig): string {
    return `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <PackageId>${this.pascalCase(config.name)}.Sdk</PackageId>
    <Version>${config.version}</Version>
    <Description>${config.description}</Description>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

</Project>
`;
  }

  private generateGemspec(config: SDKConfig): string {
    return `Gem::Specification.new do |s|
  s.name        = "${config.name}_sdk"
  s.version     = "${config.version}"
  s.summary     = "${config.description}"
  s.authors     = ["BehaviorOS"]
  s.files       = ["lib/${config.name}_client.rb"]
  s.add_runtime_dependency "httparty", "~> 0.21"
end
`;
  }

  private generateComposerJson(config: SDKConfig): string {
    return JSON.stringify(
      {
        name: `${config.name}/sdk`,
        description: config.description,
        type: 'library',
        require: {
          php: '>=8.1',
          'guzzlehttp/guzzle': '^7.0',
        },
        autoload: {
          'psr-4': {
            [`${this.pascalCase(config.name)}\\\\Sdk\\\\`]: 'src/',
          },
        },
      },
      null,
      2,
    );
  }

  // ─── Type Definitions Helpers ─────────────────────────────

  private generateTypeScriptTypes(config: SDKConfig): string {
    const types = Object.entries(config.types)
      .map(([name, t]) => {
        const fields = t.fields
          .map((f) => `  ${f.name}${f.optional ? '?' : ''}: ${this.tsType(f.type)};`)
          .join('\n');
        return `export interface ${name} {\n${fields}\n}`;
      })
      .join('\n\n');
    return types || '// No types defined';
  }

  private generatePythonTypes(config: SDKConfig): string {
    const types = Object.entries(config.types)
      .map(([name, t]) => {
        const fields = t.fields
          .map((f) => `  ${f.name}: ${this.pythonType(f.type)}${f.optional ? ' | None' : ''}`)
          .join('\n');
        return `class ${name}(TypedDict):\n${fields}`;
      })
      .join('\n\n');
    return types ? `from typing import TypedDict\n\n${types}` : '# No types defined';
  }

  private generateGoTypes(config: SDKConfig): string {
    const types = Object.entries(config.types)
      .map(([name, t]) => {
        const fields = t.fields
          .map((f) => `  ${this.pascalCase(f.name)} ${this.goType(f.type)} \`json:"${f.name}"\``)
          .join('\n');
        return `type ${name} struct {\n${fields}\n}`;
      })
      .join('\n\n');
    return types
      ? `package ${config.name}\n\n${types}`
      : `package ${config.name}\n\n// No types defined`;
  }

  private generateJavaTypes(config: SDKConfig): string {
    const types = Object.entries(config.types)
      .map(([name, t]) => {
        const fields = t.fields
          .map((f) => {
            const getter = `get${this.pascalCase(f.name)}`;
            const setter = `set${this.pascalCase(f.name)}`;
            return `  private ${this.javaType(f.type)} ${f.name};\n\n  public ${this.javaType(f.type)} ${getter}() { return ${f.name}; }\n\n  public void ${setter}(${this.javaType(f.type)} ${f.name}) { this.${f.name} = ${f.name}; }`;
          })
          .join('\n\n');
        return `public class ${name} {\n${fields}\n}`;
      })
      .join('\n\n');
    return types || '// No types defined';
  }

  private generateRustTypes(config: SDKConfig): string {
    const derive = '#[derive(Debug, Clone, Serialize, Deserialize)]';
    const types = Object.entries(config.types)
      .map(([name, t]) => {
        const fields = t.fields.map((f) => `  pub ${f.name}: ${this.rustType(f.type)},`).join('\n');
        return `${derive}\npub struct ${name} {\n${fields}\n}`;
      })
      .join('\n\n');
    return types || '// No types defined';
  }

  private generateCSharpTypes(config: SDKConfig): string {
    const types = Object.entries(config.types)
      .map(([name, t]) => {
        const fields = t.fields
          .map(
            (f) => `  public ${this.csharpType(f.type)} ${this.pascalCase(f.name)} { get; set; }`,
          )
          .join('\n');
        return `public class ${name}\n{\n${fields}\n}`;
      })
      .join('\n\n');
    return types || '// No types defined';
  }

  private generateRubyTypes(config: SDKConfig): string {
    const types = Object.entries(config.types)
      .map(([name, t]) => {
        const fields = t.fields.map((f) => `  attr_accessor :${f.name}`).join('\n');
        return `class ${name}\n${fields}\nend`;
      })
      .join('\n\n');
    return types || '# No types defined';
  }

  private generatePhpTypes(config: SDKConfig): string {
    const types = Object.entries(config.types)
      .map(([name, t]) => {
        const fields = t.fields
          .map((f) => `  public ${this.phpType(f.type)} $${f.name};`)
          .join('\n');
        return `class ${name} {\n${fields}\n}`;
      })
      .join('\n\n');
    return types ? `<?php\n\n${types}\n` : '<?php\n\n// No types defined\n';
  }

  // ─── Python Init Helper ───────────────────────────────────

  private generatePythonInit(config: SDKConfig): string {
    return `from .${config.name}_client import ${this.pascalCase(config.name)}Client

__all__ = ["${this.pascalCase(config.name)}Client"]
`;
  }

  // ─── File Name Helpers ────────────────────────────────────

  private clientFileName(config: SDKConfig): string {
    switch (config.language) {
      case 'typescript':
        return 'src/client.ts';
      case 'python':
        return `${config.name}/client.py`;
      case 'go':
        return 'client.go';
      case 'java':
        return `src/main/java/com/${config.name}/sdk/${this.pascalCase(config.name)}Client.java`;
      case 'rust':
        return 'src/client.rs';
      case 'csharp':
        return `${this.pascalCase(config.name)}Client.cs`;
      case 'ruby':
        return `lib/${config.name}_client.rb`;
      case 'php':
        return `src/${this.pascalCase(config.name)}Client.php`;
      default:
        return 'client';
    }
  }

  private packageConfigFileName(config: SDKConfig): string {
    switch (config.language) {
      case 'typescript':
        return 'package.json';
      case 'python':
        return 'pyproject.toml';
      case 'go':
        return 'go.mod';
      case 'java':
        return 'pom.xml';
      case 'rust':
        return 'Cargo.toml';
      case 'csharp':
        return `${this.pascalCase(config.name)}.Sdk.csproj`;
      case 'ruby':
        return `${config.name}_sdk.gemspec`;
      case 'php':
        return 'composer.json';
      default:
        return 'package.config';
    }
  }

  private typeDefinitionsFileName(config: SDKConfig): string {
    switch (config.language) {
      case 'typescript':
        return 'src/types.ts';
      case 'python':
        return `${config.name}/types.py`;
      case 'go':
        return 'types.go';
      case 'java':
        return `src/main/java/com/${config.name}/sdk/Types.java`;
      case 'rust':
        return 'src/types.rs';
      case 'csharp':
        return 'Types.cs';
      case 'ruby':
        return `lib/${config.name}/types.rb`;
      case 'php':
        return 'src/Types.php';
      default:
        return 'types';
    }
  }

  private defaultPackageManager(language: Language): string {
    switch (language) {
      case 'typescript':
        return 'npm';
      case 'python':
        return 'pip';
      case 'go':
        return 'go';
      case 'java':
        return 'maven';
      case 'rust':
        return 'cargo';
      case 'csharp':
        return 'nuget';
      case 'ruby':
        return 'gem';
      case 'php':
        return 'composer';
      default:
        return '';
    }
  }

  private installCommand(config: SDKConfig): string {
    switch (config.language) {
      case 'typescript':
        return `bash\nnpm install ${config.name}`;
      case 'python':
        return `bash\npip install ${config.name}`;
      case 'go':
        return `bash\ngo get github.com/${config.name}/sdk`;
      case 'java':
        return 'xml\n<!-- Add to pom.xml -->';
      case 'rust':
        return 'toml\n# Add to Cargo.toml dependencies';
      case 'csharp':
        return `bash\ndotnet add package ${this.pascalCase(config.name)}.Sdk`;
      case 'ruby':
        return `bash\ngem install ${config.name}_sdk`;
      case 'php':
        return `bash\ncomposer require ${config.name}/sdk`;
      default:
        return '';
    }
  }

  // ─── Type Mappers ─────────────────────────────────────────

  private tsType(t: string): string {
    const map: Record<string, string> = {
      string: 'string',
      number: 'number',
      boolean: 'boolean',
      integer: 'number',
      float: 'number',
      any: 'any',
      object: 'Record<string, unknown>',
      array: 'unknown[]',
      void: 'void',
    };
    return map[t] || t;
  }

  private pythonType(t: string): string {
    const map: Record<string, string> = {
      string: 'str',
      number: 'float',
      boolean: 'bool',
      integer: 'int',
      float: 'float',
      any: 'Any',
      object: 'dict',
      array: 'list',
      void: 'None',
    };
    return map[t] || t;
  }

  private goType(t: string): string {
    const map: Record<string, string> = {
      string: 'string',
      number: 'float64',
      boolean: 'bool',
      integer: 'int',
      float: 'float64',
      any: 'interface{}',
      object: 'map[string]interface{}',
      array: '[]interface{}',
      void: '',
    };
    return map[t] || t;
  }

  private javaType(t: string): string {
    const map: Record<string, string> = {
      string: 'String',
      number: 'double',
      boolean: 'boolean',
      integer: 'int',
      float: 'float',
      any: 'Object',
      object: 'Map<String, Object>',
      array: 'List<Object>',
      void: 'void',
    };
    return map[t] || t;
  }

  private rustType(t: string): string {
    const map: Record<string, string> = {
      string: 'String',
      number: 'f64',
      boolean: 'bool',
      integer: 'i64',
      float: 'f64',
      any: 'serde_json::Value',
      object: 'serde_json::Value',
      array: 'Vec<serde_json::Value>',
      void: '',
    };
    return map[t] || t;
  }

  private csharpType(t: string): string {
    const map: Record<string, string> = {
      string: 'string',
      number: 'double',
      boolean: 'bool',
      integer: 'int',
      float: 'float',
      any: 'object',
      object: 'Dictionary<string, object>',
      array: 'List<object>',
      void: 'void',
    };
    return map[t] || t;
  }

  private phpType(t: string): string {
    const map: Record<string, string> = {
      string: 'string',
      number: 'float',
      boolean: 'bool',
      integer: 'int',
      float: 'float',
      any: 'mixed',
      object: 'array',
      array: 'array',
      void: 'void',
    };
    return map[t] || t;
  }

  // ─── String Utilities ─────────────────────────────────────

  private pascalCase(s: string): string {
    return s
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, (c) => c.toUpperCase());
  }

  private camelCase(s: string): string {
    return s
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, (c) => c.toLowerCase());
  }

  private snakeCase(s: string): string {
    return s
      .replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`)
      .replace(/^_/, '')
      .toLowerCase();
  }
}
