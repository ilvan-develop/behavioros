/**
 * HelmValues — Configuration and options interface.
 */
export interface HelmValues {
  replicaCount: number;
  image: { repository: string; tag: string; pullPolicy: string };
  service: { type: string; port: number };
  resources: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
  };
  config: Record<string, unknown>;
  persistence: { enabled: boolean; size: string };
  ingress: { enabled: boolean; host?: string };
}

interface Dependency {
  name: string;
  chart: string;
  version: string;
  alias?: string;
}

/**
 * HelmChart — Provides constructor, setValues, getValues, generate, ... operations.
 */
export class HelmChart {
  private name: string;
  private namespace: string;
  private values: HelmValues;
  private dependencies: Dependency[] = [];

  constructor(name: string, namespace?: string) {
    this.name = name;
    this.namespace = namespace ?? 'default';
    this.values = {
      replicaCount: 1,
      image: { repository: 'nginx', tag: 'latest', pullPolicy: 'IfNotPresent' },
      service: { type: 'ClusterIP', port: 80 },
      resources: {
        requests: { cpu: '100m', memory: '128Mi' },
        limits: { cpu: '500m', memory: '512Mi' },
      },
      config: {},
      persistence: { enabled: false, size: '1Gi' },
      ingress: { enabled: false },
    };
  }

  setValues(values: Partial<HelmValues>): void {
    this.values = { ...this.values, ...values };
  }

  getValues(): HelmValues {
    return { ...this.values };
  }

  generate(): string {
    const lines: string[] = [];
    lines.push(`apiVersion: v2`);
    lines.push(`name: ${this.name}`);
    lines.push(`namespace: ${this.namespace}`);
    lines.push('type: application');
    lines.push('version: 0.1.0');
    lines.push('appVersion: "1.0.0"');
    lines.push('');

    if (this.dependencies.length > 0) {
      lines.push('dependencies:');
      for (const dep of this.dependencies) {
        lines.push(`  - name: ${dep.name}`);
        lines.push(`    chart: ${dep.chart}`);
        lines.push(`    version: ${dep.version}`);
        if (dep.alias) {
          lines.push(`    alias: ${dep.alias}`);
        }
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('# Default values');
    lines.push(`replicaCount: ${this.values.replicaCount}`);
    lines.push('');
    lines.push('image:');
    lines.push(`  repository: ${this.values.image.repository}`);
    lines.push(`  tag: ${this.values.image.tag}`);
    lines.push(`  pullPolicy: ${this.values.image.pullPolicy}`);
    lines.push('');
    lines.push('service:');
    lines.push(`  type: ${this.values.service.type}`);
    lines.push(`  port: ${this.values.service.port}`);
    lines.push('');
    lines.push('resources:');
    lines.push('  requests:');
    lines.push(`    cpu: ${this.values.resources.requests.cpu}`);
    lines.push(`    memory: ${this.values.resources.requests.memory}`);
    lines.push('  limits:');
    lines.push(`    cpu: ${this.values.resources.limits.cpu}`);
    lines.push(`    memory: ${this.values.resources.limits.memory}`);
    lines.push('');
    lines.push('persistence:');
    lines.push(`  enabled: ${this.values.persistence.enabled}`);
    lines.push(`  size: ${this.values.persistence.size}`);
    lines.push('');
    lines.push('ingress:');
    lines.push(`  enabled: ${this.values.ingress.enabled}`);
    if (this.values.ingress.host) {
      lines.push(`  host: ${this.values.ingress.host}`);
    }
    lines.push('');

    if (Object.keys(this.values.config).length > 0) {
      lines.push('config:');
      lines.push('  # Custom configuration values');
      for (const [key, value] of Object.entries(this.values.config)) {
        lines.push(`  ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
      }
    }

    return lines.join('\n');
  }

  addDependency(name: string, chart: string, version: string, alias?: string): void {
    this.dependencies.push({ name, chart, version, alias });
  }

  getDependencies(): { name: string; chart: string; version: string; alias?: string }[] {
    return [...this.dependencies];
  }
}
