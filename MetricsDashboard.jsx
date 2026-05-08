import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

// Extracted constants to prevent re-renders
const tickStyle = { fill: '#71717A', fontSize: 10 };
const tooltipContentStyle = { 
  backgroundColor: '#0F0F0F', 
  border: '1px solid #27272A',
  borderRadius: '4px',
  fontFamily: 'JetBrains Mono, monospace'
};

const MetricsDashboard = ({ metrics }) => {
  const {
    start_activities,
    end_activities,
    activity_frequency,
    case_duration,
    total_cases,
    total_events,
    unique_activities,
  } = metrics;

  const topActivities = activity_frequency.slice(0, 10);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Metrics <span className="text-lime-200">Proses Bisnis</span>
        </h2>
        <p className="text-xs font-mono text-zinc-500">Hasil Analisis Alpha Miner</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-col p-4 bg-[#0F0F0F] border-l-4 border-lime-200">
          <span className="text-xs font-mono uppercase text-zinc-500 mb-1">Total Cases</span>
          <span className="text-3xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {total_cases}
          </span>
        </div>

        <div className="flex flex-col p-4 bg-[#0F0F0F] border-l-4 border-zinc-800">
          <span className="text-xs font-mono uppercase text-zinc-500 mb-1">Total Events</span>
          <span className="text-3xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {total_events}
          </span>
        </div>

        <div className="flex flex-col p-4 bg-[#0F0F0F] border-l-4 border-zinc-800">
          <span className="text-xs font-mono uppercase text-zinc-500 mb-1">Unique Activities</span>
          <span className="text-3xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {unique_activities}
          </span>
        </div>
      </div>

      <div className="bg-[#0F0F0F] border border-zinc-800/50 p-4">
        <h3 className="text-sm font-mono uppercase text-zinc-500 mb-4">Case Duration (Hours)</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-zinc-500">Min:</span>
            <span className="text-white ml-2 font-mono">{case_duration.min.toFixed(2)}h</span>
          </div>
          <div>
            <span className="text-zinc-500">Max:</span>
            <span className="text-white ml-2 font-mono">{case_duration.max.toFixed(2)}h</span>
          </div>
          <div>
            <span className="text-zinc-500">Avg:</span>
            <span className="text-white ml-2 font-mono">{case_duration.avg.toFixed(2)}h</span>
          </div>
          <div>
            <span className="text-zinc-500">Median:</span>
            <span className="text-white ml-2 font-mono">{case_duration.median.toFixed(2)}h</span>
          </div>
        </div>
      </div>

      <div className="bg-[#0F0F0F] border border-zinc-800/50 p-4">
        <h3 className="text-sm font-mono uppercase text-zinc-500 mb-4">Start Activities</h3>
        <div className="space-y-2">
          {start_activities.slice(0, 5).map((item) => (
            <div key={`start-${item.activity}`} className="flex justify-between items-center text-sm">
              <span className="text-zinc-400 truncate max-w-[200px]">{item.activity}</span>
              <span className="text-lime-200 font-mono font-bold">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#0F0F0F] border border-zinc-800/50 p-4">
        <h3 className="text-sm font-mono uppercase text-zinc-500 mb-4">End Activities</h3>
        <div className="space-y-2">
          {end_activities.slice(0, 5).map((item) => (
            <div key={`end-${item.activity}`} className="flex justify-between items-center text-sm">
              <span className="text-zinc-400 truncate max-w-[200px]">{item.activity}</span>
              <span className="text-red-400 font-mono font-bold">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#0F0F0F] border border-zinc-800/50 p-4">
        <h3 className="text-sm font-mono uppercase text-zinc-500 mb-4">Top 10 Activities by Frequency</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topActivities}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
            <XAxis 
              dataKey="activity" 
              angle={-45} 
              textAnchor="end" 
              height={100}
              tick={tickStyle}
            />
            <YAxis tick={tickStyle} />
            <Tooltip contentStyle={tooltipContentStyle} />
            <Bar dataKey="count" fill="#D9F99D" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MetricsDashboard;