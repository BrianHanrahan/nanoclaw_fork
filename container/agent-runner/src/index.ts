/**
 * NanoClaw Agent Runner (Persistent)
 * Runs inside a long-lived container, polls for request files via IPC
 */

import fs from 'fs';
import path from 'path';
import { query, HookCallback, PreCompactHookInput } from '@anthropic-ai/claude-agent-sdk';
import { createIpcMcp } from './ipc-mcp.js';

interface ContainerInput {
  requestId: string;
  type?: 'request' | 'shutdown';
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
}

interface AgentResponse {
  outputType: 'message' | 'log';
  userMessage?: string;
  internalLog?: string;
}

const AGENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    outputType: {
      type: 'string',
      enum: ['message', 'log'],
      description: '"message": the userMessage field contains a message to send to the user or group. "log": the output will not be sent to the user or group.',
    },
    userMessage: {
      type: 'string',
      description: 'A message to send to the user or group. Include when outputType is "message".',
    },
    internalLog: {
      type: 'string',
      description: 'Information that will be logged internally but not sent to the user or group.',
    },
  },
  required: ['outputType'],
} as const;

interface ContainerOutput {
  requestId: string;
  status: 'success' | 'error';
  result: AgentResponse | null;
  newSessionId?: string;
  model?: string;
  error?: string;
}

interface SessionEntry {
  sessionId: string;
  fullPath: string;
  summary: string;
  firstPrompt: string;
}

interface SessionsIndex {
  entries: SessionEntry[];
}

const IPC_DIR = '/workspace/ipc';
const REQUESTS_DIR = path.join(IPC_DIR, 'requests');
const RESPONSES_DIR = path.join(IPC_DIR, 'responses');
const READY_FILE = path.join(IPC_DIR, 'ready');

