/**
 * Container Runner for NanoClaw
 * Spawns agent execution in Docker and handles IPC
 */
import { ChildProcess, exec, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  CONTAINER_IMAGE,
  CONTAINER_MAX_OUTPUT_SIZE,
  CONTAINER_TIMEOUT,
  DATA_DIR,
  GROUPS_DIR,
} from './config.js';
import { logger } from './logger.js';
import { validateAdditionalMounts } from './mount-security.js';
import { RegisteredGroup } from './types.js';

// Sentinel markers for robust output parsing (must match agent-runner)
const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

function getHomeDir(): string {
  const home = process.env.HOME || os.homedir();
  if (!home) {
    throw new Error(
      'Unable to determine home directory: HOME environment variable is not set and os.homedir() returned empty',
    );
  }
  return home;
}

export interface ContainerInput {
  requestId?: string;
  type?: 'request' | 'shutdown';
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
}

export interface AgentResponse {
  outputType: 'message' | 'log';
  userMessage?: string;
  internalLog?: string;
}

export interface ContainerOutput {
  status: 'success' | 'error';
  result: AgentResponse | null;
  newSessionId?: string;
  model?: string;
  error?: string;
}

interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readonly: boolean;
}

function buildVolumeMounts(
  group: RegisteredGroup,
  isMain: boolean,
): VolumeMount[] {
  const mounts: VolumeMount[] = [];
  const homeDir = getHomeDir();
  const projectRoot = process.cwd();

  if (isMain) {
    // Main gets the entire project root mounted
    mounts.push({
      hostPath: projectRoot,
      containerPath: '/workspace/project',
      readonly: false,
    });

    // Main also gets its group folder as the working directory
    mounts.push({
      hostPath: path.join(GROUPS_DIR, group.folder),
      containerPath: '/workspace/group',
      readonly: false,
    });
  } else {
    // Other groups only get their own folder
    mounts.push({
      hostPath: path.join(GROUPS_DIR, group.folder),
      containerPath: '/workspace/group',
      readonly: false,
    });

    // Global memory directory (read-only for non-main)
    const globalDir = path.join(GROUPS_DIR, 'global');
    if (fs.existsSync(globalDir)) {
      mounts.push({
        hostPath: globalDir,
        containerPath: '/workspace/global',
        readonly: true,
      });
    }
  }

  // Per-group Claude sessions directory (isolated from other groups)
  // Each group gets their own .claude/ to prevent cross-group session access
  const groupSessionsDir = path.join(
    DATA_DIR,
    'sessions',
    group.folder,
    '.claude',
  );
  fs.mkdirSync(groupSessionsDir, { recursive: true });
  mounts.push({
    hostPath: groupSessionsDir,
    containerPath: '/home/node/.claude',
    readonly: false,
  });

  // Per-group IPC namespace: each group gets its own IPC directory
  // This prevents cross-group privilege escalation via IPC
  const groupIpcDir = path.join(DATA_DIR, 'ipc', group.folder);
  fs.mkdirSync(path.join(groupIpcDir, 'messages'), { recursive: true });
  fs.mkdirSync(path.join(groupIpcDir, 'tasks'), { recursive: true });
  mounts.push({
    hostPath: groupIpcDir,
    containerPath: '/workspace/ipc',
    readonly: false,
  });

  // Environment file directory
  // Only expose specific auth variables needed by Claude Code, not the entire .env
  const envDir = path.join(DATA_DIR, 'env');
  fs.mkdirSync(envDir, { recursive: true });
  const envFile = path.join(projectRoot, '.env');
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf-8');
    const allowedVars = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'CREDENTIALS_KEY'];
    const filteredLines = envContent.split('\n').filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return false;
      return allowedVars.some((v) => trimmed.startsWith(`${v}=`));
    });

    if (filteredLines.length > 0) {
      fs.writeFileSync(
        path.join(envDir, 'env'),
        filteredLines.join('\n') + '\n',
      );
      mounts.push({
        hostPath: envDir,
        containerPath: '/workspace/env-dir',
        readonly: true,
      });
    }
  }

  // Additional mounts validated against external allowlist (tamper-proof from containers)
  if (group.containerConfig?.additionalMounts) {
    const validatedMounts = validateAdditionalMounts(
      group.containerConfig.additionalMounts,
      group.name,
      isMain,
    );
    mounts.push(...validatedMounts);
  }

  return mounts;
}

