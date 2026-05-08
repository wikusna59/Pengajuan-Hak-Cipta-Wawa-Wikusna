import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import dagre from 'dagre';
import { Maximize2, Users, DollarSign, Clock } from 'lucide-react';
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
  dagreGraph.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 60 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: node.type === 'place' ? 60 : 120, height: node.type === 'place' ? 60 : 50 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - (node.type === 'place' ? 30 : 60),
      y: nodeWithPosition.y - (node.type === 'place' ? 30 : 25),
    };
  });

  return { nodes, edges };
};

const ClusteredPetriNetView = ({ petriNet, title, numCases, isOriginal = false, onPreview, businessAnalysis }) => {
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
      style: { stroke: '#71717A', strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#71717A',
      },
    }));

    return getLayoutedElements(flowNodes, flowEdges);
  }, [petriNet]);

  // Format number with thousand separator
  const formatNumber = (num) => {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString('id-ID');
  };

  // Format currency
  const formatCurrency = (num) => {
    if (num === undefined || num === null) return '-';
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  // Format duration (assume in minutes, convert to days/hours/minutes)
  const formatDuration = (num) => {
    if (num === undefined || num === null || num === 0) return '-';
    if (num >= 1440) { // More than 24 hours in minutes
      const days = Math.floor(num / 1440);
      const hours = Math.floor((num % 1440) / 60);
      return `${days.toLocaleString('id-ID')} hari ${hours} jam`;
    } else if (num >= 60) {
      const hours = Math.floor(num / 60);
      const mins = Math.round(num % 60);
      return `${hours.toLocaleString('id-ID')} jam ${mins} menit`;
    }
    return `${Math.round(num).toLocaleString('id-ID')} menit`;
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden relative group shadow-md hover:shadow-xl transition-shadow">
      <div className={`p-4 border-b-2 border-gray-300 ${isOriginal ? 'bg-gradient-to-r from-gray-100 to-gray-50' : 'bg-gradient-to-r from-emerald-50 to-lime-50'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-800" style={{ fontFamily: 'Syne, sans-serif' }}>
              {title}
            </h3>
            {numCases && (
              <p className="text-sm text-zinc-600 mt-1">
                {numCases} cases • {petriNet.places.length} places • {petriNet.transitions.length} transitions
              </p>
            )}
          </div>
          {!isOriginal && onPreview && (
            <button
              onClick={onPreview}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-100 hover:bg-emerald-200 border-2 border-emerald-300 text-emerald-700 rounded-lg transition-all text-sm font-medium shadow-sm"
            >
              <Maximize2 className="w-4 h-4" />
              Preview
            </button>
          )}
        </div>
        
        {/* Business Analysis Info */}
        {businessAnalysis && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-zinc-500 mb-2 font-medium">
              {isOriginal ? 'Analisis Seluruh Proses Bisnis:' : 'Analisis Proses Bisnis Klaster Ini:'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-blue-600 font-medium">Total Pegawai</p>
                  <p className="text-sm font-bold text-blue-800 truncate" title={formatNumber(businessAnalysis.total_employees)}>
                    {formatNumber(businessAnalysis.total_employees)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                <DollarSign className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-green-600 font-medium">Total Biaya</p>
                  <p className="text-sm font-bold text-green-800 truncate" title={formatCurrency(businessAnalysis.total_cost)}>
                    {formatCurrency(businessAnalysis.total_cost)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                <Clock className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-orange-600 font-medium">Total Durasi</p>
                  <p className="text-sm font-bold text-orange-800 truncate" title={formatDuration(businessAnalysis.total_duration)}>
                    {formatDuration(businessAnalysis.total_duration)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="h-[400px] bg-gray-50 relative">
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
          elementsSelectable={true}
          minZoom={0.1}
          maxZoom={4}
        >
          <Background color="#d1d5db" gap={32} style={{ backgroundColor: '#f9fafb' }} />
          <Controls 
            className="bg-white border-2 border-gray-300 rounded-lg shadow-lg"
            showInteractive={false}
          />
        </ReactFlow>
      </div>
    </div>
  );
};

export default ClusteredPetriNetView;