function log(message: string): void {
  console.error(`[agent-runner] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getSessionSummary(sessionId: string, transcriptPath: string): string | null {
  const projectDir = path.dirname(transcriptPath);
  const indexPath = path.join(projectDir, 'sessions-index.json');

  if (!fs.existsSync(indexPath)) {
    log(`Sessions index not found at ${indexPath}`);
    return null;
  }

  try {
    const index: SessionsIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const entry = index.entries.find(e => e.sessionId === sessionId);
    if (entry?.summary) {
      return entry.summary;
    }
  } catch (err) {
    log(`Failed to read sessions index: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

/**
 * Archive the full transcript to conversations/ before compaction.
 */
function createPreCompactHook(): HookCallback {
  return async (input, _toolUseId, _context) => {
    const preCompact = input as PreCompactHookInput;
    const transcriptPath = preCompact.transcript_path;
    const sessionId = preCompact.session_id;

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      log('No transcript found for archiving');
      return {};
    }

    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const messages = parseTranscript(content);

      if (messages.length === 0) {
        log('No messages to archive');
        return {};
      }

      const summary = getSessionSummary(sessionId, transcriptPath);
      const name = summary ? sanitizeFilename(summary) : generateFallbackName();

      const conversationsDir = '/workspace/group/conversations';
      fs.mkdirSync(conversationsDir, { recursive: true });

      const date = new Date().toISOString().split('T')[0];
      const filename = `${date}-${name}.md`;
      const filePath = path.join(conversationsDir, filename);

      const markdown = formatTranscriptMarkdown(messages, summary);
      fs.writeFileSync(filePath, markdown);

      log(`Archived conversation to ${filePath}`);
    } catch (err) {
      log(`Failed to archive transcript: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {};
  };
}

function sanitizeFilename(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function generateFallbackName(): string {
  const time = new Date();
  return `conversation-${time.getHours().toString().padStart(2, '0')}${time.getMinutes().toString().padStart(2, '0')}`;
}

interface ParsedMessage {
  role: 'user' | 'assistant';
  content: string;
}

function parseTranscript(content: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'user' && entry.message?.content) {
        const text = typeof entry.message.content === 'string'
          ? entry.message.content
          : entry.message.content.map((c: { text?: string }) => c.text || '').join('');
        if (text) messages.push({ role: 'user', content: text });
      } else if (entry.type === 'assistant' && entry.message?.content) {
        const textParts = entry.message.content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text: string }) => c.text);
        const text = textParts.join('');
        if (text) messages.push({ role: 'assistant', content: text });
      }
    } catch {
    }
  }

  return messages;
}

function formatTranscriptMarkdown(messages: ParsedMessage[], title?: string | null): string {
  const now = new Date();
  const formatDateTime = (d: Date) => d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const lines: string[] = [];
  lines.push(`# ${title || 'Conversation'}`);
  lines.push('');
  lines.push(`Archived: ${formatDateTime(now)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of messages) {
    const sender = msg.role === 'user' ? 'User' : 'Andy';
    const content = msg.content.length > 2000
      ? msg.content.slice(0, 2000) + '...'
      : msg.content;
    lines.push(`**${sender}**: ${content}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Triage the incoming prompt using a fast model (Haiku) to decide
 * whether the request needs a powerful model (Opus) or a fast one (Sonnet).
 *
 * Simple/fast cases: logging workouts, quick questions, short factual answers,
 *   greetings, status checks, simple reminders.
 * Complex/powerful cases: research, planning, writing code, multi-step tasks,
 *   web searches, scheduling, analysis, anything requiring tools or judgment.
 *
 * Returns the model string to pass to query().
 */
async function triageModel(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log('No ANTHROPIC_API_KEY found, defaulting to sonnet');
    return 'claude-sonnet-4-5';
  }

  const triagePrompt = `You are a routing assistant. Classify the following user request and respond with ONLY one word:
- "haiku" if it is simple: logging data, short factual answers, greetings, status checks, yes/no questions, simple confirmations
- "sonnet" if it is moderate: general conversation, straightforward tasks, short writing, basic research
- "opus" if it is complex: multi-step planning, writing or modifying code, deep research, scheduling systems, architectural decisions, tasks requiring many tools

User request: ${prompt.slice(0, 500)}

Respond with only one word: haiku, sonnet, or opus`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 10,
        messages: [{ role: 'user', content: triagePrompt }],
      }),
    });

    if (!response.ok) {
      log(`Triage API error ${response.status}, defaulting to sonnet`);
      return 'claude-sonnet-4-5';
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const decision = data.content?.[0]?.text?.trim().toLowerCase() ?? '';

    if (decision.includes('haiku')) {
      log('Triage: haiku (simple request)');
      return 'claude-haiku-4-5';
    } else if (decision.includes('opus')) {
      log('Triage: opus (complex request)');
      return 'claude-opus-4-5';
    } else {
      log('Triage: sonnet (moderate request)');
      return 'claude-sonnet-4-5';
    }
  } catch (err) {
    log(`Triage failed: ${err instanceof Error ? err.message : String(err)}, defaulting to sonnet`);
    return 'claude-sonnet-4-5';
  }
}

/**
 * Process a single request — extracted from the old one-shot main().
 */
