/**
 * NanoClaw CLI
 * Talk to the agent directly from the command line.
 * Uses the same persistent container and session as WhatsApp.
 *
 * Usage:
 *   npm run cli "what's my workout today?"   # one-shot
 *   npm run cli                               # interactive REPL
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

import { ASSISTANT_NAME, CONTAINER_TIMEOUT, DATA_DIR } from './config.js';
import { initDatabase, getSession, setSession } from './db.js';

const GROUP_FOLDER = 'main';
const IPC_DIR = path.join(DATA_DIR, 'ipc', GROUP_FOLDER);
const REQUESTS_DIR = path.join(IPC_DIR, 'requests');
const RESPONSES_DIR = path.join(IPC_DIR, 'responses');
const READY_FILE = path.join(IPC_DIR, 'ready');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkContainerReady(): boolean {
  return fs.existsSync(READY_FILE);
}

async function sendMessage(prompt: string): Promise<string> {
  if (!checkContainerReady()) {
    return '[error] Persistent container is not running. Start NanoClaw first: launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist';
  }

  fs.mkdirSync(REQUESTS_DIR, { recursive: true });
  fs.mkdirSync(RESPONSES_DIR, { recursive: true });

  const requestId = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${requestId}.json`;
  const sessionId = getSession(GROUP_FOLDER);

  const request = {
    requestId,
    prompt: `<messages>\n<message sender="User (CLI)" time="${new Date().toISOString()}">${prompt}</message>\n</messages>\n\n[IMPORTANT: This message is from the CLI, not WhatsApp. Do NOT use the send_message tool. Instead, put your response in the userMessage output field with outputType "message".]`,
    sessionId,
    groupFolder: GROUP_FOLDER,
    chatJid: 'cli@local',
    isMain: true,
  };

  // Atomic write
  const requestPath = path.join(REQUESTS_DIR, filename);
  const tempPath = requestPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(request));
  fs.renameSync(tempPath, requestPath);

  // Poll for response
  const responsePath = path.join(RESPONSES_DIR, filename);
  const start = Date.now();

  while (Date.now() - start < CONTAINER_TIMEOUT) {
    if (fs.existsSync(responsePath)) {
      const raw = fs.readFileSync(responsePath, 'utf-8');
      fs.unlinkSync(responsePath);

      const output = JSON.parse(raw);

      // Update session for continuity
      if (output.newSessionId) {
        setSession(GROUP_FOLDER, output.newSessionId);
      }

      if (output.status === 'error') {
        return `[error] ${output.error}`;
      }

      if (output.result?.outputType === 'message' && output.result?.userMessage) {
        const modelLabel = output.model
          ? ` [${output.model.replace('claude-', '').replace(/-\d.*$/, '')}]`
          : '';
        return `${ASSISTANT_NAME}${modelLabel}: ${output.result.userMessage}`;
      }

      return '[no response — agent logged internally]';
    }

    await sleep(250);
  }

  return '[error] Request timed out';
}

async function interactiveMode(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`NanoClaw CLI — talking to ${ASSISTANT_NAME} (main group)`);
  console.log('Type your message, or Ctrl+C to exit.\n');

  const ask = (): void => {
    rl.question('> ', async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        ask();
        return;
      }

      const response = await sendMessage(trimmed);
      console.log(response);
      console.log();
      ask();
    });
  };

  ask();
}

async function main(): Promise<void> {
  initDatabase();

  const args = process.argv.slice(2);

  if (args.length > 0) {
    // One-shot mode
    const prompt = args.join(' ');
    const response = await sendMessage(prompt);
    console.log(response);
  } else {
    // Interactive REPL
    await interactiveMode();
  }
}

main().catch((err) => {
  console.error('CLI error:', err);
  process.exit(1);
});
