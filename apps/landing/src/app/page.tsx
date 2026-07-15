'use client';

import {
  ArrowRight,
  Brain,
  CheckCircle,
  ChevronRight,
  Cpu,
  FileCheck,
  GitBranch,
  Globe,
  Lock,
  Shield,
  Star,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: '9-Layer Architecture',
    description:
      'DNA → Schema → Behavioral → Governance → Decision → Quality → Audit → Mission → Learning. Every layer validated.',
  },
  {
    icon: Cpu,
    title: '30+ MCP Tools',
    description:
      'Native Model Context Protocol server. Works with OpenCode, Cursor, VS Code Copilot, Claude Desktop.',
  },
  {
    icon: GitBranch,
    title: 'DNA Patterns',
    description:
      '16 pre-built behavioral patterns. Military, surgical, lean factory, enterprise governance. Or create your own.',
  },
  {
    icon: Shield,
    title: 'EU AI Act Ready',
    description:
      'Built-in compliance for EU AI Act Article 11. Audit trails, governance rules, quality gates.',
  },
  {
    icon: FileCheck,
    title: '10-Stage Audit Pipeline',
    description:
      'Static → Architecture → Security → Performance → Tests → Coverage → Contracts → Docs → Compliance → Benchmarks.',
  },
  {
    icon: Lock,
    title: 'Better Auth Integration',
    description:
      'SSO/SAML, OAuth (GitHub, Google), email/password. Enterprise-grade authentication out of the box.',
  },
];

const pricing = [
  {
    name: 'Community',
    price: '$0',
    period: 'para sempre',
    description: 'Tudo que precisas para começar.',
    features: [
      'Core engines (9 layers)',
      'MCP Server (30+ tools)',
      'SDK TypeScript',
      'CLI (init, compile, validate)',
      '16 DNA patterns',
      'Self-hosted dashboard',
      'MIT License',
    ],
    cta: 'Get Started',
    ctaHref: 'https://github.com/ilvan-develop/behavioros',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/mês',
    description: 'Para equipas em crescimento.',
    features: [
      'Everything in Community',
      'Cloud dashboard (no self-host)',
      'Team workspaces',
      'Advanced observability',
      'Compliance reports (PDF/CSV)',
      'Real-time alerts',
      'Priority support',
      'Up to 10 agents',
    ],
    cta: 'Start Free Trial',
    ctaHref: '#',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: '$500+',
    period: '/mês',
    description: 'Para grandes empresas.',
    features: [
      'Everything in Pro',
      'On-premise or dedicated cloud',
      'SSO/SAML, advanced RBAC',
      'EU AI Act compliance toolkit',
      'Immutable audit trail',
      'SLA 99.9% + dedicated TAM',
      'Custom DNA patterns',
      '24/7 enterprise support',
    ],
    cta: 'Contact Sales',
    ctaHref: '#',
    featured: false,
  },
];

const stats = [
  { label: 'Packages', value: '9' },
  { label: 'MCP Tools', value: '30+' },
  { label: 'DNA Patterns', value: '16' },
  { label: 'Audit Stages', value: '10' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-zinc-800 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-sm font-bold">
              B
            </div>
            <span className="text-lg font-bold">BehaviorOS</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#features"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Features
            </a>
            <a href="#pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Pricing
            </a>
            <a
              href="https://github.com/ilvan-develop/behavioros"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <Star className="h-4 w-4" />
              GitHub
            </a>
            <a
              href="/dashboard"
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              Dashboard
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-1.5 text-sm text-zinc-400">
            <Zap className="h-4 w-4 text-purple-400" />
            v0.1.0 — Open Source under MIT License
          </div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-7xl">
            The Operating System for{' '}
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent">
              Autonomous AI Teams
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400">
            Behavioral governance framework with 9-layer architecture, 30+ MCP tools, DNA patterns,
            and EU AI Act compliance. Built in Angola for the world.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="https://github.com/ilvan-develop/behavioros"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium text-black hover:bg-zinc-200 transition-colors"
            >
              <Star className="h-4 w-4" />
              Star on GitHub
            </a>
            <a
              href="#pricing"
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-900 transition-colors"
            >
              View Pricing
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-zinc-800 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Everything you need</h2>
            <p className="text-zinc-400">
              The only framework combining governance, compliance, learning, and audit trails.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 transition-colors"
              >
                <feature.icon className="mb-4 h-8 w-8 text-purple-400" />
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="border-t border-zinc-800 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">9-Layer Architecture</h2>
            <p className="text-zinc-400">
              Each layer has a dedicated engine. Layers are evaluated bottom-up.
            </p>
          </div>
          <div className="mx-auto max-w-2xl space-y-2">
            {[
              { layer: 'Mission Layer', desc: 'Lifecycle: create → start → execute → complete' },
              { layer: 'Learning Layer', desc: 'Record events → detect patterns → auto-apply' },
              { layer: 'Quality Layer', desc: 'Gates: coverage, lint, typecheck, security' },
              { layer: 'Audit Layer', desc: '10-stage pipeline with scoring' },
              { layer: 'Decision Layer', desc: 'Voting-based decisions with thresholds' },
              { layer: 'Governance Layer', desc: 'Rules: block, escalate, warn, log' },
              { layer: 'Behavioral Layer', desc: 'DNA loading, validation, composition' },
              { layer: 'Schema Layer', desc: 'Zod v4 schemas for all types' },
              { layer: 'DNA Layer', desc: 'Personas, rules, gates, patterns, workflows' },
            ].map((item, i) => (
              <div
                key={item.layer}
                className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-purple-600/20 text-sm font-bold text-purple-400">
                  {9 - i}
                </div>
                <div>
                  <div className="text-sm font-medium">{item.layer}</div>
                  <div className="text-xs text-zinc-500">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-zinc-800 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Simple, transparent pricing</h2>
            <p className="text-zinc-400">Start free, pay when you need more.</p>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-8 ${
                  plan.featured
                    ? 'border-purple-500 bg-purple-900/10'
                    : 'border-zinc-800 bg-zinc-900/30'
                }`}
              >
                {plan.featured && (
                  <div className="mb-4 inline-flex items-center gap-1 rounded-full bg-purple-600/20 px-3 py-1 text-xs font-medium text-purple-400">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-zinc-500">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.ctaHref}
                  target={plan.ctaHref.startsWith('http') ? '_blank' : undefined}
                  rel={plan.ctaHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className={`mt-8 flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors ${
                    plan.featured
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'border border-zinc-700 text-white hover:bg-zinc-800'
                  }`}
                >
                  {plan.cta}
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Ready to govern your AI agents?</h2>
          <p className="mb-8 text-zinc-400">Join the open-source community. Start in 5 minutes.</p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <code className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm text-green-400">
              pnpm add @behavioros/sdk @behavioros/core
            </code>
            <a
              href="https://github.com/ilvan-develop/behavioros"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              <Globe className="h-4 w-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-600 text-xs font-bold">
              B
            </div>
            <span className="text-sm font-medium">BehaviorOS</span>
          </div>
          <p className="text-sm text-zinc-500">
            Created by{' '}
            <a
              href="https://github.com/ilvan-develop"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Ilvan Joaquim
            </a>{' '}
            — Angola
          </p>
          <div className="flex gap-4">
            <a
              href="https://github.com/ilvan-develop/behavioros"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a href="/docs" className="text-sm text-zinc-500 hover:text-white transition-colors">
              Docs
            </a>
            <a href="/discord" className="text-sm text-zinc-500 hover:text-white transition-colors">
              Discord
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
