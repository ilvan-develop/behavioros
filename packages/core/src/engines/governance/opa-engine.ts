/**
 * RegoRule — Configuration and options interface.
 */
export interface RegoRule {
  name: string;
  condition: string;
  effect: 'allow' | 'deny' | 'warn';
  priority?: number;
}

/**
 * OpaPolicy — Configuration and options interface.
 */
export interface OpaPolicy {
  id: string;
  name: string;
  rules: RegoRule[];
  defaultEffect: 'allow' | 'deny';
}

/**
 * OpaDecision — Configuration and options interface.
 */
export interface OpaDecision {
  policyId: string;
  allowed: boolean;
  matchedRule?: string;
  reason: string;
  timestamp: string;
}

type Token =
  | { type: 'field'; value: string }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'op'; value: string }
  | { type: 'logical'; value: string }
  | { type: 'paren'; value: string }
  | { type: 'dot'; value: string }
  | { type: 'method'; value: string; args: unknown[] };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === ' ') {
      i++;
      continue;
    }
    if (expr[i] === '(' || expr[i] === ')') {
      tokens.push({ type: 'paren', value: expr[i] });
      i++;
      continue;
    }
    if (expr[i] === '.') {
      tokens.push({ type: 'dot', value: '.' });
      i++;
      continue;
    }
    if (expr[i] === "'") {
      let s = '';
      i++;
      while (i < expr.length && expr[i] !== "'") {
        s += expr[i];
        i++;
      }
      i++;
      tokens.push({ type: 'string', value: s });
      continue;
    }
    if (expr[i] === '&' && expr[i + 1] === '&') {
      tokens.push({ type: 'logical', value: '&&' });
      i += 2;
      continue;
    }
    if (expr[i] === '|' && expr[i + 1] === '|') {
      tokens.push({ type: 'logical', value: '||' });
      i += 2;
      continue;
    }
    if (expr[i] === '!' && expr[i + 1] === '=') {
      tokens.push({ type: 'op', value: '!=' });
      i += 2;
      continue;
    }
    if (expr[i] === '>' && expr[i + 1] === '=') {
      tokens.push({ type: 'op', value: '>=' });
      i += 2;
      continue;
    }
    if (expr[i] === '<' && expr[i + 1] === '=') {
      tokens.push({ type: 'op', value: '<=' });
      i += 2;
      continue;
    }
    if (expr[i] === '=' && expr[i + 1] === '=') {
      tokens.push({ type: 'op', value: '==' });
      i += 2;
      continue;
    }
    if (expr[i] === '>') {
      tokens.push({ type: 'op', value: '>' });
      i++;
      continue;
    }
    if (expr[i] === '<') {
      tokens.push({ type: 'op', value: '<' });
      i++;
      continue;
    }

    if (/[a-zA-Z_]/.test(expr[i])) {
      let w = '';
      while (i < expr.length && /[a-zA-Z_0-9]/.test(expr[i])) {
        w += expr[i];
        i++;
      }
      if (w === 'input') {
        tokens.push({ type: 'field', value: 'input' });
      } else {
        tokens.push({ type: 'field', value: w });
      }
      continue;
    }

    if (/\d/.test(expr[i])) {
      let n = '';
      while (i < expr.length && /\d/.test(expr[i])) {
        n += expr[i];
        i++;
      }
      tokens.push({ type: 'number', value: Number(n) });
      continue;
    }

    i++;
  }
  return tokens;
}

function resolveField(obj: Record<string, unknown>, path: string[]): unknown {
  let val: unknown = obj;
  for (const key of path) {
    if (val === null || val === undefined || typeof val !== 'object') return undefined;
    val = (val as Record<string, unknown>)[key];
  }
  return val;
}

function evaluateCondition(condition: string, input: Record<string, unknown>): boolean {
  const tokens = tokenize(condition);

  const parts = splitByLogical(tokens);
  const ops: string[] = [];
  const operands: Token[][] = [];

  for (const part of parts) {
    if (part.length === 1 && part[0].type === 'logical') {
      ops.push(part[0].value);
    } else {
      operands.push(part);
    }
  }

  if (operands.length === 1) {
    return evaluateSimple(operands[0], input);
  }

  let result = evaluateSimple(operands[0], input);
  for (let i = 0; i < ops.length && i + 1 < operands.length; i++) {
    const next = evaluateSimple(operands[i + 1], input);
    if (ops[i] === '&&') result = result && next;
    else result = result || next;
  }
  return result;
}

