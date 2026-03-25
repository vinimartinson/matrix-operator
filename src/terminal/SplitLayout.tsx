'use client';

import OperatorPanel from './OperatorPanel';
import AgentCommPanel from './AgentCommPanel';

interface SplitLayoutProps {
  onCommand: (command: string) => void;
}

export default function SplitLayout({ onCommand }: SplitLayoutProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Left: Operator console + live map */}
      <OperatorPanel onCommand={onCommand} />

      {/* Right: Agent comm channels */}
      <div
        style={{
          flex: '0 0 40%',
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <AgentCommPanel />
      </div>
    </div>
  );
}
