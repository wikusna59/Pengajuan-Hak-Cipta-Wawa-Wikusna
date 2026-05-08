import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, MarkerType } from 'reactflow';
import dagre from 'dagre';
import { X } from 'lucide-react';
import PlaceNode from './nodes/PlaceNode';
import TransitionNode from './nodes/TransitionNode';

const nodeTypes = {
  place: PlaceNode,
  transition: TransitionNode,
};

// ReactFlow pro options moved outside component to prevent re-renders
const reactFlowProOptions = { hideAttribution: true };

const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: node.type === 'place' ? 80 : 150, height: node.type === 'place' ? 80 : 60 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - (node.type === 'place' ? 40 : 75),
      y: nodeWithPosition.y - (node.type === 'place' ? 40 : 30),
    };
  });

  return { nodes, edges };
};

const PetriNetPreviewModal = ({ petriNet, title, numCases, onClose, metrics }) => {
  const { nodes, edges } = useMemo(() => {
    const flowNodes = [
      ...petriNet.places.map((place) => ({
        id: place.id,
        type: 'place',
        data: { 
          label: place.label, 
          isStart: place.isStart, 
          isEnd: place.isEnd,
          tokens: place.tokens
        },
        position: { x: 0, y: 0 },
      })),
      ...petriNet.transitions.map((transition) => ({
        id: transition.id,
        type: 'transition',
        data: { 
          label: transition.label,
          isSilent: transition.isSilent
        },
        position: { x: 0, y: 0 },
      })),
    ];

    const flowEdges = petriNet.arcs.map((arc) => ({
      id: arc.id,
      source: arc.source,
      target: arc.target,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#71717A', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#71717A',
      },
    }));

    return getLayoutedElements(flowNodes, flowEdges);
  }, [petriNet]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col border-2 border-gray-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-gray-300 bg-gradient-to-r from-emerald-50 to-lime-50">
          <div>
            <h2 className="text-2xl font-bold text-zinc-800 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              {title}
            </h2>
            <p className="text-sm text-zinc-600">
              {numCases} cases • {petriNet.places.length} places • {petriNet.transitions.length} transitions
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-zinc-800 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Petri Net Visualization */}
          <div className="flex-1 bg-gray-50">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              proOptions={reactFlowProOptions}
              zoomOnScroll={true}
              panOnDrag={true}
              nodesDraggable={false}
              nodesConnectable={false}
              minZoom={0.1}
              maxZoom={4}
            >
              <Background color="#d1d5db" gap={48} style={{ backgroundColor: '#f9fafb' }} />
              <Controls className="bg-white border-2 border-gray-300 rounded-lg shadow-lg" />
              <MiniMap 
                nodeColor={(node) => {
                  if (node.type === 'place') return '#10b981';
                  if (node.type === 'transition') return '#84cc16';
                  return '#71717A';
                }}
                maskColor="rgba(255, 255, 255, 0.8)"
                className="bg-white border-2 border-gray-300"
              />
            </ReactFlow>
          </div>

          {/* Sidebar with metrics */}
          {metrics && (
            <div className="w-80 bg-gray-50 border-l-2 border-gray-300 overflow-y-auto p-6">
              <h3 className="text-lg font-bold text-zinc-800 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Statistik Cluster
              </h3>

              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200 shadow-sm">
                  <div className="text-xs text-zinc-600 uppercase font-semibold mb-1">Total Events</div>
                  <div className="text-2xl font-bold text-zinc-800">{metrics.total_events}</div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200 shadow-sm">
                  <div className="text-xs text-zinc-600 uppercase font-semibold mb-1">Unique Activities</div>
                  <div className="text-2xl font-bold text-zinc-800">{metrics.unique_activities}</div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200 shadow-sm">
                  <div className="text-xs text-zinc-600 uppercase font-semibold mb-2">Top 5 Activities</div>
                  <div className="space-y-2">
                    {metrics.activity_frequency.slice(0, 5).map((act) => (
                      <div key={`activity-${act.activity}`} className="flex justify-between text-sm">
                        <span className="text-zinc-700 truncate max-w-[180px]">{act.activity}</span>
                        <span className="text-emerald-600 font-bold">{act.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {metrics.case_duration && (
                  <div className="bg-white rounded-lg p-4 border-2 border-gray-200 shadow-sm">
                    <div className="text-xs text-zinc-600 uppercase font-semibold mb-2">Case Duration (Hours)</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-zinc-600">Avg:</span>
                        <span className="text-zinc-800 ml-2 font-mono font-bold">{metrics.case_duration.avg.toFixed(2)}h</span>
                      </div>
                      <div>
                        <span className="text-zinc-600">Max:</span>
                        <span className="text-zinc-800 ml-2 font-mono font-bold">{metrics.case_duration.max.toFixed(2)}h</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PetriNetPreviewModal;
