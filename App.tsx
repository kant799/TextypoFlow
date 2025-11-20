
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  ReactFlowProvider,
  Node,
  useReactFlow,
  MarkerType,
} from '@xyflow/react';
import { 
  PlusCircle, 
  Play, 
  History, 
  Layout as LayoutIcon, 
  Trash2, 
  MousePointer2, 
  ChevronRight,
  ChevronDown, 
  ChevronUp,
  Loader2,
  Eye,
  Image as ImageIcon,
  Sparkles,
  Monitor,
  Download,
  ExternalLink,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileDown,
  FileUp,
  Spline,
  Route
} from 'lucide-react';
import { Button } from './components/ui/Button';
import { InputNode } from './components/nodes/InputNode';
import { ProcessorNode } from './components/nodes/ProcessorNode';
import { ImageGenNode } from './components/nodes/ImageGenNode';
import { DisplayNode, extractHtmlContent, normalizeHtml } from './components/nodes/DisplayNode';
import { DisconnectEdge } from './components/edges/DisconnectEdge';
import { NodeType, NodeStatus, WorkflowHistory, ProcessorNodeData, InputNodeData, DisplayNodeData, ImageGenNodeData } from './types';
import { generateText, generateImage } from './services/geminiService';
import { PRESET_CATEGORIES, FLATTENED_PRESETS } from './constants/presets';
import { FullScreenModal } from './components/ui/FullScreenModal';
import ReactMarkdown from 'react-markdown';

// Node Types Registration
const nodeTypes = {
  [NodeType.INPUT]: InputNode,
  [NodeType.PROCESSOR]: ProcessorNode,
  [NodeType.IMAGE_GEN]: ImageGenNode,
  [NodeType.DISPLAY]: DisplayNode,
};

// Edge Types Registration
const edgeTypes = {
  'disconnectable': DisconnectEdge,
};

const defaultEdgeOptions = {
    type: 'disconnectable', // Use our custom edge by default
    animated: false, 
    style: { stroke: '#a1a1aa', strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#a1a1aa',
    },
  };

// Initial graph state factory to ensure fresh references
const getInitialNodes = (): Node[] => [
  {
    id: 'input-1',
    type: NodeType.INPUT,
    position: { x: 100, y: 200 },
    data: { label: 'Input', status: NodeStatus.IDLE, inputType: 'text', value: '...' },
  },
  {
    id: 'display-1',
    type: NodeType.DISPLAY,
    position: { x: 600, y: 200 },
    data: { label: 'Display', status: NodeStatus.IDLE, content: '', contentType: 'text' },
  },
];

const initialEdges: Edge[] = [];

