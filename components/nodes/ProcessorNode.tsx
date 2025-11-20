
import React, { useCallback, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Sparkles, Settings2, Maximize2, FileText, Copy, Check, Library, ChevronDown, ChevronRight, Loader2, Eye } from 'lucide-react';
import { ProcessorNodeData, NodeStatus } from '../../types';
import { BaseNodeWrapper } from './BaseNodeWrapper';
import { FullScreenModal } from '../ui/FullScreenModal';
import { PRESET_CATEGORIES, PresetItem } from '../../constants/presets';

export const ProcessorNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const { updateNodeData } = useReactFlow();
  const nodeData = data as ProcessorNodeData;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isInputViewerOpen, setIsInputViewerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingPresetId, setLoadingPresetId] = useState<string | null>(null);
  // State to track expanded categories in the modal sidebar
  const [expandedCats, setExpandedCats] = useState<string[]>(['网页生成', '文本处理']);

  const handlePromptChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { systemInstruction: evt.target.value, status: NodeStatus.IDLE });
  }, [id, updateNodeData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(nodeData.systemInstruction);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadAndApplyPreset = async (preset: PresetItem) => {
    setLoadingPresetId(preset.id);
    try {
        // Fetch specific prompt and base instruction in parallel
        const [specificText, baseText] = await Promise.all([
            fetch(preset.promptPath).then(res => {
                if (!res.ok) throw new Error(`Failed to load ${preset.promptPath}`);
                return res.text();
            }),
            fetch(preset.basePath).then(res => {
                if (!res.ok) throw new Error(`Failed to load ${preset.basePath}`);
                return res.text();
            })
        ]);

        const combinedInstruction = `${specificText}\n\n${baseText}`;
        updateNodeData(id, { 
          systemInstruction: combinedInstruction, 
          status: NodeStatus.IDLE,
          label: preset.label
        });
    } catch (error) {
        console.error("Error loading preset:", error);
        // Fallback or error notification could go here
    } finally {
        setLoadingPresetId(null);
    }
  };

  const toggleCat = (title: string) => {
    setExpandedCats(prev => 
        prev.includes(title) ? prev.filter(c => c !== title) : [...prev, title]
    );
  };

  return (
    <>
      <BaseNodeWrapper 
        id={id}
        title={nodeData.label || "AI 处理器"} 
        icon={<Sparkles className="w-4 h-4 text-indigo-500" />} 
        status={nodeData.status}
        selected={selected}
      >
        <Handle type="target" position={Position.Left} className="!bg-zinc-400 hover:!bg-zinc-900 transition-colors" />
        
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-500 flex items-center gap-1">
                <Settings2 className="w-3 h-3" />
                系统提示词 (System Prompt)
              </label>
              <button 
                onClick={() => setIsEditorOpen(true)}
                className="text-[10px] flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-0.5 rounded transition-colors"
              >
                <Maximize2 className="w-3 h-3" /> 展开编辑
              </button>
            </div>
            
            {/* Preview Textarea */}
            <div className="relative group">
              <textarea
                className="nodrag w-full h-24 p-2 text-xs bg-indigo-50/30 border border-indigo-100 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono text-zinc-700 placeholder-indigo-300"
                placeholder="例如：你是一个有用的助手，请总结上述内容。"
                value={nodeData.systemInstruction}
                onChange={handlePromptChange}
              />
              <div 
                className="absolute inset-0 bg-indigo-50/0 hover:bg-indigo-50/10 transition-colors cursor-pointer pointer-events-none"
                aria-hidden="true" 
              />
            </div>
          </div>

          {nodeData.status === NodeStatus.ERROR && (
              <div className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">
                  错误: {nodeData.errorMessage || "处理失败"}
              </div>
          )}
          
          {/* Visual indicator of input connection state */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                  <div className={`w-1.5 h-1.5 rounded-full ${nodeData.inputData ? 'bg-green-400' : 'bg-zinc-300'}`} />
                  {nodeData.inputData ? '已接收输入数据' : '等待输入...'}
              </div>
              {nodeData.inputData && (
                  <button 
                    onClick={() => setIsInputViewerOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
                    title="查看输入内容"
                  >
                    <Eye className="w-3 h-3" />
                    查看
                  </button>
              )}
          </div>
        </div>

        <Handle 
          type="source" 
          position={Position.Right} 
          className="!bg-zinc-400 hover:!bg-zinc-900 transition-colors cursor-pointer"
          onClick={(e) => {
            data.onConnectClick?.(id, { x: e.clientX, y: e.clientY });
          }}
        />
      </BaseNodeWrapper>

      {/* Full Screen Prompt Editor */}
      <FullScreenModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={
          <div className="flex items-center gap-2">
             <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-md">
                <Settings2 className="w-4 h-4 text-indigo-600" />
             </div>
             <div>
                <h3 className="text-sm font-semibold text-zinc-800">Prompt 编辑器</h3>
                <p className="text-[10px] text-zinc-500 leading-none">编辑系统指令</p>
             </div>
          </div>
        }
        headerActions={
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 rounded-lg text-xs font-medium transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '已复制' : '复制指令'}
          </button>
        }
      >
        <div className="flex w-full h-full">
            {/* Left Sidebar: Presets */}
            <div className="w-64 bg-zinc-50 border-r border-zinc-200 flex flex-col overflow-y-auto">
                <div className="p-3 pb-2">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <Library className="w-3.5 h-3.5" />
                        模版库
                    </div>
                </div>
                
                <div className="flex-1 p-2 space-y-1">
                    {PRESET_CATEGORIES.map(cat => {
                        const isExpanded = expandedCats.includes(cat.title);
                        return (
                            <div key={cat.title} className="select-none">
                                <button 
                                    onClick={() => toggleCat(cat.title)}
                                    className="w-full flex items-center justify-between p-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
                                >
                                    {cat.title}
                                    {isExpanded ? <ChevronDown className="w-3 h-3 text-zinc-400" /> : <ChevronRight className="w-3 h-3 text-zinc-400" />}
                                </button>
                                
                                {isExpanded && (
                                    <div className="pl-2 mt-1 space-y-0.5 animate-in slide-in-from-left-1 duration-200">
                                        {cat.items.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => loadAndApplyPreset(item)}
                                                disabled={loadingPresetId === item.id}
                                                className="w-full text-left p-2 rounded-md text-xs text-zinc-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-100 flex items-start gap-2 group disabled:opacity-50"
                                                title={item.description}
                                            >
                                                <span className="mt-0.5 text-zinc-400 group-hover:text-indigo-500 transition-colors">
                                                    {loadingPresetId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : item.icon}
                                                </span>
                                                <span>{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Main: Editor */}
            <div className="flex-1 flex flex-col h-full bg-white">
                <div className="px-4 py-2 bg-indigo-50/30 border-b border-indigo-100 flex items-center gap-2 text-[11px] text-indigo-600">
                    <FileText className="w-3 h-3" />
                    <span>提示：在此处编辑长文本指令。支持 Markdown 语法结构，但请注意 API 会将其作为纯文本处理。</span>
                </div>
                
                <textarea
                    className="flex-1 w-full p-8 resize-none focus:outline-none font-mono text-sm text-zinc-800 leading-relaxed bg-white"
                    value={nodeData.systemInstruction}
                    onChange={handlePromptChange}
                    placeholder="在此输入详细的系统提示词，或从左侧选择预设模版..."
                    spellCheck={false}
                />
            </div>
        </div>
      </FullScreenModal>

      {/* Input Content Viewer Modal */}
      <FullScreenModal
        isOpen={isInputViewerOpen}
        onClose={() => setIsInputViewerOpen(false)}
        title={
          <div className="flex items-center gap-2">
             <div className="p-1.5 bg-zinc-100 border border-zinc-200 rounded-md">
                <Eye className="w-4 h-4 text-zinc-600" />
             </div>
             <div>
                <h3 className="text-sm font-semibold text-zinc-800">输入内容预览</h3>
                <p className="text-[10px] text-zinc-500 leading-none">查看流入该节点的原始数据</p>
             </div>
          </div>
        }
      >
         <div className="w-full h-full bg-zinc-50 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-zinc-200 p-8 min-h-[50vh]">
                <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-700 leading-relaxed">
                    {nodeData.inputData}
                </pre>
            </div>
         </div>
      </FullScreenModal>
    </>
  );
};