function splitByLogical(tokens: Token[]): Token[][] {
  const parts: Token[][] = [];
  let current: Token[] = [];
  for (const tok of tokens) {
    if (tok.type === 'logical') {
      parts.push(current);
      parts.push([tok]);
      current = [];
    } else {
      current.push(tok);
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

function evaluateSimple(tokens: Token[], input: Record<string, unknown>): boolean {
  if (tokens.length === 0) return true;

  const includesIdx = tokens.findIndex(
    (t, i) => t.type === 'field' && t.value === 'includes' && tokens[i - 1]?.type === 'dot',
  );
  if (includesIdx !== -1) {
    return evaluateIncludes(tokens, includesIdx, input);
  }

  const opIdx = tokens.findIndex((t) => t.type === 'op');
  if (opIdx === -1) return true;

  const leftTokens = tokens.slice(0, opIdx);
  const op = String(tokens[opIdx].value);
  const rightTokens = tokens.slice(opIdx + 1);

  const leftVal = resolveLeft(leftTokens, input);
  const rightVal = resolveRight(rightTokens, input);

  return compare(leftVal, op, rightVal);
}

function evaluateIncludes(
  tokens: Token[],
  includesIdx: number,
  input: Record<string, unknown>,
): boolean {
  const fieldTokens = tokens.slice(0, includesIdx - 1);
  const field = fieldTokens
    .filter((t) => t.type === 'field' && t.value !== 'input')
    .map((t) => String(t.value));
  const arr = resolveField(input, field);
  const arg = tokens[includesIdx + 1];
  if (arg && arg.type === 'paren' && arg.value === '(') {
    const _argToken = tokens[includesIdx + 2];
    const closing = tokens.findIndex(
      (t, i) => i > includesIdx + 2 && t.type === 'paren' && t.value === ')',
    );
    const args = tokens.slice(includesIdx + 2, closing === -1 ? undefined : closing);
    if (Array.isArray(arr)) {
      const val = resolveRight(args, input);
      return arr.includes(val);
    }
  }
  return false;
}

function resolveLeft(tokens: Token[], input: Record<string, unknown>): unknown {
  const fields = tokens
    .filter((t) => t.type === 'field' && t.value !== 'input')
    .map((t) => String(t.value));
  return resolveField(input, fields);
}

function resolveRight(tokens: Token[], input: Record<string, unknown>): unknown {
  if (tokens.length === 0) return undefined;
  const first = tokens[0];
  if (first.type === 'string') return first.value;
  if (first.type === 'number') return first.value;
  if (first.type === 'field') {
    const fields = tokens
      .filter((t) => t.type === 'field' && t.value !== 'input')
      .map((t) => String(t.value));
    return resolveField(input, fields);
  }
  return undefined;
}

function compare(left: unknown, op: string, right: unknown): boolean {
  switch (op) {
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '>':
      return (left as number) > (right as number);
    case '<':
      return (left as number) < (right as number);
    case '>=':
      return (left as number) >= (right as number);
    case '<=':
      return (left as number) <= (right as number);
    default:
      return false;
  }
}

/**
 * Lightweight OPA (Open Policy Agent) compatible policy evaluation engine.
 * Manages policies composed of Rego-like rules and evaluates them against input data.
 */
export class OpaEngine {
  private policies = new Map<string, OpaPolicy>();

  /**
   * Loads a policy into the engine. Rules are sorted by priority (descending)
   * so higher-priority rules are evaluated first.
   * @param policy - The policy definition with id, name, rules, and default effect.
   */
  loadPolicy(policy: OpaPolicy): void {
    const sorted = [...policy.rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.policies.set(policy.id, { ...policy, rules: sorted });
  }

  /**
   * Evaluates a specific policy against the given input data.
   * Iterates through rules in priority order and returns the first match.
   * Falls back to the policy's default effect if no rule matches.
   * @param policyId - The ID of the policy to evaluate.
   * @param input - The input data to evaluate against the policy rules.
   * @returns An OpaDecision with the evaluation result, matched rule, and reason.
   */
  evaluate(policyId: string, input: Record<string, unknown>): OpaDecision {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return {
        policyId,
        allowed: false,
        reason: `Policy not found: ${policyId}`,
        timestamp: new Date().toISOString(),
      };
    }

    for (const rule of policy.rules) {
      try {
        const matched = evaluateCondition(rule.condition, input);
        if (matched) {
          const allowed = rule.effect === 'allow' || rule.effect === 'warn';
          return {
            policyId,
            allowed,
            matchedRule: rule.name,
            reason: `${rule.effect === 'allow' ? 'Allowed' : rule.effect === 'deny' ? 'Denied' : 'Warning'} by rule: ${rule.name}`,
            timestamp: new Date().toISOString(),
          };
        }
      } catch {}
    }

    const allowed = policy.defaultEffect === 'allow';
    return {
      policyId,
      allowed,
      reason: `No rule matched, default effect: ${policy.defaultEffect}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Lists all loaded policies.
   * @returns An array of all OpaPolicy objects currently in the engine.
   */
  listPolicies(): OpaPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Removes a policy from the engine by its ID.
   * @param id - The ID of the policy to remove.
   */
  removePolicy(id: string): void {
    this.policies.delete(id);
  }

  /**
   * Evaluates all loaded policies against the given input data.
   * @param input - The input data to evaluate against all policies.
   * @returns An array of OpaDecision results, one per loaded policy.
   */
  evaluateAll(input: Record<string, unknown>): OpaDecision[] {
    const decisions: OpaDecision[] = [];
    for (const policyId of this.policies.keys()) {
      decisions.push(this.evaluate(policyId, input));
    }
    return decisions;
  }
}
