import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

// Helper function to get border and background classes
const getPlaceStyles = (isStart, isEnd) => {
  if (isStart) {
    return {
      className: 'border-blue-900 bg-blue-50',
      boxShadow: '0 0 15px rgba(30, 58, 138, 0.4)'
    };
  }
  if (isEnd) {
    return {
      className: 'border-red-600 bg-red-50',
      boxShadow: '0 0 15px rgba(220, 38, 38, 0.3)'
    };
  }
  return {
    className: 'border-zinc-700 bg-white',
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)'
  };
};

const PlaceNode = memo(({ data }) => {
  const { label, isStart, isEnd, tokens } = data;
  const styles = getPlaceStyles(isStart, isEnd);

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#71717A', border: 'none', width: 8, height: 8 }}
      />
      
      <div
        className={`w-20 h-20 rounded-full border-2 flex items-center justify-center relative ${styles.className}`}
        style={{ boxShadow: styles.boxShadow }}
      >
        {tokens > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
          </div>
        )}
        
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <span 
            className="text-xs text-zinc-600 font-medium" 
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {label}
          </span>
        </div>
        
        {isStart && (
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            <span className="text-xs uppercase text-blue-900 font-bold tracking-wide">START</span>
          </div>
        )}
        
        {isEnd && (
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            <span className="text-xs uppercase text-red-600 font-bold tracking-wide">END</span>
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#71717A', border: 'none', width: 8, height: 8 }}
      />
    </div>
  );
});

PlaceNode.displayName = 'PlaceNode';

export default PlaceNode;