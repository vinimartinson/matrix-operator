'use client';

import LiveMapView from './LiveMapView';
import Terminal from './Terminal';

interface OperatorPanelProps {
  onCommand: (command: string) => void;
}

export default function OperatorPanel({ onCommand }: OperatorPanelProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        flex: '0 0 60%',
        minWidth: 0,
      }}
    >
      {/* Live map — top portion, only shown during missions */}
      <LiveMapView />

      {/* Operator terminal — fills remaining space */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Terminal onCommand={onCommand} />
      </div>
    </div>
  );
}
