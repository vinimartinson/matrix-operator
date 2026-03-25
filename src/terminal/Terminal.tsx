'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { useGameStore } from '@/engine/game-state';
import type { GameStateSlice, TerminalLine } from '@/engine/types';

interface TerminalProps {
  onCommand: (command: string) => void;
}

const CLASS_STYLES: Record<string, React.CSSProperties> = {
  error: { color: 'var(--red)' },
  success: { color: 'var(--green)' },
  warning: { color: 'var(--yellow)' },
  cyan: { color: 'var(--cyan)' },
  dim: { color: '#666' },
  system: { color: 'var(--green-dim)', opacity: 0.8 },
  smith: { color: 'var(--red)', textShadow: '0 0 8px var(--red), 0 0 16px rgba(255,51,51,0.3)' },
  critical: { color: 'var(--red)' },
};

const CLASS_NAMES: Record<string, string> = {
  critical: 'alert-flash',
};

const QUICK_COMMANDS = ['scan', 'map', 'status', 'threat', 'help'];

export default function Terminal({ onCommand }: TerminalProps) {
  const terminalLines = useGameStore((s: GameStateSlice) => s.terminalLines);
  const inputEnabled = useGameStore((s: GameStateSlice) => s.inputEnabled);

  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [completions, setCompletions] = useState<string[]>([]);
  const [completionIndex, setCompletionIndex] = useState(0);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    const el = outputRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [terminalLines.length]);

  // Click anywhere to focus input
  const handleContainerClick = useCallback(() => {
    if (inputEnabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputEnabled]);

  const submitCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;

      setHistory((prev) => {
        const next = prev.filter((h) => h !== trimmed);
        next.push(trimmed);
        if (next.length > 100) next.shift();
        return next;
      });
      setHistoryIndex(-1);
      setInput('');
      setCompletions([]);
      onCommand(trimmed);
    },
    [onCommand],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Tab completion
      if (e.key === 'Tab') {
        e.preventDefault();
        if (completions.length > 0) {
          const next = completions[completionIndex % completions.length];
          setInput(next + ' ');
          setCompletionIndex((i) => i + 1);
        } else if (input.trim()) {
          // Generate completions from known commands
          const partial = input.trim().toLowerCase();
          const allCommands = [
            'help', 'scan', 'map', 'status', 'threat', 'move',
            'hack', 'call', 'jack', 'deploy', 'emp', 'repair',
            'divert', 'comms', 'clear', 'save', 'brief', 'objectives',
            'neo', 'trinity', 'morpheus', 'niobe', 'ghost',
          ];
          const matches = allCommands.filter((c) => c.startsWith(partial));
          if (matches.length === 1) {
            setInput(matches[0] + ' ');
          } else if (matches.length > 1) {
            setCompletions(matches);
            setCompletionIndex(0);
          }
        }
        return;
      }

      // Clear completions on any non-tab key
      if (completions.length > 0) {
        setCompletions([]);
        setCompletionIndex(0);
      }

      // Command history navigation
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (history.length === 0) return;
        const newIndex =
          historyIndex === -1
            ? history.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex === -1) return;
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
        return;
      }

      // Submit
      if (e.key === 'Enter') {
        submitCommand(input);
        return;
      }
    },
    [input, history, historyIndex, completions, completionIndex, submitCommand],
  );

  const renderLine = (line: { text: string; className?: string | undefined }, index: number) => {
    const style = line.className ? CLASS_STYLES[line.className] ?? {} : {};
    const extraClass = line.className ? CLASS_NAMES[line.className] ?? '' : '';
    const isHtml = /<(span|div|b|i|em|strong|br)\b/i.test(line.text);

    return (
      <div
        key={index}
        className={`leading-relaxed whitespace-pre-wrap break-all ${extraClass}`}
        style={{ ...style, minHeight: '1.4em' }}
        {...(isHtml
          ? { dangerouslySetInnerHTML: { __html: line.text } }
          : { children: line.text || '\u00A0' })}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full w-full"
      style={{ zIndex: 10, position: 'relative' }}
      onClick={handleContainerClick}
    >
      {/* Output area */}
      <div
        ref={outputRef}
        className="terminal-output flex-1 overflow-y-auto px-4 py-2"
        style={{
          background: 'var(--bg-translucent)',
          color: 'var(--green)',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          fontSize: '14px',
        }}
      >
        {terminalLines.map((line: TerminalLine, i: number) => renderLine(line, i))}
      </div>

      {/* Tab completion suggestions */}
      {completions.length > 1 && (
        <div
          className="px-4 py-1 text-xs"
          style={{
            background: 'rgba(0, 20, 0, 0.9)',
            color: 'var(--green-dim)',
            borderTop: '1px solid var(--green-dark)',
          }}
        >
          {completions.join('  ')}
        </div>
      )}

      {/* Input line */}
      <div
        className="flex items-center px-4 py-2 shrink-0"
        style={{
          background: 'rgba(0, 10, 0, 0.95)',
          borderTop: '1px solid var(--green-dark)',
        }}
      >
        <span
          className="mr-2 select-none whitespace-nowrap"
          style={{ color: 'var(--prompt-color)' }}
        >
          operator@neb:~$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!inputEnabled}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          className="flex-1 bg-transparent outline-none border-none"
          style={{
            color: 'var(--green)',
            caretColor: 'var(--green)',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            fontSize: '14px',
            opacity: inputEnabled ? 1 : 0.4,
          }}
          aria-label="Terminal input"
        />
        {inputEnabled && (
          <span
            className="cursor-blink ml-0 select-none"
            style={{ color: 'var(--green)', fontSize: '14px' }}
          >
            _
          </span>
        )}
      </div>

      {/* Mobile quick-command buttons */}
      <div
        className="flex sm:hidden gap-2 px-4 py-2 overflow-x-auto shrink-0"
        style={{
          background: 'rgba(0, 10, 0, 0.95)',
          borderTop: '1px solid var(--green-dark)',
        }}
      >
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            onClick={() => {
              if (inputEnabled) submitCommand(cmd);
            }}
            disabled={!inputEnabled}
            className="px-3 py-1 text-xs rounded whitespace-nowrap"
            style={{
              background: 'var(--green-dark)',
              color: 'var(--green)',
              border: '1px solid var(--green-dim)',
              cursor: inputEnabled ? 'pointer' : 'not-allowed',
              opacity: inputEnabled ? 1 : 0.4,
            }}
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
}
