
import React, { useCallback, useEffect, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Link as LinkIcon, Type, Upload, Maximize2, X, FileText, Layers } from 'lucide-react';
import { InputNodeData, NodeStatus } from '../../types';
import { BaseNodeWrapper } from './BaseNodeWrapper';
import { FullScreenModal } from '../ui/FullScreenModal';

export const InputNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const { updateNodeData } = useReactFlow();
  const nodeData = data as InputNodeData;
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Centralized logic to update the combined value whenever any component part changes
  const updateCombinedValue = useCallback((updates: Partial<InputNodeData>) => {
    const currentData = { ...nodeData, ...updates };
    
    const parts = [];
    
    // 1. Text Content
    if (currentData.textValue?.trim()) {
      parts.push(currentData.textValue.trim());
    }
    
    // 2. URL Context
    if (currentData.urlValue?.trim()) {
      parts.push(`Context URL: ${currentData.urlValue.trim()}`);
    }
    
    // 3. File Content
    if (currentData.fileContent) {
      parts.push(`File Content (${currentData.fileName || 'uploaded file'}):\n${currentData.fileContent}`);
    }
    
    const combinedValue = parts.join('\n\n---\n\n');

    updateNodeData(id, {
      ...updates,
      value: combinedValue,
      // Reset status when input changes so downstream knows it's fresh
      status: NodeStatus.IDLE 
    });
  }, [id, nodeData, updateNodeData]);

  // Handle legacy data migration once on mount
  useEffect(() => {
    if (nodeData.value && !nodeData.textValue && !nodeData.urlValue && !nodeData.fileContent) {
      updateNodeData(id, { textValue: nodeData.value });
    }
  }, []);

  const handleTextChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateCombinedValue({ textValue: evt.target.value });
  };

  const handleUrlChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    updateCombinedValue({ urlValue: evt.target.value });
  };

  const handleFileUpload = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
         updateCombinedValue({ 
           fileContent: e.target?.result as string, 
           fileName: file.name 
         });
      };
      reader.readAsText(file);
    }
  };

  const clearFile = () => {
    updateCombinedValue({ fileContent: undefined, fileName: undefined });
  };

  // Calculate active inputs count for UI feedback
  const activeInputs = [
    !!nodeData.textValue, 
    !!nodeData.urlValue, 
    !!nodeData.fileContent
  ].filter(Boolean).length;

  return (
    <>
      <BaseNodeWrapper 
        id={id}
        title="多模态输入" 
        icon={<Layers className="w-4 h-4 text-blue-500" />} 
        status={nodeData.status}
        selected={selected}
      >
        <div className="space-y-3">
           {/* Active Inputs Indicator */}
           {activeInputs > 1 && (
             <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1.5">
               <Layers className="w-3 h-3" />
               <span>{activeInputs} 个输入源将合并发送</span>
             </div>
           )}

          {/* Text Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-zinc-500 flex items-center gap-1">
                <Type className="w-3 h-3" /> 文本内容
              </label>
              <button 
                onClick={() => setIsEditorOpen(true)}
                className="text-[10px] text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1"
                title="全屏编辑"
              >
                <Maximize2 className="w-3 h-3" /> 展开
              </button>
            </div>
            <textarea
              className="nodrag w-full h-20 p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none font-mono text-zinc-600"
              placeholder="输入提示词或上下文..."
              value={nodeData.textValue || ''}
              onChange={handleTextChange}
            />
          </div>

          {/* URL Section */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-zinc-500 flex items-center gap-1">
              <LinkIcon className="w-3 h-3" /> URL 引用
            </label>
            <div className="flex items-center gap-2 border border-zinc-200 rounded-md px-2 bg-zinc-50 focus-within:ring-1 focus-within:ring-zinc-900 focus-within:border-zinc-900 transition-all">
                <input
                    type="text"
                    className="nodrag w-full py-1.5 text-xs bg-transparent focus:outline-none text-zinc-600"
                    placeholder="https://..."
                    value={nodeData.urlValue || ''}
                    onChange={handleUrlChange}
                />
            </div>
          </div>

          {/* File Section */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-zinc-500 flex items-center gap-1">
              <Upload className="w-3 h-3" /> 文件上下文
            </label>
            
            {!nodeData.fileContent ? (
               <div className="relative group w-full h-16 border-2 border-dashed border-zinc-200 rounded-md flex flex-col items-center justify-center bg-zinc-50 transition-colors hover:bg-zinc-100 hover:border-zinc-300">
                   <input 
                      type="file" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer nodrag"
                      onChange={handleFileUpload}
                      accept=".txt,.md,.json,.csv,.html,.js,.ts,.py"
                   />
                   <div className="flex flex-col items-center gap-1 text-zinc-400">
                      <Upload className="w-4 h-4" />
                      <span className="text-[10px]">拖拽或点击上传文件</span>
                   </div>
               </div>
            ) : (
              <div className="flex items-center justify-between p-2 bg-zinc-100 border border-zinc-200 rounded-md group">
                 <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-6 h-6 rounded bg-white border border-zinc-200 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-zinc-700 truncate max-w-[120px]" title={nodeData.fileName}>
                            {nodeData.fileName}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                            {(nodeData.fileContent.length / 1024).toFixed(1)} KB
                        </span>
                    </div>
                 </div>
                 <button 
                    onClick={clearFile}
                    className="p-1 hover:bg-zinc-200 rounded-md text-zinc-400 hover:text-zinc-600 transition-colors"
                    title="移除文件"
                 >
                    <X className="w-3.5 h-3.5" />
                 </button>
              </div>
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

      <FullScreenModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={
          <div className="flex items-center gap-2">
             <div className="p-1.5 bg-white border border-zinc-200 rounded-md">
                <FileText className="w-4 h-4 text-zinc-600" />
             </div>
             <div>
                <h3 className="text-sm font-semibold text-zinc-800">输入内容编辑器</h3>
                <p className="text-[10px] text-zinc-500 leading-none">编辑长文本输入</p>
             </div>
          </div>
        }
      >
         <div className="w-full h-full bg-white flex flex-col">
            <textarea
                className="flex-1 w-full p-8 resize-none focus:outline-none font-mono text-sm text-zinc-800 leading-relaxed"
                placeholder="在此输入详细文本内容..."
                value={nodeData.textValue || ''}
                onChange={handleTextChange}
                autoFocus
            />
         </div>
      </FullScreenModal>
    </>
  );
};
