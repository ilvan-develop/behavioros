import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../shared/logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.BEHAVIOROS_LOG_FORMAT;
  });

  it('log at different levels produces entries with correct level', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger('TestComponent');

    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    logger.debug('debug message');

    expect(logSpy).toHaveBeenCalledTimes(4);
    const calls = logSpy.mock.calls.map((c) => c[0] as string);

    expect(calls[0]).toContain('[INFO]');
    expect(calls[1]).toContain('[WARN]');
    expect(calls[2]).toContain('[ERROR]');
    expect(calls[3]).toContain('[DEBUG]');
  });

  it('format includes timestamp, level, and component', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger('AuthModule');

    logger.info('user logged in');

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toMatch(/^\[[\dT:.Z-]+\]/);
    expect(output).toContain('[INFO]');
    expect(output).toContain('[AuthModule]');
    expect(output).toContain('user logged in');
  });

  it('JSON format when BEHAVIOROS_LOG_FORMAT=json', () => {
    process.env.BEHAVIOROS_LOG_FORMAT = 'json';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger('JsonLogger');

    logger.info('json message', { userId: 42 });

    const output = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('info');
    expect(output.component).toBe('JsonLogger');
    expect(output.message).toBe('json message');
    expect(output.metadata).toEqual({ userId: 42 });
  });

  it('includes metadata in JSON format', () => {
    process.env.BEHAVIOROS_LOG_FORMAT = 'json';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger('MetaLogger');

    logger.error('something broke', { errorCode: 500, stack: 'at line 42' });

    const output = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(output.metadata.errorCode).toBe(500);
    expect(output.metadata.stack).toBe('at line 42');
  });

  it('default text format does not include metadata', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger('NoMetaLogger');

    logger.warn('just a warning', { extra: 'data' });

    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('[WARN]');
    expect(output).toContain('just a warning');
    expect(output).not.toContain('extra');
  });
});