async function processRequest(input: ContainerInput): Promise<ContainerOutput> {
  log(`Processing request ${input.requestId} for group: ${input.groupFolder}`);

  const ipcMcp = createIpcMcp({
    chatJid: input.chatJid,
    groupFolder: input.groupFolder,
    isMain: input.isMain
  });

  let result: AgentResponse | null = null;
  let newSessionId: string | undefined;

  // Add context for scheduled tasks
  let prompt = input.prompt;
  if (input.isScheduledTask) {
    prompt = `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${input.prompt}`;
  }

  // Load global CLAUDE.md as additional system context (shared across all groups)
  const globalClaudeMdPath = '/workspace/global/CLAUDE.md';
  let globalClaudeMd: string | undefined;
  if (!input.isMain && fs.existsSync(globalClaudeMdPath)) {
    globalClaudeMd = fs.readFileSync(globalClaudeMdPath, 'utf-8');
  }

  // Triage: pick model based on request complexity
  // Skip triage for scheduled tasks — always use sonnet for reliability
  const model = input.isScheduledTask
    ? 'claude-sonnet-4-5'
    : await triageModel(prompt);

  try {
    log(`Starting agent with model: ${model}`);

    for await (const message of query({
      prompt,
      options: {
        cwd: '/workspace/group',
        resume: input.sessionId,
        model,
        systemPrompt: globalClaudeMd
          ? { type: 'preset' as const, preset: 'claude_code' as const, append: globalClaudeMd }
          : undefined,
        allowedTools: [
          'Bash',
          'Read', 'Write', 'Edit', 'Glob', 'Grep',
          'WebSearch', 'WebFetch',
          'mcp__nanoclaw__*'
        ],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        settingSources: ['project'],
        mcpServers: {
          nanoclaw: ipcMcp
        },
        hooks: {
          PreCompact: [{ hooks: [createPreCompactHook()] }]
        },
        outputFormat: {
          type: 'json_schema',
          schema: AGENT_RESPONSE_SCHEMA,
        }
      }
    })) {
      if (message.type === 'system' && message.subtype === 'init') {
        newSessionId = message.session_id;
        log(`Session initialized: ${newSessionId}`);
      }

      if (message.type === 'result') {
        if (message.subtype === 'success' && message.structured_output) {
          result = message.structured_output as AgentResponse;
          if (result.outputType === 'message' && !result.userMessage) {
            log('Warning: outputType is "message" but userMessage is missing, treating as "log"');
            result = { outputType: 'log', internalLog: result.internalLog };
          }
          log(`Agent result: outputType=${result.outputType}${result.internalLog ? `, log=${result.internalLog}` : ''}`);
        } else if (message.subtype === 'success' || message.subtype === 'error_max_structured_output_retries') {
          log(`Structured output unavailable (subtype=${message.subtype}), falling back to text`);
          const textResult = 'result' in message ? (message as { result?: string }).result : null;
          if (textResult) {
            result = { outputType: 'message', userMessage: textResult };
          }
        }
      }
    }

    log('Agent completed successfully');
    return {
      requestId: input.requestId,
      status: 'success',
      result: result ?? { outputType: 'log' },
      newSessionId,
      model
    };

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Agent error: ${errorMessage}`);
    return {
      requestId: input.requestId,
      status: 'error',
      result: null,
      newSessionId,
      model,
      error: errorMessage
    };
  }
}

/**
 * Write a response file atomically.
 */
function writeResponse(requestId: string, output: ContainerOutput): void {
  const filename = `${requestId}.json`;
  const responsePath = path.join(RESPONSES_DIR, filename);
  const tempPath = responsePath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(output));
  fs.renameSync(tempPath, responsePath);
}

/**
 * Main event loop — polls for request files and processes them.
 */
async function runLoop(): Promise<void> {
  fs.mkdirSync(REQUESTS_DIR, { recursive: true });
  fs.mkdirSync(RESPONSES_DIR, { recursive: true });

  let shuttingDown = false;
  let processing = false;

  process.on('SIGTERM', () => {
    log('SIGTERM received, will exit after current request');
    shuttingDown = true;
    if (!processing) {
      log('No request in progress, exiting now');
      process.exit(0);
    }
  });

  // Signal readiness to host
  fs.writeFileSync(READY_FILE, new Date().toISOString());
  log('Container ready, polling for requests');

  while (!shuttingDown) {
    let files: string[];
    try {
      files = fs.readdirSync(REQUESTS_DIR)
        .filter(f => f.endsWith('.json') && !f.startsWith('.'))
        .sort();
    } catch {
      await sleep(100);
      continue;
    }

    if (files.length === 0) {
      await sleep(100);
      continue;
    }

    const filename = files[0];
    const requestPath = path.join(REQUESTS_DIR, filename);
    const inProgressPath = requestPath + '.inprogress';

    // Claim the request with atomic rename
    try {
      fs.renameSync(requestPath, inProgressPath);
    } catch {
      await sleep(50);
      continue;
    }

    let input: ContainerInput;
    try {
      input = JSON.parse(fs.readFileSync(inProgressPath, 'utf-8'));
    } catch (err) {
      log(`Failed to parse request ${filename}: ${err}`);
      fs.unlinkSync(inProgressPath);
      continue;
    }

    // Handle shutdown request
    if (input.type === 'shutdown') {
      log('Shutdown request received');
      fs.unlinkSync(inProgressPath);
      break;
    }

    processing = true;
    const output = await processRequest(input);
    writeResponse(input.requestId, output);

    // Clean up in-progress file
    try { fs.unlinkSync(inProgressPath); } catch { /* already cleaned */ }
    processing = false;
  }

  log('Container loop exited cleanly');
  process.exit(0);
}

runLoop();
