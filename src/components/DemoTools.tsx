'use client';

import JoinQR from './JoinQR';
import SimulateButton from './SimulateButton';
import ResetButton from './ResetButton';

interface DemoToolsProps {
  onChanged: () => void;
  rollCallActive: boolean;
}

export function DemoTools({ onChanged, rollCallActive }: DemoToolsProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">Demo tools</h2>
      <JoinQR />
      <div className="flex flex-wrap items-start gap-3">
        <SimulateButton disabled={!rollCallActive} onChanged={onChanged} />
        <ResetButton onChanged={onChanged} />
      </div>
    </div>
  );
}

export default DemoTools;
