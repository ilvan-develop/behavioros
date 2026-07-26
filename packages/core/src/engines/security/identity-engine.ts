import { randomUUID } from 'node:crypto';

/**
 * User — Configuration and options interface.
 */
export interface User {
  id: string;
  username: string;
  roles: string[];
  attributes: Record<string, string>;
  enabled: boolean;
  createdAt: string;
}

/**
 * Session — Configuration and options interface.
 */
export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  attributes: Record<string, unknown>;
}

/**
 * IdentityEngine — identity engine.
 *
 * Methods: createUser, getUser, findByUsername, authenticate, validateSession, revokeSession, and 2 more.
 */
export class IdentityEngine {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private passwords: Map<string, string> = new Map();

  createUser(username: string, roles?: string[], attributes?: Record<string, string>): User {
    if (this.findByUsername(username)) {
      throw new Error(`User already exists: ${username}`);
    }
    const user: User = {
      id: randomUUID(),
      username,
      roles: roles ?? [],
      attributes: attributes ?? {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  findByUsername(username: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.username === username) return user;
    }
    return undefined;
  }

  authenticate(username: string, password: string): Session {
    const user = this.findByUsername(username);
    if (!user) throw new Error('Invalid credentials');
    if (!user.enabled) throw new Error('User is disabled');
    const stored = this.passwords.get(user.id);
    if (!stored || stored !== password) throw new Error('Invalid credentials');
    const session: Session = {
      id: randomUUID(),
      userId: user.id,
      token: randomUUID(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      attributes: {},
    };
    this.sessions.set(session.token, session);
    return session;
  }

  validateSession(token: string): Session | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  revokeSession(token: string): void {
    this.sessions.delete(token);
  }

  disableUser(id: string): void {
    const user = this.users.get(id);
    if (user) {
      user.enabled = false;
    }
  }

  listUsers(): User[] {
    return Array.from(this.users.values());
  }
}