function buildContainerArgs(mounts: VolumeMount[], containerName: string): string[] {
  const args: string[] = ['run', '-i', '--rm', '--name', containerName];

  // Docker: --mount for readonly, -v for read-write
  for (const mount of mounts) {
    if (mount.readonly) {
      args.push(
        '--mount',
        `type=bind,source=${mount.hostPath},target=${mount.containerPath},readonly`,
      );
    } else {
      args.push('-v', `${mount.hostPath}:${mount.containerPath}`);
    }
  }

  args.push(CONTAINER_IMAGE);

  return args;
}

export async function runContainerAgent(
  group: RegisteredGroup,
  input: ContainerInput,
  onProcess: (proc: ChildProcess, containerName: string) => void,
): Promise<ContainerOutput> {
  const startTime = Date.now();

  const groupDir = path.join(GROUPS_DIR, group.folder);
  fs.mkdirSync(groupDir, { recursive: true });

  const mounts = buildVolumeMounts(group, input.isMain);
  const safeName = group.folder.replace(/[^a-zA-Z0-9-]/g, '-');
  const containerName = `nanoclaw-${safeName}-${Date.now()}`;
  const containerArgs = buildContainerArgs(mounts, containerName);

  logger.debug(
    {
      group: group.name,
      containerName,
      mounts: mounts.map(
        (m) =>
          `${m.hostPath} -> ${m.containerPath}${m.readonly ? ' (ro)' : ''}`,
      ),
      containerArgs: containerArgs.join(' '),
    },
    'Container mount configuration',
  );

  logger.info(
    {
      group: group.name,
      containerName,
      mountCount: mounts.length,
      isMain: input.isMain,
    },
    'Spawning container agent',
  );

  const logsDir = path.join(GROUPS_DIR, group.folder, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  return new Promise((resolve) => {
    const container = spawn('docker', containerArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    onProcess(container, containerName);

    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;

    container.stdin.write(JSON.stringify(input));
    container.stdin.end();

    container.stdout.on('data', (data) => {
      if (stdoutTruncated) return;
      const chunk = data.toString();
      const remaining = CONTAINER_MAX_OUTPUT_SIZE - stdout.length;
      if (chunk.length > remaining) {
        stdout += chunk.slice(0, remaining);
        stdoutTruncated = true;
        logger.warn(
          { group: group.name, size: stdout.length },
          'Container stdout truncated due to size limit',
        );
      } else {
        stdout += chunk;
      }
    });

    container.stderr.on('data', (data) => {
      const chunk = data.toString();
      const lines = chunk.trim().split('\n');
      for (const line of lines) {
        if (line) logger.debug({ container: group.folder }, line);
      }
      if (stderrTruncated) return;
      const remaining = CONTAINER_MAX_OUTPUT_SIZE - stderr.length;
      if (chunk.length > remaining) {
        stderr += chunk.slice(0, remaining);
        stderrTruncated = true;
        logger.warn(
          { group: group.name, size: stderr.length },
          'Container stderr truncated due to size limit',
        );
      } else {
        stderr += chunk;
      }
    });

    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      logger.error({ group: group.name, containerName }, 'Container timeout, stopping gracefully');
      // Graceful stop: sends SIGTERM, waits, then SIGKILL — lets --rm fire
      exec(`docker stop ${containerName}`, { timeout: 15000 }, (err) => {
        if (err) {
          logger.warn({ group: group.name, containerName, err }, 'Graceful stop failed, force killing');
          container.kill('SIGKILL');
        }
      });
    }, group.containerConfig?.timeout || CONTAINER_TIMEOUT);

    container.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      if (timedOut) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const timeoutLog = path.join(logsDir, `container-${ts}.log`);
        fs.writeFileSync(timeoutLog, [
          `=== Container Run Log (TIMEOUT) ===`,
          `Timestamp: ${new Date().toISOString()}`,
          `Group: ${group.name}`,
          `Container: ${containerName}`,
          `Duration: ${duration}ms`,
          `Exit Code: ${code}`,
        ].join('\n'));

        logger.error(
          { group: group.name, containerName, duration, code },
          'Container timed out',
        );

        resolve({
          status: 'error',
          result: null,
          error: `Container timed out after ${group.containerConfig?.timeout || CONTAINER_TIMEOUT}ms`,
        });
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(logsDir, `container-${timestamp}.log`);
      const isVerbose =
        process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace';

      const logLines = [
        `=== Container Run Log ===`,
        `Timestamp: ${new Date().toISOString()}`,
        `Group: ${group.name}`,
        `IsMain: ${input.isMain}`,
        `Duration: ${duration}ms`,
        `Exit Code: ${code}`,
        `Stdout Truncated: ${stdoutTruncated}`,
        `Stderr Truncated: ${stderrTruncated}`,
        ``,
      ];

      const isError = code !== 0;

      if (isVerbose || isError) {
        logLines.push(
          `=== Input ===`,
          JSON.stringify(input, null, 2),
          ``,
          `=== Container Args ===`,
          containerArgs.join(' '),
          ``,
          `=== Mounts ===`,
          mounts
            .map(
              (m) =>
                `${m.hostPath} -> ${m.containerPath}${m.readonly ? ' (ro)' : ''}`,
            )
            .join('\n'),
          ``,
          `=== Stderr${stderrTruncated ? ' (TRUNCATED)' : ''} ===`,
          stderr,
          ``,
          `=== Stdout${stdoutTruncated ? ' (TRUNCATED)' : ''} ===`,
          stdout,
        );
      } else {
        logLines.push(
          `=== Input Summary ===`,
          `Prompt length: ${input.prompt.length} chars`,
          `Session ID: ${input.sessionId || 'new'}`,
          ``,
          `=== Mounts ===`,
          mounts
            .map((m) => `${m.containerPath}${m.readonly ? ' (ro)' : ''}`)
            .join('\n'),
          ``,
        );
      }

      fs.writeFileSync(logFile, logLines.join('\n'));
      logger.debug({ logFile, verbose: isVerbose }, 'Container log written');

      if (code !== 0) {
        logger.error(
          {
            group: group.name,
            code,
            duration,
            stderr,
            stdout,
            logFile,
          },
          'Container exited with error',
        );

        resolve({
          status: 'error',
          result: null,
          error: `Container exited with code ${code}: ${stderr.slice(-200)}`,
        });
        return;
      }

      try {
        // Extract JSON between sentinel markers for robust parsing
        const startIdx = stdout.indexOf(OUTPUT_START_MARKER);
        const endIdx = stdout.indexOf(OUTPUT_END_MARKER);

        let jsonLine: string;
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonLine = stdout
            .slice(startIdx + OUTPUT_START_MARKER.length, endIdx)
            .trim();
        } else {
          // Fallback: last non-empty line (backwards compatibility)
          const lines = stdout.trim().split('\n');
          jsonLine = lines[lines.length - 1];
        }

        const output: ContainerOutput = JSON.parse(jsonLine);

        logger.info(
          {
            group: group.name,
            duration,
            status: output.status,
            hasResult: !!output.result,
          },
          'Container completed',
        );

        resolve(output);
      } catch (err) {
        logger.error(
          {
            group: group.name,
            stdout,
            stderr,
            error: err,
          },
          'Failed to parse container output',
        );

        resolve({
          status: 'error',
          result: null,
          error: `Failed to parse container output: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });

    container.on('error', (err) => {
      clearTimeout(timeout);
      logger.error({ group: group.name, containerName, error: err }, 'Container spawn error');
      resolve({
        status: 'error',
        result: null,
        error: `Container spawn error: ${err.message}`,
      });
    });
  });
}

// ============================================================================
// Persistent Container Pool
// ============================================================================

type PoolStatus = 'starting' | 'idle' | 'busy' | 'dead';

interface PoolEntry {
  groupFolder: string;
  containerName: string;
  process: ChildProcess;
  status: PoolStatus;
  restartCount: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildContainerArgsForPersistent(
  mounts: VolumeMount[],
  containerName: string,
): string[] {
  // No -i (no stdin), no --rm (persistent lifecycle)
  const args: string[] = ['run', '--name', containerName];

  for (const mount of mounts) {
    if (mount.readonly) {
      args.push(
        '--mount',
        `type=bind,source=${mount.hostPath},target=${mount.containerPath},readonly`,
      );
    } else {
      args.push('-v', `${mount.hostPath}:${mount.containerPath}`);
    }
  }

  args.push(CONTAINER_IMAGE);
  return args;
}

export class ContainerPool {
  private pool = new Map<string, PoolEntry>();
  private shuttingDown = false;

  /**
   * Ensure a persistent container is running for the given group.
   * Idempotent — starts one if needed, restarts if dead.
   */
  async ensureContainer(group: RegisteredGroup): Promise<void> {
    const existing = this.pool.get(group.folder);
    if (existing && existing.status !== 'dead') return;

    const isMain = group.folder === 'main';
    const groupDir = path.join(GROUPS_DIR, group.folder);
    fs.mkdirSync(groupDir, { recursive: true });

    const mounts = buildVolumeMounts(group, isMain);
    const safeName = group.folder.replace(/[^a-zA-Z0-9-]/g, '-');
    const containerName = `nanoclaw-${safeName}-persistent`;

    // Remove stale container with this name (safeName is already sanitized)
    try {
      const { execSync } = await import('child_process');
      execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' });
      logger.debug({ containerName }, 'Removed stale persistent container');
    } catch {
      // Didn't exist, fine
    }

    // Clear stale ready file
    const groupIpcDir = path.join(DATA_DIR, 'ipc', group.folder);
    fs.mkdirSync(path.join(groupIpcDir, 'requests'), { recursive: true });
    fs.mkdirSync(path.join(groupIpcDir, 'responses'), { recursive: true });
    const readyFile = path.join(groupIpcDir, 'ready');
    try { fs.unlinkSync(readyFile); } catch { /* didn't exist */ }

    const containerArgs = buildContainerArgsForPersistent(mounts, containerName);

    logger.info(
      { group: group.name, containerName, mountCount: mounts.length, isMain },
      'Starting persistent container',
    );

    const proc = spawn('docker', containerArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const entry: PoolEntry = {
      groupFolder: group.folder,
      containerName,
      process: proc,
      status: 'starting',
      restartCount: existing ? existing.restartCount + 1 : 0,
    };
    this.pool.set(group.folder, entry);

    // Stream stderr for logging
    proc.stderr.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line) logger.debug({ container: group.folder }, line);
      }
    });

    // Drain stdout (not used for output, but prevent buffer backpressure)
    proc.stdout.on('data', () => {});

    proc.on('close', (code) => {
      if (!this.shuttingDown) {
        logger.warn(
          { group: group.folder, code, containerName },
          'Persistent container died unexpectedly',
        );
      }
      entry.status = 'dead';
    });

    proc.on('error', (err) => {
      logger.error(
        { group: group.folder, containerName, error: err },
        'Persistent container spawn error',
      );
      entry.status = 'dead';
    });

    // Wait for ready file
    await this.waitForReady(group.folder, containerName, readyFile);
    entry.status = 'idle';
    logger.info({ group: group.name, containerName }, 'Persistent container ready');
  }

  private async waitForReady(
    groupFolder: string,
    containerName: string,
    readyFile: string,
  ): Promise<void> {
    const timeout = 30000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (fs.existsSync(readyFile)) return;
      const entry = this.pool.get(groupFolder);
      if (entry?.status === 'dead') {
        throw new Error(`Container ${containerName} died during startup`);
      }
      await sleep(200);
    }
    throw new Error(`Container ${containerName} did not become ready within ${timeout}ms`);
  }

  /**
   * Send a request to a persistent container and wait for the response.
   */
  async sendRequest(
    group: RegisteredGroup,
    input: ContainerInput,
    onProcess: (proc: ChildProcess, containerName: string) => void,
  ): Promise<ContainerOutput> {
    await this.ensureContainer(group);

    const entry = this.pool.get(group.folder)!;
    entry.status = 'busy';
    onProcess(entry.process, entry.containerName);

    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const groupIpcDir = path.join(DATA_DIR, 'ipc', group.folder);
    const requestsDir = path.join(groupIpcDir, 'requests');
    const responsesDir = path.join(groupIpcDir, 'responses');
    fs.mkdirSync(requestsDir, { recursive: true });
    fs.mkdirSync(responsesDir, { recursive: true });

    const filename = `${requestId}.json`;
    const requestPayload = { ...input, requestId };

    // Atomic write
    const requestPath = path.join(requestsDir, filename);
    const tempPath = requestPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(requestPayload));
    fs.renameSync(tempPath, requestPath);

    logger.info(
      { group: group.name, requestId, containerName: entry.containerName },
      'Request sent to persistent container',
    );

    // Poll for response
    const requestTimeout = group.containerConfig?.timeout ?? CONTAINER_TIMEOUT;
    const responsePath = path.join(responsesDir, filename);
    const start = Date.now();

    try {
      while (Date.now() - start < requestTimeout) {
        if (fs.existsSync(responsePath)) {
          const raw = fs.readFileSync(responsePath, 'utf-8');
          fs.unlinkSync(responsePath);
          entry.status = 'idle';

          const output: ContainerOutput = JSON.parse(raw);
          const duration = Date.now() - start;
          logger.info(
            { group: group.name, requestId, duration, status: output.status },
            'Response received from persistent container',
          );
          return output;
        }

        // Check if container died mid-request (set async by close handler)
        if ((entry.status as PoolStatus) === 'dead') {
          try { fs.unlinkSync(requestPath); } catch { /* already picked up */ }
          return {
            status: 'error',
            result: null,
            error: 'Container died while processing request',
          };
        }

        await sleep(250);
      }

      // Timeout
      logger.error({ group: group.folder, requestId }, 'Request timed out');
      try { fs.unlinkSync(requestPath); } catch { /* already picked up */ }
      entry.status = 'dead'; // Force restart on next request
      return {
        status: 'error',
        result: null,
        error: `Request timed out after ${requestTimeout}ms`,
      };
    } finally {
      if (entry.status === 'busy') {
        entry.status = 'idle';
      }
    }
  }

  /**
   * Gracefully shut down all persistent containers.
   */
  async shutdown(gracePeriodMs: number): Promise<void> {
    this.shuttingDown = true;
    logger.info({ poolSize: this.pool.size, gracePeriodMs }, 'ContainerPool shutting down');

    // Send shutdown request files and docker stop
    for (const [groupFolder, entry] of this.pool) {
      if (entry.status === 'dead') continue;

      // Write shutdown request
      const requestsDir = path.join(DATA_DIR, 'ipc', groupFolder, 'requests');
      try {
        fs.mkdirSync(requestsDir, { recursive: true });
        const shutdownPath = path.join(requestsDir, 'shutdown.json');
        fs.writeFileSync(shutdownPath, JSON.stringify({
          type: 'shutdown', requestId: 'shutdown',
          prompt: '', groupFolder, chatJid: '', isMain: false,
        }));
      } catch { /* best effort */ }

      // Also docker stop (containerName is already sanitized to alphanumeric + dashes)
      exec(`docker stop ${entry.containerName}`, { timeout: gracePeriodMs }, (err) => {
        if (err) {
          logger.warn({ groupFolder, err: err.message }, 'docker stop failed during shutdown');
        }
      });
    }

    // Wait for processes to exit
    const deadline = Date.now() + gracePeriodMs;
    while (Date.now() < deadline) {
      const alive = [...this.pool.values()].filter(
        (e) => e.process.exitCode === null && !e.process.killed,
      );
      if (alive.length === 0) break;
      await sleep(500);
    }

    // Force kill stragglers
    for (const entry of this.pool.values()) {
      if (entry.process.exitCode === null && !entry.process.killed) {
        logger.warn({ container: entry.containerName }, 'Force killing container');
        exec(`docker kill ${entry.containerName}`, () => {});
      }
    }
  }
}

export function writeTasksSnapshot(
  groupFolder: string,
  isMain: boolean,
  tasks: Array<{
    id: string;
    groupFolder: string;
    prompt: string;
    schedule_type: string;
    schedule_value: string;
    status: string;
    next_run: string | null;
  }>,
): void {
  // Write filtered tasks to the group's IPC directory
  const groupIpcDir = path.join(DATA_DIR, 'ipc', groupFolder);
  fs.mkdirSync(groupIpcDir, { recursive: true });

  // Main sees all tasks, others only see their own
  const filteredTasks = isMain
    ? tasks
    : tasks.filter((t) => t.groupFolder === groupFolder);

  const tasksFile = path.join(groupIpcDir, 'current_tasks.json');
  fs.writeFileSync(tasksFile, JSON.stringify(filteredTasks, null, 2));
}

export interface AvailableGroup {
  jid: string;
  name: string;
  lastActivity: string;
  isRegistered: boolean;
}

/**
 * Write available groups snapshot for the container to read.
 * Only main group can see all available groups (for activation).
 * Non-main groups only see their own registration status.
 */
export function writeGroupsSnapshot(
  groupFolder: string,
  isMain: boolean,
  groups: AvailableGroup[],
  registeredJids: Set<string>,
): void {
  const groupIpcDir = path.join(DATA_DIR, 'ipc', groupFolder);
  fs.mkdirSync(groupIpcDir, { recursive: true });

  // Main sees all groups; others see nothing (they can't activate groups)
  const visibleGroups = isMain ? groups : [];

  const groupsFile = path.join(groupIpcDir, 'available_groups.json');
  fs.writeFileSync(
    groupsFile,
    JSON.stringify(
      {
        groups: visibleGroups,
        lastSync: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}
