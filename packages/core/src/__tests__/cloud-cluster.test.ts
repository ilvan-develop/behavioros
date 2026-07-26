import { beforeEach, describe, expect, it } from 'vitest';
import { KernelCluster } from '../engines/cloud/kernel-cluster';
import { LeaderElection } from '../engines/cloud/leader-election';

describe('KernelCluster', () => {
  let cluster: KernelCluster;

  beforeEach(() => {
    cluster = new KernelCluster('node-1', 'http://localhost:3001');
  });

  describe('constructor', () => {
    it('should register the local node on creation', () => {
      const nodes = cluster.getNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('node-1');
      expect(nodes[0].address).toBe('http://localhost:3001');
      expect(nodes[0].role).toBe('follower');
      expect(nodes[0].status).toBe('active');
    });
  });

  describe('join', () => {
    it('should add a new node to the cluster', () => {
      cluster.join({
        id: 'node-2',
        address: 'http://localhost:3002',
        role: 'follower',
        version: '1.0.0',
        capabilities: ['storage'],
      });

      expect(cluster.getNodes()).toHaveLength(2);
      const node = cluster.getNode('node-2');
      expect(node).toBeDefined();
      expect(node!.status).toBe('active');
      expect(node!.joinedAt).toBeDefined();
    });
  });

  describe('leave', () => {
    it('should remove a node from the cluster', () => {
      cluster.join({
        id: 'node-2',
        address: 'http://localhost:3002',
        role: 'follower',
        version: '1.0.0',
        capabilities: [],
      });

      cluster.leave('node-2');
      expect(cluster.getNodes()).toHaveLength(1);
      expect(cluster.getNode('node-2')).toBeUndefined();
    });

    it('should clear the leader when the leader leaves', () => {
      cluster.join({
        id: 'node-2',
        address: 'http://localhost:3002',
        role: 'follower',
        version: '1.0.0',
        capabilities: [],
      });

      cluster.getState().leaderId = 'node-2';
      cluster.leave('node-2');
      expect(cluster.getState().leaderId).toBeNull();
    });

    it('should not error when removing a non-existent node', () => {
      expect(() => cluster.leave('non-existent')).not.toThrow();
    });
  });

  describe('getNode / getNodes', () => {
    it('should return undefined for unknown node', () => {
      expect(cluster.getNode('unknown')).toBeUndefined();
    });
  });

  describe('getLeader', () => {
    it('should return undefined when no leader is set', () => {
      expect(cluster.getLeader()).toBeUndefined();
    });

    it('should return the leader node when set', () => {
      cluster.join({
        id: 'node-2',
        address: 'http://localhost:3002',
        role: 'leader',
        version: '1.0.0',
        capabilities: [],
      });
      cluster.getState().leaderId = 'node-2';

      const leader = cluster.getLeader();
      expect(leader).toBeDefined();
      expect(leader!.id).toBe('node-2');
    });
  });

  describe('heartbeat', () => {
    it('should update lastHeartbeat and set status to active', () => {
      cluster.join({
        id: 'node-2',
        address: 'http://localhost:3002',
        role: 'follower',
        version: '1.0.0',
        capabilities: [],
      });

      const before = cluster.getNode('node-2')!.lastHeartbeat;
      cluster.heartbeat('node-2');
      const after = cluster.getNode('node-2')!.lastHeartbeat;

      expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
      expect(cluster.getNode('node-2')!.status).toBe('active');
    });

    it('should do nothing for unknown nodes', () => {
      expect(() => cluster.heartbeat('unknown')).not.toThrow();
    });
  });

  describe('getActiveNodes', () => {
    it('should return only active nodes', () => {
      cluster.join({
        id: 'node-2',
        address: 'http://localhost:3002',
        role: 'follower',
        version: '1.0.0',
        capabilities: [],
      });
      cluster.join({
        id: 'node-3',
        address: 'http://localhost:3003',
        role: 'follower',
        version: '1.0.0',
        capabilities: [],
      });

      cluster.getNode('node-3')!.status = 'inactive';

      const active = cluster.getActiveNodes();
      expect(active).toHaveLength(2);
      expect(active.every((n) => n.status === 'active')).toBe(true);
    });
  });

  describe('getState', () => {
    it('should return the full cluster state', () => {
      const state = cluster.getState();
      expect(state).toHaveProperty('nodes');
      expect(state).toHaveProperty('leaderId');
      expect(state).toHaveProperty('term');
      expect(state).toHaveProperty('lastApplied');
      expect(state).toHaveProperty('commitIndex');
      expect(state.leaderId).toBeNull();
      expect(state.term).toBe(0);
    });
  });

  describe('isHealthy', () => {
    it('should return true when majority is active (single node)', () => {
      expect(cluster.isHealthy()).toBe(true);
    });

    it('should return true when majority is active (3 of 3)', () => {
      cluster.join({
        id: 'node-2',
        address: 'http://localhost:3002',
        role: 'follower',
        version: '1.0.0',
        capabilities: [],
      });
      cluster.join({
        id: 'node-3',
        address: 'http://localhost:3003',
        role: 'follower',
        version: '1.0.0',
        capabilities: [],
      });
      expect(cluster.isHealthy()).toBe(true);
    });

    it('should return false when majority is inactive', () => {
      cluster.join({
        id: 'node-2',
        address: 'http://localhost:3002',
        role: 'follower',
        version: '1.0.0',
        capabilities: [],
      });
      cluster.join({
        id: 'node-3',
        address: 'http://localhost:3003',
        role: 'follower',
        version: '1.0.0',
        capabilities: [],
      });

      cluster.getNode('node-2')!.status = 'inactive';
      cluster.getNode('node-3')!.status = 'inactive';

      expect(cluster.isHealthy()).toBe(false);
    });

    it('should return false when no nodes exist', () => {
      cluster.leave('node-1');
      expect(cluster.isHealthy()).toBe(false);
    });
  });
});

