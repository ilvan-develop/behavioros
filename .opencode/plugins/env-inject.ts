import type { Plugin } from '@opencode-ai/plugin';

export const EnvInjectPlugin: Plugin = async ({ worktree }) => {
  return {
    'shell.env': async (input, output) => {
      // Inject BehaviorOS environment variables
      output.env.BEHAVIOROS_DNA_PATH = `${worktree}/dnas`;
      output.env.BEHAVIOROS_WORKSPACE = worktree;
      output.env.NODE_ENV = output.env.NODE_ENV || 'development';
    },
  };
};
