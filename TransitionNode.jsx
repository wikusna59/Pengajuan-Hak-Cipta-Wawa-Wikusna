import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const TransitionNode = memo(({ data }) => {
  const { label, isSilent } = data;

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#71717A', border: 'none', width: 8, height: 8 }}
      />
      
      <div
        className={`px-4 py-3 rounded-sm flex items-center justify-center ${
          isSilent ? 'bg-zinc-700 border border-zinc-600 text-zinc-400' : 'bg-lime-400 border border-lime-300 text-black'
        }`}
        style={{ 
          boxShadow: isSilent ? 'none' : '4px 4px 0px rgba(0, 0, 0, 1)',
          minWidth: '120px',
          maxWidth: '200px'
        }}
      >
        <span 
          className="font-bold uppercase tracking-wider text-xs text-center" 
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {label || 'τ'}
        </span>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#71717A', border: 'none', width: 8, height: 8 }}
      />
    </div>
  );
});

TransitionNode.displayName = 'TransitionNode';

export default TransitionNode;