const FlowEditor = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(getInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [history, setHistory] = useState<WorkflowHistory[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  
  // Edge Type State
  const [edgeType, setEdgeType] = useState<'bezier' | 'smoothstep'>('bezier');

  // Sidebar Accordion State: Both categories open by default
  const [openCategories, setOpenCategories] = useState<string[]>(['效率工具', '视觉创作']);

  // History Preview State
  const [previewData, setPreviewData] = useState<{content: string, contentType: 'html'|'markdown'|'text'|'image', title?: string} | null>(null);
  const [historyCopied, setHistoryCopied] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Reset zoom when preview opens
  useEffect(() => {
    if (previewData) setZoom(1);
  }, [previewData]);

  // Node Connector Menu State
  const [menuState, setMenuState] = useState<{ isOpen: boolean; position: { x: number; y: number }; sourceId: string | null }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    sourceId: null,
  });
  // Submenu state for quick add menu
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);

  // File Input Ref for Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Callback to open the node connector menu
  const onConnectClick = useCallback((nodeId: string, screenPos: { x: number; y: number }) => {
    setMenuState({
        isOpen: true,
        position: screenPos,
        sourceId: nodeId
    });
    setActiveSubMenu(null);
  }, []);

  // Inject the onConnectClick handler into all nodes
  useEffect(() => {
    setNodes(nds => nds.map(n => ({
        ...n,
        data: { ...n.data, onConnectClick }
    })));
  }, [onConnectClick, setNodes]);

  const toggleCategory = (title: string) => {
      setOpenCategories(prev => 
        prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
      );
  };

  // Toggle Edge Type between Bezier and SmoothStep
  const toggleEdgeType = () => {
    const newType = edgeType === 'bezier' ? 'smoothstep' : 'bezier';
    setEdgeType(newType);
    setEdges((eds) => eds.map(e => ({
        ...e,
        data: { ...e.data, pathType: newType }
    })));
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ 
        ...params, 
        ...defaultEdgeOptions,
        data: { pathType: edgeType } 
    }, eds)),
    [setEdges, edgeType]
  );

  // --- Workflow Export/Import Logic ---
  const handleExportFlow = useCallback(() => {
    const flowData = {
      nodes,
      edges,
      edgeType, // Save current edge settings
      version: "1.0",
      timestamp: Date.now()
    };
    
    const jsonString = JSON.stringify(flowData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `textypoflow-workflow-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [nodes, edges, edgeType]);

  const handleImportFlow = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const flowData = JSON.parse(content);
        
        if (flowData.nodes && flowData.edges) {
            // Restore nodes and edges, ensuring we re-attach the event handler
            const restoredNodes = flowData.nodes.map((n: Node) => ({
                ...n,
                data: {
                    ...n.data,
                    onConnectClick // Re-inject the handler needed for the menu
                }
            }));

            // Restore edge type preference
            const loadedEdgeType = flowData.edgeType || 'bezier';
            setEdgeType(loadedEdgeType);

            // Update edges to match loaded preference (or default if missing)
            const restoredEdges = flowData.edges.map((e: Edge) => ({
                ...e,
                data: { ...e.data, pathType: loadedEdgeType }
            }));

            setNodes(restoredNodes);
            setEdges(restoredEdges);
            
            // Fit view after a short delay to allow rendering
            setTimeout(() => fitView({ duration: 500 }), 100);
        } else {
            alert("无效的工作流文件格式");
        }
      } catch (error) {
        console.error("Error parsing flow file:", error);
        alert("加载工作流失败: 文件可能已损坏");
      }
    };
    reader.readAsText(file);
    // Reset input value to allow selecting same file again
    event.target.value = '';
  }, [setNodes, setEdges, onConnectClick, fitView]);


  // Helper to fetch preset instructions
  const fetchPresetInstruction = async (promptPath?: string, basePath?: string) => {
      if (!promptPath || !basePath) return '';
      try {
          const [promptText, baseText] = await Promise.all([
              fetch(promptPath).then(res => res.ok ? res.text() : ''),
              fetch(basePath).then(res => res.ok ? res.text() : '')
          ]);
          if (promptText && baseText) {
              return `${promptText}\n\n${baseText}`;
          }
      } catch (error) {
          console.error("Failed to fetch preset prompts", error);
      }
      return '';
  };

  // --- Drag and Drop Logic ---
  const onDragStart = (event: React.DragEvent, nodeType: string, presetData?: any) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (presetData) {
        event.dataTransfer.setData('application/reactflow-data', JSON.stringify(presetData));
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const rawPresetData = event.dataTransfer.getData('application/reactflow-data');
      
      if (typeof type === 'undefined' || !type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      let additionalData: any = {};
      if (rawPresetData) {
          try {
              additionalData = JSON.parse(rawPresetData);
          } catch (e) {
              console.error("Failed to parse preset data", e);
          }
      }

      // Handle Preset Fetching if paths exist
      let fetchedInstruction = '';
      if (additionalData.promptPath && additionalData.basePath) {
          fetchedInstruction = await fetchPresetInstruction(additionalData.promptPath, additionalData.basePath);
      }

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { 
            status: NodeStatus.IDLE,
            label: type === NodeType.INPUT ? 'New Input' : type === NodeType.PROCESSOR ? 'AI 处理器' : type === NodeType.IMAGE_GEN ? 'AI 绘图' : 'New Display',
            onConnectClick, // Inject handler
            ...(type === NodeType.INPUT ? { inputType: 'text', value: '' } : {}),
            ...(type === NodeType.PROCESSOR ? { systemInstruction: fetchedInstruction || '' } : {}),
            ...(type === NodeType.IMAGE_GEN ? { prompt: '', aspectRatio: '1:1' } : {}),
            ...(type === NodeType.DISPLAY ? { content: '', contentType: 'text' } : {}),
            ...additionalData // Override with preset data (includes label if present)
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, onConnectClick]
  );

  // --- Quick Add Node from Menu ---
  const handleQuickAddNode = (type: NodeType) => {
      if (!menuState.sourceId) return;
      
      const sourceNode = nodes.find(n => n.id === menuState.sourceId);
      if (!sourceNode) return;

      const newNodeId = `${type}-${Date.now()}`;
      // Default offset placement
      const offset = { x: 400, y: 0 }; 
      const position = { 
          x: sourceNode.position.x + offset.x, 
          y: sourceNode.position.y + offset.y 
      };

      const newNode: Node = {
          id: newNodeId,
          type,
          position,
          data: { 
              status: NodeStatus.IDLE,
              label: type === NodeType.PROCESSOR ? 'AI 处理器' : type === NodeType.IMAGE_GEN ? 'AI 绘图' : '结果展示',
              onConnectClick,
              ...(type === NodeType.PROCESSOR ? { systemInstruction: '' } : {}),
              ...(type === NodeType.IMAGE_GEN ? { prompt: '', aspectRatio: '1:1' } : {}),
              ...(type === NodeType.DISPLAY ? { content: '', contentType: 'text' } : {}),
          },
      };

      const newEdge: Edge = {
          id: `e-${menuState.sourceId}-${newNodeId}`,
          source: menuState.sourceId,
          target: newNodeId,
          ...defaultEdgeOptions,
          data: { pathType: edgeType }
      };

      setNodes(nds => nds.concat(newNode));
      setEdges(eds => addEdge(newEdge, eds));
      setMenuState(prev => ({ ...prev, isOpen: false }));
      setActiveSubMenu(null);
  };

  // --- Quick Add Preset from Menu ---
  const handleQuickAddPreset = async (preset: any) => {
    if (!menuState.sourceId) return;
    
    const fetchedInstruction = await fetchPresetInstruction(preset.promptPath, preset.basePath);

    const sourceNode = nodes.find(n => n.id === menuState.sourceId);
    if (!sourceNode) return;

    const newNodeId = `${NodeType.PROCESSOR}-${Date.now()}`;
    const offset = { x: 400, y: 0 }; 
    const position = { 
        x: sourceNode.position.x + offset.x, 
        y: sourceNode.position.y + offset.y 
    };

    const newNode: Node = {
        id: newNodeId,
        type: NodeType.PROCESSOR,
        position,
        data: { 
            status: NodeStatus.IDLE,
            label: preset.label,
            onConnectClick,
            systemInstruction: fetchedInstruction
        },
    };

    const newEdge: Edge = {
        id: `e-${menuState.sourceId}-${newNodeId}`,
        source: menuState.sourceId,
        target: newNodeId,
        ...defaultEdgeOptions,
        data: { pathType: edgeType }
    };

    setNodes(nds => nds.concat(newNode));
    setEdges(eds => addEdge(newEdge, eds));
    setMenuState(prev => ({ ...prev, isOpen: false }));
    setActiveSubMenu(null);
  };


  // --- Execution Engine ---
  const runWorkflow = async () => {
    if (isRunning) return;
    setIsRunning(true);

    // Create a working copy of nodes to track state during execution because setNodes is async
    let workingNodes = JSON.parse(JSON.stringify(nodes));

    // 1. Reset statuses to Idle in both UI and working copy
    const resetNodes = (nds: Node[]) => nds.map(n => ({
        ...n,
        data: { ...n.data, status: NodeStatus.IDLE, errorMessage: undefined }
    }));
    
    setNodes(resetNodes);
    workingNodes = resetNodes(workingNodes);

    // 2. Reset edges to default state (gray, static)
    setEdges(eds => eds.map(e => ({
        ...e,
        animated: false,
        style: { ...e.style, stroke: '#a1a1aa', strokeWidth: 2 }
    })));

    // Helper to update state in both places
    const updateNodeState = (nodeId: string, dataUpdate: any) => {
        // Update working copy
        workingNodes = workingNodes.map((n: Node) => 
            n.id === nodeId ? { ...n, data: { ...n.data, ...dataUpdate } } : n
        );
        // Update UI
        setNodes((nds) => nds.map(n => 
            n.id === nodeId ? { ...n, data: { ...n.data, ...dataUpdate } } : n
        ));
    };

    // Helper to animate edges
    const updateEdgeStatus = (edgeId: string, status: 'running' | 'done') => {
        setEdges(eds => eds.map(e => {
            if (e.id === edgeId) {
                return {
                    ...e,
                    animated: status === 'running',
                    style: { 
                        ...e.style, 
                        stroke: '#3b82f6', // Blue
                        strokeWidth: 2 
                    }
                };
            }
            return e;
        }));
    };

    await new Promise(r => setTimeout(r, 100));

    // Recursive function to process nodes
    const processNode = async (nodeId: string, input: string) => {
        updateNodeState(nodeId, { status: NodeStatus.RUNNING, inputData: input });
        
        const node = workingNodes.find((n: Node) => n.id === nodeId);
        if (!node) return;

        try {
            if (node.type === NodeType.PROCESSOR) {
                const nodeData = node.data as ProcessorNodeData;
                const result = await generateText(input, nodeData.systemInstruction);
                
                updateNodeState(nodeId, { status: NodeStatus.SUCCESS, outputData: result });
                
                // Propagate to connected nodes
                const connectedEdges = edges.filter(e => e.source === nodeId);
                for (const edge of connectedEdges) {
                    updateEdgeStatus(edge.id, 'running');
                    await propagateToTarget(edge.target, result);
                    updateEdgeStatus(edge.id, 'done');
                }
            } 
            else if (node.type === NodeType.IMAGE_GEN) {
                const nodeData = node.data as ImageGenNodeData;
                // Use internal prompt plus input context
                const combinedPrompt = nodeData.prompt + (input ? `\n\n上下文信息: ${input}` : "");
                const base64Image = await generateImage(combinedPrompt, nodeData.aspectRatio || '1:1');
                
                updateNodeState(nodeId, { status: NodeStatus.SUCCESS, generatedImage: base64Image });
                
                // Propagate specific description to downstream nodes just in case
                const outputDescription = `[已生成图片，比例: ${nodeData.aspectRatio || '1:1'}] ${nodeData.prompt}`;
                
                const connectedEdges = edges.filter(e => e.source === nodeId);
                for (const edge of connectedEdges) {
                    updateEdgeStatus(edge.id, 'running');
                    await propagateToTarget(edge.target, outputDescription);
                    updateEdgeStatus(edge.id, 'done');
                }
            }
             else if (node.type === NodeType.DISPLAY) {
                updateNodeState(nodeId, { status: NodeStatus.SUCCESS, content: input });
            }
        } catch (error: any) {
            updateNodeState(nodeId, { status: NodeStatus.ERROR, errorMessage: error.message });
        }
    };

    const propagateToTarget = async (targetId: string, data: string) => {
        const targetNode = workingNodes.find((n: Node) => n.id === targetId);
        if (targetNode) {
            await processNode(targetId, data);
        }
    };

    try {
        const inputNodes = workingNodes.filter((n: Node) => n.type === NodeType.INPUT);
        
        for (const inputNode of inputNodes) {
            const inputData = inputNode.data as InputNodeData;
            updateNodeState(inputNode.id, { status: NodeStatus.SUCCESS });

            const connectedEdges = edges.filter(e => e.source === inputNode.id);
            for (const edge of connectedEdges) {
                updateEdgeStatus(edge.id, 'running');
                await propagateToTarget(edge.target, inputData.value);
                updateEdgeStatus(edge.id, 'done');
            }
        }

        // Save snapshot
        const snapshot: WorkflowHistory = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            nodes: JSON.parse(JSON.stringify(workingNodes)),
            edges: JSON.parse(JSON.stringify(edges))
        };
        setHistory(prev => [snapshot, ...prev]);

    } catch (error) {
        console.error("Workflow failed", error);
    } finally {
        setIsRunning(false);
    }
  };

  const restoreHistory = (snapshot: WorkflowHistory) => {
      setNodes(JSON.parse(JSON.stringify(snapshot.nodes)));
      setEdges(JSON.parse(JSON.stringify(snapshot.edges)));
  };

  const clearCanvas = () => {
      setNodes(getInitialNodes());
      setEdges([]);
  };

  const openPreview = (content: string, contentType: 'html' | 'markdown' | 'text' | 'image', title?: string) => {
      setPreviewData({ content, contentType, title });
  };

  const handleHistoryCopy = async () => {
    if (!previewData?.content || previewData.contentType === 'image') return;
    try {
        await navigator.clipboard.writeText(previewData.content);
        setHistoryCopied(true);
        setTimeout(() => setHistoryCopied(false), 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
  };

  const handleHistoryDownload = () => {
    if (!previewData?.content) return;
    
    if (previewData.contentType === 'image') {
          const link = document.createElement('a');
          link.href = `data:image/png;base64,${previewData.content}`;
          link.download = `history-image-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
    } else {
        const isHtml = previewData.contentType === 'html' || extractHtmlContent(previewData.content);
        const content = isHtml ? normalizeHtml(extractHtmlContent(previewData.content) || previewData.content) : previewData.content;
        const type = isHtml ? 'text/html' : 'text/plain';
        const ext = isHtml ? 'html' : (previewData.contentType === 'markdown' ? 'md' : 'txt');
        
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `history-export-${Date.now()}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
  };

  const handleHistoryNewTab = () => {
    if (!previewData?.content) return;
    
    if (previewData.contentType === 'image') {
         const win = window.open();
         win?.document.write(`<img src="data:image/png;base64,${previewData.content}" style="max-width:100%">`);
    } else {
        const isHtml = previewData.contentType === 'html' || extractHtmlContent(previewData.content);
        const content = isHtml ? normalizeHtml(extractHtmlContent(previewData.content) || previewData.content) : previewData.content;
        const type = isHtml ? 'text/html' : 'text/plain';
        
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50">
      {/* Left Sidebar - Tools */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col z-20 shadow-lg">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-2">
            <LayoutIcon className="w-5 h-5 text-zinc-900" />
            <h1 className="font-bold text-zinc-900 tracking-tight">TextypoFlow</h1>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">基础节点</h2>
            <div className="grid grid-cols-2 gap-2 mb-8">
                <div 
                    className="flex flex-col items-center justify-center p-3 bg-zinc-50 border border-zinc-200 rounded-lg cursor-grab active:cursor-grabbing hover:border-zinc-400 transition-colors gap-1 group text-center hover:shadow-sm"
                    onDragStart={(e) => onDragStart(e, NodeType.INPUT)}
                    draggable
                >
                    <div className="w-8 h-8 rounded bg-zinc-200 flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-colors mb-1">
                        <PlusCircle className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-zinc-700 leading-none">输入节点</span>
                    <span className="text-[10px] text-zinc-400 scale-90 origin-center leading-none">工作流起点</span>
                </div>

                <div 
                    className="flex flex-col items-center justify-center p-3 bg-zinc-50 border border-zinc-200 rounded-lg cursor-grab active:cursor-grabbing hover:border-indigo-400 transition-colors gap-1 group text-center hover:shadow-sm"
                    onDragStart={(e) => onDragStart(e, NodeType.PROCESSOR)}
                    draggable
                >
                    <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors mb-1">
                        <MousePointer2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-zinc-700 leading-none">AI 处理器</span>
                    <span className="text-[10px] text-zinc-400 scale-90 origin-center leading-none">文本生成与处理</span>
                </div>

                <div 
                    className="flex flex-col items-center justify-center p-3 bg-zinc-50 border border-zinc-200 rounded-lg cursor-grab active:cursor-grabbing hover:border-purple-400 transition-colors gap-1 group text-center hover:shadow-sm"
                    onDragStart={(e) => onDragStart(e, NodeType.IMAGE_GEN)}
                    draggable
                >
                    <div className="w-8 h-8 rounded bg-purple-100 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors mb-1">
                        <ImageIcon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-zinc-700 leading-none">AI 绘图</span>
                    <span className="text-[10px] text-zinc-400 scale-90 origin-center leading-none">NanoBanana</span>
                </div>

                <div 
                    className="flex flex-col items-center justify-center p-3 bg-zinc-50 border border-zinc-200 rounded-lg cursor-grab active:cursor-grabbing hover:border-green-400 transition-colors gap-1 group text-center hover:shadow-sm"
                    onDragStart={(e) => onDragStart(e, NodeType.DISPLAY)}
                    draggable
                >
                    <div className="w-8 h-8 rounded bg-green-100 text-green-600 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors mb-1">
                        <LayoutIcon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-zinc-700 leading-none">结果展示</span>
                    <span className="text-[10px] text-zinc-400 scale-90 origin-center leading-none">预览或渲染输出</span>
                </div>
            </div>

            <div className="space-y-2">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">预设模版</h2>
                
                {PRESET_CATEGORIES.map((category) => {
                    const isOpen = openCategories.includes(category.title);
                    return (
                        <div key={category.title} className="border border-zinc-100 rounded-lg overflow-hidden">
                            <button 
                                onClick={() => toggleCategory(category.title)}
                                className="w-full flex items-center justify-between p-2.5 bg-zinc-50 hover:bg-zinc-100 transition-colors text-xs font-medium text-zinc-700"
                            >
                                {category.title}
                                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
                            </button>
                            
                            {isOpen && (
                                <div className="p-2 bg-white grid grid-cols-3 gap-1.5 animate-in slide-in-from-top-2 duration-200">
                                    {category.items.map(preset => (
                                        <div 
                                            key={preset.id}
                                            className="p-1.5 bg-white border border-zinc-100 rounded-lg cursor-grab active:cursor-grabbing hover:border-purple-400 hover:shadow-sm hover:bg-purple-50/30 transition-all flex flex-col items-center text-center gap-1 group"
                                            onDragStart={(e) => onDragStart(e, preset.type, { promptPath: preset.promptPath, basePath: preset.basePath, label: preset.label })}
                                            draggable
                                            title={preset.description}
                                        >
                                            <div className="w-7 h-7 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors mb-0.5">
                                                {preset.icon}
                                            </div>
                                            <span className="text-[10px] font-medium text-zinc-600 group-hover:text-zinc-900 leading-tight">{preset.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
        
        <div className="p-3 border-t border-zinc-100 bg-zinc-50/50">
             <div className="text-[10px] text-zinc-400 text-center">
                 Designed by <span className="font-semibold text-zinc-600">Cyan</span>
             </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 relative" ref={reactFlowWrapper}>
        {/* Hidden File Input for Import */}
        <input 
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".json"
            onChange={handleImportFlow}
        />
        
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            onPaneClick={() => {
                setMenuState(prev => ({ ...prev, isOpen: false }));
                setActiveSubMenu(null);
            }}
        >
            <Background color="#e4e4e7" gap={20} size={1} />
            <Controls className="bg-white border-zinc-200 shadow-sm text-zinc-600" />
        </ReactFlow>
        
        {/* Node Connector Menu */}
        {menuState.isOpen && (
            <div 
                className="fixed z-50 bg-white rounded-lg shadow-xl border border-zinc-200 p-1.5 w-48 flex flex-col gap-1 animate-in zoom-in-95 duration-100 origin-top-left"
                style={{ left: menuState.position.x + 10, top: menuState.position.y - 20 }}
                onMouseLeave={() => setActiveSubMenu(null)}
            >
                <div className="px-2 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-50 mb-1">
                    添加节点
                </div>
                
                {/* AI Processor with Submenu */}
                <div 
                    className="relative"
                    onMouseEnter={() => setActiveSubMenu('processor')}
                    onMouseLeave={() => setActiveSubMenu(null)}
                >
                    <button 
                        onClick={() => handleQuickAddNode(NodeType.PROCESSOR)}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-indigo-50 text-zinc-600 hover:text-indigo-600 transition-colors text-xs text-left group"
                    >
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-indigo-100 rounded text-indigo-600">
                                <Sparkles className="w-3 h-3" />
                            </div>
                            AI 处理器
                        </div>
                        <ChevronRight className="w-3 h-3 text-zinc-300 group-hover:text-indigo-400" />
                    </button>

                    {/* Submenu */}
                    {activeSubMenu === 'processor' && (
                        <div className="absolute left-full top-0 ml-1 w-48 bg-white rounded-lg shadow-xl border border-zinc-200 p-1.5 max-h-[300px] overflow-y-auto z-50 animate-in fade-in slide-in-from-left-1">
                             {PRESET_CATEGORIES.map((cat) => (
                                <div key={cat.title} className="mb-2 last:mb-0">
                                    <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{cat.title}</div>
                                    {cat.items.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleQuickAddPreset(item);
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition-colors text-xs text-left"
                                        >
                                            <span className="text-zinc-400">{item.icon}</span>
                                            <span>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                             ))}
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={() => handleQuickAddNode(NodeType.IMAGE_GEN)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-purple-50 text-zinc-600 hover:text-purple-600 transition-colors text-xs text-left"
                >
                    <div className="p-1 bg-purple-100 rounded text-purple-600">
                        <ImageIcon className="w-3 h-3" />
                    </div>
                    AI 绘图
                </button>
                
                <button 
                    onClick={() => handleQuickAddNode(NodeType.DISPLAY)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-green-50 text-zinc-600 hover:text-green-600 transition-colors text-xs text-left"
                >
                    <div className="p-1 bg-green-100 rounded text-green-600">
                        <Monitor className="w-3 h-3" />
                    </div>
                    结果展示
                </button>
            </div>
        )}

        {/* Floating Operations Toolbar */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-1 p-1.5 bg-white/90 backdrop-blur-md border border-zinc-200/80 shadow-xl rounded-full ring-1 ring-zinc-900/5 transition-all hover:scale-[1.02]">
            <Button 
                onClick={runWorkflow} 
                disabled={isRunning}
                className={`!rounded-full px-6 shadow-none transition-all min-w-[100px] border-0 ${
                    isRunning 
                        ? '!bg-indigo-500 !text-white ring-2 ring-indigo-500/20' 
                        : '!bg-blue-500 hover:!bg-blue-600 !text-white shadow-sm shadow-blue-500/30'
                }`}
                size="md"
            >
                {isRunning ? (
                     <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        运行中...
                     </>
                ) : (
                     <>
                        <Play className="w-4 h-4 fill-current mr-2" />
                        运行
                     </>
                )}
            </Button>

            <div className="w-px h-5 bg-zinc-200 mx-2 rounded-full" />

            <Button 
                variant="ghost" 
                onClick={handleExportFlow}
                className="!rounded-full text-zinc-500 hover:text-zinc-900 px-3"
                size="md"
                title="导出工作流"
            >
                <FileDown className="w-4 h-4" />
            </Button>
            
            <Button 
                variant="ghost" 
                onClick={() => fileInputRef.current?.click()}
                className="!rounded-full text-zinc-500 hover:text-zinc-900 px-3"
                size="md"
                title="导入工作流"
            >
                <FileUp className="w-4 h-4" />
            </Button>

            <div className="w-px h-5 bg-zinc-200 mx-2 rounded-full" />
            
            <Button 
                variant="ghost" 
                onClick={toggleEdgeType}
                className="!rounded-full text-zinc-500 hover:text-zinc-900 px-3"
                size="md"
                title={edgeType === 'bezier' ? "切换为折线" : "切换为曲线"}
            >
                {edgeType === 'bezier' ? <Spline className="w-4 h-4" /> : <Route className="w-4 h-4" />}
            </Button>

            <div className="w-px h-5 bg-zinc-200 mx-2 rounded-full" />

            <Button 
                variant="ghost" 
                onClick={clearCanvas}
                className="!rounded-full text-zinc-500 hover:text-red-600 hover:bg-red-50 px-3"
                size="md"
                title="清空/重置画布"
            >
                <Trash2 className="w-4 h-4" />
            </Button>
        </div>
        
        {/* Floating History Toggle (if closed) */}
        {!isHistoryOpen && (
            <button 
                onClick={() => setIsHistoryOpen(true)}
                className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow border border-zinc-200 text-zinc-600 hover:text-zinc-900 z-10"
            >
                <History className="w-5 h-5" />
            </button>
        )}
      </main>

      {/* Right Sidebar - History */}
      <div 
        className={`bg-white border-l border-zinc-200 flex flex-col z-20 shadow-lg transition-all duration-300 ease-in-out ${isHistoryOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-full opacity-0'}`}
      >
         {isHistoryOpen && (
             <>
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                    <div className="flex items-center gap-2 text-zinc-700 font-medium">
                        <History className="w-4 h-4" />
                        历史记录
                    </div>
                    <button onClick={() => setIsHistoryOpen(false)} className="text-zinc-400 hover:text-zinc-900">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-zinc-400 text-sm">
                            暂无运行记录
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {history.map((item) => {
                                const outputs = item.nodes.filter(n => 
                                    (n.type === NodeType.DISPLAY && (n.data as DisplayNodeData).content) ||
                                    (n.type === NodeType.IMAGE_GEN && (n.data as ImageGenNodeData).generatedImage)
                                );
                                return (
                                    <div 
                                        key={item.id}
                                        className="p-3 rounded-lg border border-zinc-200 bg-white transition-all group hover:border-zinc-300 hover:shadow-sm"
                                    >
                                        {/* Restoration Click Area */}
                                        <div 
                                            onClick={() => restoreHistory(item)}
                                            className="cursor-pointer"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-xs font-semibold text-zinc-700">
                                                    {new Date(item.timestamp).toLocaleTimeString()}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 font-mono">
                                                    {item.nodes.length} 个节点
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-zinc-500 line-clamp-1 mb-2">
                                                ID: {item.id.slice(-6)}
                                            </div>
                                        </div>
                                        
                                        {/* Output Previews List */}
                                        {outputs.length > 0 && (
                                            <div className="pt-2 mt-1 border-t border-zinc-100 space-y-1.5">
                                                <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">生成的作品</div>
                                                {outputs.map((node, idx) => {
                                                    const isImage = node.type === NodeType.IMAGE_GEN;
                                                    const d = node.data as any;
                                                    const content = isImage ? d.generatedImage : d.content;
                                                    const contentType = isImage ? 'image' : d.contentType;
                                                    const label = d.label || (isImage ? 'AI 绘图' : `结果 ${idx + 1}`);

                                                    return (
                                                        <div key={node.id} className="flex items-center justify-between bg-zinc-50 p-1.5 rounded border border-zinc-100">
                                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                                {isImage ? (
                                                                    <ImageIcon className="w-3 h-3 text-purple-600 flex-shrink-0" />
                                                                ) : (
                                                                    <LayoutIcon className="w-3 h-3 text-green-600 flex-shrink-0" />
                                                                )}
                                                                <span className="text-[10px] text-zinc-600 truncate">
                                                                    {label}
                                                                </span>
                                                            </div>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openPreview(content, contentType, label);
                                                                }}
                                                                className="p-1 bg-white border border-zinc-200 rounded hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                                                                title="预览内容"
                                                            >
                                                                <Eye className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
             </>
         )}
      </div>

      {/* History Preview Modal */}
      <FullScreenModal
        isOpen={!!previewData}
        onClose={() => setPreviewData(null)}
        title={
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-100 rounded-md">
                        <History className="w-4 h-4 text-zinc-600" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-zinc-800">
                        历史记录预览
                    </h3>
                    <p className="text-[10px] text-zinc-500 leading-none">
                        {previewData?.title || 'Generated Content'}
                    </p>
                </div>
            </div>
        }
        headerActions={
            <div className="flex items-center gap-3">
                {/* Zoom Controls for HTML */}
                {(previewData?.contentType === 'html' || extractHtmlContent(previewData?.content || '')) && (
                    <div className="flex items-center gap-1 mr-2 bg-zinc-100 rounded-lg p-0.5 border border-zinc-200">
                        <button 
                            onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} 
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-zinc-500 hover:text-zinc-900" 
                            title="缩小"
                        >
                            <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono font-medium text-zinc-600 w-10 text-center select-none">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button 
                            onClick={() => setZoom(z => Math.min(3, z + 0.25))} 
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-zinc-500 hover:text-zinc-900" 
                            title="放大"
                        >
                            <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={() => setZoom(1)} 
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-zinc-500 hover:text-zinc-900 border-l border-zinc-200 ml-1" 
                            title="重置"
                        >
                            <RotateCcw className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {(previewData?.contentType === 'html' || extractHtmlContent(previewData?.content || '')) && <div className="w-px h-4 bg-zinc-200" />}

                <button 
                    onClick={handleHistoryDownload}
                    className="p-2 hover:bg-zinc-100 rounded-md text-zinc-500 hover:text-zinc-900 transition-colors"
                    title="下载"
                >
                    <Download className="w-4 h-4" />
                </button>
                {(previewData?.contentType === 'html' || extractHtmlContent(previewData?.content || '') || previewData?.contentType === 'image') && (
                     <button 
                        onClick={handleHistoryNewTab}
                        className="p-2 hover:bg-zinc-100 rounded-md text-zinc-500 hover:text-zinc-900 transition-colors"
                        title="新窗口打开"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </button>
                )}
                {previewData?.contentType !== 'image' && (
                     <button 
                        onClick={handleHistoryCopy}
                        className="p-2 hover:bg-zinc-100 rounded-md text-zinc-500 hover:text-zinc-900 transition-colors"
                        title={historyCopied ? '已复制' : '复制内容'}
                    >
                        {historyCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                )}
            </div>
        }
      >
        <div className="w-full h-full bg-zinc-100 overflow-hidden flex flex-col">
            {previewData?.content ? (() => {
                if (previewData.contentType === 'image') {
                     return (
                         <div className="w-full h-full bg-zinc-950 flex items-center justify-center p-4">
                             <img 
                                src={`data:image/png;base64,${previewData.content}`} 
                                alt="History Preview" 
                                className="max-w-full max-h-full object-contain shadow-2xl"
                             />
                         </div>
                     );
                }

                const isHtml = previewData.contentType === 'html' || extractHtmlContent(previewData.content);
                const htmlContent = isHtml ? normalizeHtml(extractHtmlContent(previewData.content) || previewData.content) : null;
                
                return htmlContent ? (
                     <div className="flex-1 w-full h-full bg-zinc-500/5 relative overflow-hidden">
                         <iframe 
                            srcDoc={htmlContent} 
                            className="border-none origin-top-left transition-all duration-200 ease-in-out bg-white shadow-sm"
                            style={{
                                width: `${100 / zoom}%`,
                                height: `${100 / zoom}%`,
                                transform: `scale(${zoom})`
                            }}
                            sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin allow-top-navigation"
                            title="history-preview"
                         />
                     </div>
                ) : (
                     <div className="flex-1 overflow-y-auto p-8">
                         <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-zinc-200 p-8 min-h-[50vh]">
                            <div className="prose prose-zinc prose-sm sm:prose-base max-w-none">
                                <ReactMarkdown>{previewData.content}</ReactMarkdown>
                            </div>
                         </div>
                     </div>
                );
            })() : (
                <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
                    无法加载内容
                </div>
            )}
        </div>
      </FullScreenModal>

    </div>
  );
};

export default function App() {
    return (
        <ReactFlowProvider>
            <FlowEditor />
        </ReactFlowProvider>
    );
}
