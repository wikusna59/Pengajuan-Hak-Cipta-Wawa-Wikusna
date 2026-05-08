import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { toast } from 'sonner';
import { ArrowLeft, BarChart3, GitBranch, Trophy, Users, DollarSign, Clock, Award } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import PlaceNode from '../components/nodes/PlaceNode';
import TransitionNode from '../components/nodes/TransitionNode';
import MetricsDashboard from '../components/MetricsDashboard';
import ClusteredPetriNetView from '../components/ClusteredPetriNetView';
import PetriNetPreviewModal from '../components/PetriNetPreviewModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const nodeTypes = {
  place: PlaceNode,
  transition: TransitionNode,
};

// ReactFlow pro options moved outside component to prevent re-renders
const reactFlowProOptions = { hideAttribution: true };

const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', ranksep: 150, nodesep: 80 });

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

const ProcessViewer = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showClusterPanel, setShowClusterPanel] = useState(false);
  const [numClusters, setNumClusters] = useState(3);
  const [clusterAlgorithm, setClusterAlgorithm] = useState('kmeans');
  const [clustering, setClustering] = useState(false);
  const [clusterResults, setClusterResults] = useState(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [previewCluster, setPreviewCluster] = useState(null);

  // Hide ReactFlow attribution aggressively with CSS injection
  useEffect(() => {
    // Inject additional CSS to cover attribution using textContent (XSS-safe)
    const style = document.createElement('style');
    style.textContent = `
      .react-flow__panel.bottom,
      .react-flow__attribution,
      a[href*="reactflow"],
      a[href*="emergent"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }
      
      /* White overlay at bottom right */
      .react-flow__renderer {
        position: relative;
      }
      
      .react-flow__renderer::after {
        content: '';
        position: absolute;
        bottom: 0;
        right: 0;
        width: 220px;
        height: 50px;
        background: #f9fafb;
        z-index: 9999;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
    
    const hideAttribution = () => {
      // Try multiple selectors
      const selectors = [
        '.react-flow__attribution',
        'a[href*="reactflow"]',
        '[class*="attribution"]',
        '.react-flow__panel.react-flow__attribution',
        'div[style*="position"][style*="bottom"][style*="right"]'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el && el.textContent && (el.textContent.includes('Made with') || el.textContent.includes('Emergent'))) {
            el.remove();
          } else if (el) {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
          }
        });
      });
      
      // Also check for any small divs at bottom right
      const allDivs = document.querySelectorAll('div');
      allDivs.forEach(div => {
        const style = window.getComputedStyle(div);
        const position = style.position;
        const bottom = style.bottom;
        const right = style.right;
        
        if (div.textContent && (div.textContent.includes('Made with') || div.textContent.includes('Emergent'))) {
          div.remove();
        }
      });
    };
    
    hideAttribution();
    
    // Run periodically
    const interval = setInterval(hideAttribution, 200);
    
    // Also observe DOM changes
    const observer = new MutationObserver(hideAttribution);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => {
      clearInterval(interval);
      observer.disconnect();
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [petriNetResponse, metricsResponse] = await Promise.all([
          axios.get(`${API}/petri-net/${resultId}`),
          axios.get(`${API}/metrics/${resultId}`),
        ]);

        const petriNet = petriNetResponse.data;
        const metricsData = metricsResponse.data;

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

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          flowNodes,
          flowEdges
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setMetrics(metricsData);
        setLoading(false);
        
        // Hide attribution after render
        setTimeout(() => {
          const attribution = document.querySelector('.react-flow__attribution');
          if (attribution) {
            attribution.style.display = 'none';
          }
        }, 100);
      } catch (error) {
        toast.error('Failed to load process mining results');
        setLoading(false);
      }
    };

    if (resultId) {
      fetchData();
    }
  }, [resultId, setNodes, setEdges]);

  const handleExportPNG = useCallback(() => {
    toast.info('PNG export feature coming soon!');
  }, []);

  const handleExportJSON = useCallback(() => {
    const data = {
      nodes: nodes,
      edges: edges,
      metrics: metrics,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `process-mining-${resultId}.json`;
    link.href = url;
    link.click();
    toast.success('Data exported as JSON');
  }, [nodes, edges, metrics, resultId]);

  const handleClustering = useCallback(async () => {
    if (!numClusters || numClusters < 2) {
      toast.error('Jumlah klaster minimal 2');
      return;
    }
    
    setClustering(true);
    try {
      const response = await axios.post(`${API}/cluster/${resultId}?num_clusters=${numClusters}&algorithm=${clusterAlgorithm}`);
      const clusteringData = response.data;
      
      setClusterResults(clusteringData);
      setShowClusterPanel(false); // Close panel after success
      toast.success(`Proses berhasil diklaster menjadi ${clusteringData.clusters.length} kelompok menggunakan ${clusteringData.algorithm}`);
      setClustering(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal melakukan klasterisasi');
      setClustering(false);
    }
  }, [numClusters, clusterAlgorithm, resultId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-lime-200 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400" style={{ fontFamily: 'Manrope, sans-serif' }}>Loading Petri Net...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gradient-to-r from-white via-gray-50 to-white border-b-2 border-gray-300 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/')}
              className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-zinc-700 hover:text-zinc-900 transition-all border-2 border-gray-300"
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-800" style={{ fontFamily: 'Syne, sans-serif' }}>
                Visualisasi <span className="bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">Petri Net</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowClusterPanel(!showClusterPanel)}
              className="bg-gradient-to-r from-emerald-100 to-lime-100 border-2 border-emerald-300 text-emerald-700 hover:from-emerald-200 hover:to-lime-200 transition-all rounded-full px-5 py-2.5 font-medium text-sm shadow-md"
              data-testid="toggle-cluster-button"
            >
              <GitBranch className="w-4 h-4 mr-2" />
              Klasterisasi Proses
            </Button>
            <Button
              onClick={() => setShowMetrics(!showMetrics)}
              className="bg-white border-2 border-gray-300 text-zinc-700 hover:bg-gray-50 transition-all rounded-full px-5 py-2.5 font-medium text-sm shadow-md"
              data-testid="toggle-metrics-button"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              {showMetrics ? 'Sembunyikan' : 'Tampilkan'} Metrics
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <div className={`flex-1 bg-gray-50 relative ${showMetrics ? 'w-2/3' : 'w-full'}`}>
          {/* Clustering Panel */}
          {showClusterPanel && (
            <div className="absolute top-4 left-4 z-10 bg-white backdrop-blur-xl rounded-2xl shadow-2xl p-6 border-2 border-emerald-200 w-96">
              <h3 className="text-lg font-bold text-zinc-800 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                Klasterisasi Proses
              </h3>
              <p className="text-sm text-zinc-600 mb-4">
                Kelompokkan model Petri Net berdasarkan karakteristik proses
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Algoritma Klasterisasi
                  </label>
                  <select
                    value={clusterAlgorithm}
                    onChange={(e) => setClusterAlgorithm(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-zinc-300 rounded-lg focus:border-emerald-500 focus:outline-none text-zinc-800 bg-white cursor-pointer"
                    data-testid="algorithm-select"
                  >
                    <option value="kmeans">K-Means Clustering</option>
                    <option value="markov">Markov Cluster (MCL)</option>
                  </select>
                  <p className="text-xs text-zinc-500 mt-1">
                    {clusterAlgorithm === 'kmeans' 
                      ? 'Algoritma berbasis centroid untuk pengelompokan data' 
                      : 'Algoritma berbasis graf untuk deteksi komunitas'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Jumlah Klaster
                  </label>
                  <Input
                    type="number"
                    min="2"
                    max="10"
                    value={numClusters}
                    onChange={(e) => setNumClusters(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border-2 border-zinc-300 rounded-lg focus:border-emerald-500 focus:outline-none text-zinc-800"
                    placeholder="Masukkan jumlah klaster (2-10)"
                    data-testid="cluster-input"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Minimal 2, maksimal 10 klaster</p>
                </div>
                
                <div className="flex gap-3">
                  <Button
                    onClick={handleClustering}
                    disabled={clustering || !numClusters || numClusters < 2}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-lime-500 text-white font-bold hover:from-emerald-600 hover:to-lime-600 transition-all rounded-lg px-4 py-3 shadow-lg disabled:opacity-50"
                    data-testid="cluster-button"
                  >
                    {clustering ? 'Memproses...' : 'Mulai Klasterisasi'}
                  </Button>
                  <Button
                    onClick={() => setShowClusterPanel(false)}
                    className="px-4 py-3 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-all rounded-lg border border-zinc-300"
                  >
                    Tutup
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            proOptions={reactFlowProOptions}
            className="bg-white"
            zoomOnScroll={true}
            panOnDrag={true}
            minZoom={0.1}
            maxZoom={4}
          >
            <Background color="#e5e7eb" gap={64} style={{ backgroundColor: '#f9fafb' }} />
            <Controls className="bg-white border-2 border-zinc-300 rounded-lg shadow-lg" />
            <MiniMap 
              nodeColor={(node) => {
                if (node.type === 'place') return '#10b981';
                if (node.type === 'transition') return '#84cc16';
                return '#71717A';
              }}
              maskColor="rgba(255, 255, 255, 0.8)"
              className="bg-white border-2 border-zinc-300"
            />
          </ReactFlow>
        </div>

        {showMetrics && metrics && (
          <div className="w-1/3 bg-black/50 backdrop-blur-xl border-l border-zinc-800 overflow-y-auto">
            <MetricsDashboard metrics={metrics} />
          </div>
        )}
      </div>

      {/* Clustered Results Section */}
      {clusterResults && (
        <div className="bg-gradient-to-b from-gray-50 to-white p-8 border-t border-gray-300">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-zinc-800 mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                Hasil <span className="bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">Klasterisasi</span>
              </h2>
              <p className="text-zinc-600">
                Proses bisnis diklaster menjadi {clusterResults.clusters.length} kelompok menggunakan algoritma <span className="font-semibold text-emerald-600">{clusterResults.algorithm || 'K-Means'}</span>
              </p>
            </div>

            {/* Original Petri Net */}
            <div className="mb-8">
              <ClusteredPetriNetView
                petriNet={clusterResults.original_petri_net}
                title="Petri Net Original (Semua Proses)"
                numCases={clusterResults.original_metrics.total_cases}
                isOriginal={true}
                businessAnalysis={clusterResults.original_business_analysis}
              />
            </div>

            {/* Clustered Petri Nets */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {clusterResults.clusters.map((cluster) => (
                <ClusteredPetriNetView
                  key={cluster.cluster_id}
                  petriNet={cluster.petri_net}
                  title={cluster.cluster_name}
                  numCases={cluster.num_cases}
                  isOriginal={false}
                  onPreview={() => setPreviewCluster(cluster)}
                  businessAnalysis={cluster.business_analysis}
                />
              ))}
            </div>

            {/* Optimal Cluster Analysis using NSGA-II */}
            {clusterResults.clusters.length > 1 && (
              <div className="mt-10 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-2xl border-2 border-amber-300 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-amber-100 rounded-xl border-2 border-amber-300">
                    <Trophy className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-800" style={{ fontFamily: 'Syne, sans-serif' }}>
                      Analisis Klaster Optimal
                    </h3>
                    <p className="text-sm text-amber-700 font-medium">
                      Algoritma Multi-Objective Non-dominated Sorting Genetic II (NSGA-II)
                    </p>
                  </div>
                </div>
                <p className="text-sm text-zinc-600 mb-6 ml-16">
                  Optimasi multi-objektif berdasarkan Total Pegawai, Total Biaya, dan Total Durasi
                </p>

                {/* NSGA-II Implementation */}
                {(() => {
                  const clusters = clusterResults.clusters;
                  
                  // Extract objectives (all minimization)
                  const solutions = clusters.map((cluster, idx) => ({
                    index: idx,
                    cluster: cluster,
                    objectives: [
                      cluster.business_analysis?.total_employees || 0,
                      cluster.business_analysis?.total_cost || 0,
                      cluster.business_analysis?.total_duration || 0
                    ]
                  }));

                  // NSGA-II Step 1: Non-dominated Sorting
                  const dominates = (a, b) => {
                    let dominated = false;
                    let dominatesAtLeastOne = false;
                    for (let i = 0; i < a.objectives.length; i++) {
                      if (a.objectives[i] > b.objectives[i]) dominated = true;
                      if (a.objectives[i] < b.objectives[i]) dominatesAtLeastOne = true;
                    }
                    return !dominated && dominatesAtLeastOne;
                  };

                  // Calculate domination count and dominated solutions for each
                  const dominationInfo = solutions.map(s => ({
                    ...s,
                    dominationCount: 0,
                    dominatedBy: [],
                    dominates: []
                  }));

                  for (let i = 0; i < dominationInfo.length; i++) {
                    for (let j = 0; j < dominationInfo.length; j++) {
                      if (i !== j) {
                        if (dominates(dominationInfo[i], dominationInfo[j])) {
                          dominationInfo[i].dominates.push(j);
                        }
                        if (dominates(dominationInfo[j], dominationInfo[i])) {
                          dominationInfo[i].dominationCount++;
                          dominationInfo[i].dominatedBy.push(j);
                        }
                      }
                    }
                  }

                  // Assign fronts
                  const fronts = [];
                  let currentFront = dominationInfo.filter(s => s.dominationCount === 0);
                  let frontIndex = 0;

                  while (currentFront.length > 0) {
                    fronts.push(currentFront.map(s => ({ ...s, front: frontIndex })));
                    const nextFront = [];
                    
                    for (const solution of currentFront) {
                      for (const dominatedIdx of solution.dominates) {
                        const dominated = dominationInfo[dominatedIdx];
                        dominated.dominationCount--;
                        if (dominated.dominationCount === 0 && !nextFront.includes(dominated)) {
                          nextFront.push(dominated);
                        }
                      }
                    }
                    
                    currentFront = nextFront;
                    frontIndex++;
                  }

                  // NSGA-II Step 2: Crowding Distance for Pareto Front
                  const paretoFront = fronts[0] || [];
                  
                  const calculateCrowdingDistance = (front) => {
                    if (front.length <= 2) {
                      return front.map(s => ({ ...s, crowdingDistance: Infinity }));
                    }

                    const result = front.map(s => ({ ...s, crowdingDistance: 0 }));
                    const numObjectives = result[0].objectives.length;

                    for (let m = 0; m < numObjectives; m++) {
                      // Sort by objective m
                      result.sort((a, b) => a.objectives[m] - b.objectives[m]);
                      
                      // Boundary solutions get infinite distance
                      result[0].crowdingDistance = Infinity;
                      result[result.length - 1].crowdingDistance = Infinity;

                      const fMax = result[result.length - 1].objectives[m];
                      const fMin = result[0].objectives[m];
                      const range = fMax - fMin || 1;

                      for (let i = 1; i < result.length - 1; i++) {
                        result[i].crowdingDistance += 
                          (result[i + 1].objectives[m] - result[i - 1].objectives[m]) / range;
                      }
                    }

                    return result;
                  };

                  const paretoWithCrowding = calculateCrowdingDistance(paretoFront);
                  
                  // Sort by crowding distance (higher is better for diversity)
                  paretoWithCrowding.sort((a, b) => b.crowdingDistance - a.crowdingDistance);

                  // Best solution: from Pareto front with highest crowding distance
                  // If only one in Pareto front, that's the best
                  const bestSolution = paretoWithCrowding[0];

                  // Calculate normalized scores for display
                  const maxEmployees = Math.max(...clusters.map(c => c.business_analysis?.total_employees || 1));
                  const maxCost = Math.max(...clusters.map(c => c.business_analysis?.total_cost || 1));
                  const maxDuration = Math.max(...clusters.map(c => c.business_analysis?.total_duration || 1));

                  // Rank solutions
                  const rankedSolutions = [];
                  fronts.forEach((front, frontIdx) => {
                    const frontWithCrowding = calculateCrowdingDistance(front);
                    frontWithCrowding.sort((a, b) => b.crowdingDistance - a.crowdingDistance);
                    frontWithCrowding.forEach((s, idx) => {
                      rankedSolutions.push({
                        ...s,
                        rank: rankedSolutions.length + 1,
                        frontRank: frontIdx + 1
                      });
                    });
                  });

                  return (
                    <>
                      {/* Pareto Front Info */}
                      <div className="mb-6 bg-white/80 rounded-xl p-4 border border-amber-200">
                        <p className="text-sm text-zinc-700 mb-2">
                          <span className="font-bold text-amber-700">Pareto Front (Non-dominated Solutions):</span>{' '}
                          {paretoFront.length} klaster teridentifikasi sebagai solusi non-dominan
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {paretoFront.map((s) => (
                            <span 
                              key={`pareto-${s.cluster.cluster_id}`}
                              className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium border border-amber-300"
                            >
                              {s.cluster.cluster_name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Best by Employees */}
                        {(() => {
                          const best = [...solutions].sort((a, b) => a.objectives[0] - b.objectives[0])[0];
                          const isParetoOptimal = paretoFront.some(p => p.index === best.index);
                          return (
                            <div className={`bg-white rounded-xl p-5 border-2 shadow-md ${isParetoOptimal ? 'border-blue-400 ring-2 ring-blue-200' : 'border-blue-200'}`}>
                              <div className="flex items-center gap-2 mb-3">
                                <Award className="w-5 h-5 text-blue-600" />
                                <span className="text-sm font-bold text-blue-700">Minimum Pegawai</span>
                                {isParetoOptimal && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Pareto</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <Users className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-lg font-bold text-zinc-800">{best.cluster.cluster_name}</p>
                                  <p className="text-sm text-zinc-600">
                                    {best.objectives[0].toLocaleString('id-ID')} pegawai
                                  </p>
                                </div>
                              </div>
                              <p className="mt-3 text-xs text-zinc-500">
                                Skor: {((1 - best.objectives[0] / maxEmployees) * 100).toFixed(1)}% efisiensi
                              </p>
                            </div>
                          );
                        })()}

                        {/* Best by Cost */}
                        {(() => {
                          const best = [...solutions].sort((a, b) => a.objectives[1] - b.objectives[1])[0];
                          const isParetoOptimal = paretoFront.some(p => p.index === best.index);
                          return (
                            <div className={`bg-white rounded-xl p-5 border-2 shadow-md ${isParetoOptimal ? 'border-green-400 ring-2 ring-green-200' : 'border-green-200'}`}>
                              <div className="flex items-center gap-2 mb-3">
                                <Award className="w-5 h-5 text-green-600" />
                                <span className="text-sm font-bold text-green-700">Minimum Biaya</span>
                                {isParetoOptimal && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Pareto</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                  <DollarSign className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                  <p className="text-lg font-bold text-zinc-800">{best.cluster.cluster_name}</p>
                                  <p className="text-sm text-zinc-600">
                                    Rp {best.objectives[1].toLocaleString('id-ID')}
                                  </p>
                                </div>
                              </div>
                              <p className="mt-3 text-xs text-zinc-500">
                                Skor: {((1 - best.objectives[1] / maxCost) * 100).toFixed(1)}% efisiensi
                              </p>
                            </div>
                          );
                        })()}

                        {/* Best by Duration */}
                        {(() => {
                          const best = [...solutions].sort((a, b) => a.objectives[2] - b.objectives[2])[0];
                          const isParetoOptimal = paretoFront.some(p => p.index === best.index);
                          const duration = best.objectives[2];
                          const days = Math.floor(duration / 1440);
                          const hours = Math.floor((duration % 1440) / 60);
                          return (
                            <div className={`bg-white rounded-xl p-5 border-2 shadow-md ${isParetoOptimal ? 'border-orange-400 ring-2 ring-orange-200' : 'border-orange-200'}`}>
                              <div className="flex items-center gap-2 mb-3">
                                <Award className="w-5 h-5 text-orange-600" />
                                <span className="text-sm font-bold text-orange-700">Minimum Durasi</span>
                                {isParetoOptimal && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Pareto</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                  <Clock className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                  <p className="text-lg font-bold text-zinc-800">{best.cluster.cluster_name}</p>
                                  <p className="text-sm text-zinc-600">
                                    {days.toLocaleString('id-ID')} hari {hours} jam
                                  </p>
                                </div>
                              </div>
                              <p className="mt-3 text-xs text-zinc-500">
                                Skor: {((1 - best.objectives[2] / maxDuration) * 100).toFixed(1)}% efisiensi
                              </p>
                            </div>
                          );
                        })()}
                      </div>

                      {/* NSGA-II Ranking Table */}
                      <div className="mt-6 bg-white rounded-xl p-5 border-2 border-amber-200 shadow-md">
                        <h4 className="text-lg font-bold text-zinc-800 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
                          Peringkat NSGA-II (Non-dominated Sorting + Crowding Distance)
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-amber-50">
                                <th className="px-4 py-3 text-left font-bold text-amber-800 border-b-2 border-amber-200">Peringkat</th>
                                <th className="px-4 py-3 text-left font-bold text-amber-800 border-b-2 border-amber-200">Klaster</th>
                                <th className="px-4 py-3 text-left font-bold text-amber-800 border-b-2 border-amber-200">Front</th>
                                <th className="px-4 py-3 text-right font-bold text-amber-800 border-b-2 border-amber-200">Pegawai</th>
                                <th className="px-4 py-3 text-right font-bold text-amber-800 border-b-2 border-amber-200">Biaya</th>
                                <th className="px-4 py-3 text-right font-bold text-amber-800 border-b-2 border-amber-200">Durasi</th>
                                <th className="px-4 py-3 text-right font-bold text-amber-800 border-b-2 border-amber-200">Crowding Distance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rankedSolutions.map((s) => {
                                const duration = s.objectives[2];
                                const days = Math.floor(duration / 1440);
                                const getRowClass = () => {
                                  if (s.rank === 1) return 'bg-emerald-50';
                                  if (s.rank % 2 === 0) return 'bg-gray-50';
                                  return 'bg-white';
                                };
                                return (
                                  <tr key={`rank-${s.cluster.cluster_id}`} className={getRowClass()}>
                                    <td className="px-4 py-3 border-b border-gray-200">
                                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${s.rank === 1 ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                                        {s.rank}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 border-b border-gray-200 font-medium text-zinc-800">{s.cluster.cluster_name}</td>
                                    <td className="px-4 py-3 border-b border-gray-200">
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${s.frontRank === 1 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                                        Front {s.frontRank}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 border-b border-gray-200 text-right text-zinc-600">{s.objectives[0].toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 border-b border-gray-200 text-right text-zinc-600">Rp {s.objectives[1].toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 border-b border-gray-200 text-right text-zinc-600">{days.toLocaleString('id-ID')} hari</td>
                                    <td className="px-4 py-3 border-b border-gray-200 text-right text-zinc-600">
                                      {s.crowdingDistance === Infinity ? '∞' : s.crowdingDistance.toFixed(3)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Overall Best Solution */}
                      <div className="mt-6 bg-gradient-to-r from-emerald-100 to-lime-100 rounded-xl p-5 border-2 border-emerald-300">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-emerald-200 rounded-xl border-2 border-emerald-400">
                            <Trophy className="w-8 h-8 text-emerald-700" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-emerald-700 mb-1">
                              Klaster Optimal NSGA-II (Pareto Front + Crowding Distance Tertinggi)
                            </p>
                            <p className="text-2xl font-bold text-emerald-800" style={{ fontFamily: 'Syne, sans-serif' }}>
                              {bestSolution.cluster.cluster_name}
                            </p>
                            <p className="text-sm text-emerald-700 mt-1">
                              {bestSolution.cluster.num_cases} cases • 
                              Front {bestSolution.front + 1} • 
                              Pegawai: {bestSolution.objectives[0].toLocaleString('id-ID')} • 
                              Biaya: Rp {bestSolution.objectives[1].toLocaleString('id-ID')} • 
                              Durasi: {Math.floor(bestSolution.objectives[2] / 1440).toLocaleString('id-ID')} hari
                            </p>
                            <p className="text-xs text-emerald-600 mt-2">
                              Crowding Distance: {bestSolution.crowdingDistance === Infinity ? '∞ (Solusi boundary)' : bestSolution.crowdingDistance.toFixed(3)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setClusterResults(null)}
                className="px-6 py-3 bg-white hover:bg-gray-50 text-zinc-800 rounded-full transition-all border-2 border-zinc-300 shadow-md font-medium"
              >
                Tutup Hasil Klasterisasi
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Preview Modal */}
      {previewCluster && (
        <PetriNetPreviewModal
          petriNet={previewCluster.petri_net}
          title={previewCluster.cluster_name}
          numCases={previewCluster.num_cases}
          metrics={previewCluster.metrics}
          onClose={() => setPreviewCluster(null)}
        />
      )}
    </div>
  );
};

export default ProcessViewer;