describe('LeaderElection', () => {
  let cluster: KernelCluster;
  let election: LeaderElection;

  beforeEach(() => {
    cluster = new KernelCluster('node-1', 'http://localhost:3001');
    election = new LeaderElection('node-1', cluster);
  });

  describe('startElection', () => {
    it('should win election with majority in a single-node cluster', async () => {
      const result = await election.startElection();
      expect(result).not.toBeNull();
      expect(result!.leaderId).toBe('node-1');
      expect(result!.votesReceived).toBeGreaterThanOrEqual(result!.votesNeeded);
      expect(result!.term).toBe(1);
      expect(result!.electedAt).toBeDefined();
    });

    it('should increment term on each election attempt', async () => {
      await election.startElection();
      expect(election.getTerm()).toBe(1);

      election.stepDown();
      await election.startElection();
      expect(election.getTerm()).toBe(2);
    });
  });

  describe('voteFor', () => {
    it('should grant vote to a candidate with higher term', () => {
      const granted = election.voteFor('node-2', 5);
      expect(granted).toBe(true);
      expect(election.getTerm()).toBe(5);
    });

    it('should deny vote for candidate with lower term', () => {
      election.voteFor('node-2', 5);
      const granted = election.voteFor('node-3', 3);
      expect(granted).toBe(false);
    });

    it('should deny vote after already voting in current term', () => {
      election.voteFor('node-2', 5);
      const granted = election.voteFor('node-3', 5);
      expect(granted).toBe(false);
    });
  });

  describe('getLeader', () => {
    it('should return null before any election', () => {
      expect(election.getLeader()).toBeNull();
    });

    it('should return the elected leader after winning', async () => {
      await election.startElection();
      expect(election.getLeader()).toBe('node-1');
    });
  });

  describe('getTerm', () => {
    it('should start at term 0', () => {
      expect(election.getTerm()).toBe(0);
    });
  });

  describe('isLeader', () => {
    it('should return false before election', () => {
      expect(election.isLeader()).toBe(false);
    });

    it('should return true after winning election', async () => {
      await election.startElection();
      expect(election.isLeader()).toBe(true);
    });
  });

  describe('heartbeatTimeout', () => {
    it('should not throw when called', () => {
      expect(() => election.heartbeatTimeout(100)).not.toThrow();
    });
  });

  describe('stepDown', () => {
    it('should clear the leader', async () => {
      await election.startElection();
      expect(election.isLeader()).toBe(true);

      election.stepDown();
      expect(election.isLeader()).toBe(false);
      expect(election.getLeader()).toBeNull();
      expect(cluster.getState().leaderId).toBeNull();
    });
  });

  describe('startElection with multiple nodes', () => {
    it('should not win without majority votes', async () => {
      cluster.join({
        id: 'node-2',
        address: 'http://localhost:3002',
        role: 'follower',
        version: '1.0.0',
        capabilities: [],
      });

      await election.startElection();
      expect(election.isLeader()).toBe(true);
    });
  });
});
