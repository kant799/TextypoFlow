
import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Image as ImageIcon, Download, Maximize2, ChevronDown, Eye, LayoutTemplate } from 'lucide-react';
import { ImageGenNodeData, NodeStatus } from '../../types';
import { BaseNodeWrapper } from './BaseNodeWrapper';
import { FullScreenModal } from '../ui/FullScreenModal';

const ASPECT_RATIOS = [
  '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '4:5', '21:9'
];

export const ImageGenNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const { updateNodeData } = useReactFlow();
  const nodeData = data as ImageGenNodeData;
  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);

  const handlePromptChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { prompt: evt.target.value, status: NodeStatus.IDLE });
  }, [id, updateNodeData]);

  const handleRatioSelect = (ratio: string) => {
    updateNodeData(id, { aspectRatio: ratio, status: NodeStatus.IDLE });
    setIsRatioOpen(false);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nodeData.generatedImage) return;
    
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${nodeData.generatedImage}`;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <BaseNodeWrapper 
        id={id}
        title="AI 绘图" 
        icon={<ImageIcon className="w-4 h-4 text-purple-500" />} 
        status={nodeData.status}
        selected={selected}
        width="w-80"
        className="border-purple-200"
      >
        <Handle type="target" position={Position.Left} className="!bg-zinc-400 hover:!bg-zinc-900 transition-colors" />
        
        <div className="space-y-3">
          {/* Prompt Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-zinc-500 flex items-center justify-between">
              <span>画面描述</span>
              {nodeData.inputData && (
                 <span className="text-green-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    已接收上下文
                 </span>
              )}
            </label>
            <textarea
              className="nodrag w-full h-20 p-2 text-xs bg-purple-50/30 border border-purple-100 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none font-mono text-zinc-700 placeholder-purple-300"
              placeholder="描述你想要生成的画面..."
              value={nodeData.prompt}
              onChange={handlePromptChange}
            />
          </div>

          {/* Aspect Ratio Selector */}
          <div className="relative">
            <button 
                onClick={() => setIsRatioOpen(!isRatioOpen)}
                className="w-full flex items-center justify-between p-2 bg-white border border-zinc-200 rounded-md hover:border-purple-400 transition-colors group"
            >
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                    <LayoutTemplate className="w-3.5 h-3.5 text-zinc-400 group-hover:text-purple-500" />
                    <span className="text-zinc-400 text-[10px]">比例:</span>
                    <span className="font-medium">{nodeData.aspectRatio || '1:1'}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {isRatioOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-xl z-20 max-h-48 overflow-y-auto p-1 grid grid-cols-3 gap-1">
                    {ASPECT_RATIOS.map(ratio => (
                        <button
                            key={ratio}
                            onClick={() => handleRatioSelect(ratio)}
                            className={`
                                text-xs py-1.5 rounded hover:bg-purple-50 transition-colors
                                ${nodeData.aspectRatio === ratio ? 'bg-purple-100 text-purple-700 font-medium' : 'text-zinc-600'}
                            `}
                        >
                            {ratio}
                        </button>
                    ))}
                </div>
            )}
          </div>

          {/* Image Display Area */}
          {nodeData.generatedImage ? (
              <div className="relative w-full aspect-square bg-zinc-100 rounded-md overflow-hidden group border border-zinc-200">
                  <img 
                    src={`data:image/png;base64,${nodeData.generatedImage}`} 
                    alt="Generated" 
                    className="w-full h-full object-contain bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMCAwSDRWNEgwem00IDRIOFY4SDR6IiBmaWxsPSIjZjRZjRjOCIgZmlsbC1vcGFjaXR5PSIwLjQiLz48L3N2Zz4=')] bg-repeat"
                  />
                  
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setIsImagePreviewOpen(true)}
                        className="p-2 bg-white/90 rounded-full hover:bg-white hover:scale-110 transition-all text-zinc-800"
                        title="全屏预览"
                      >
                          <Maximize2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={handleDownload}
                        className="p-2 bg-white/90 rounded-full hover:bg-white hover:scale-110 transition-all text-zinc-800"
                        title="下载图片"
                      >
                          <Download className="w-4 h-4" />
                      </button>
                  </div>
              </div>
          ) : (
             <div className="w-full h-32 bg-zinc-50 border border-dashed border-zinc-200 rounded-md flex flex-col items-center justify-center text-zinc-400 gap-2">
                 <ImageIcon className="w-5 h-5 opacity-20" />
                 <span className="text-[10px]">等待生成...</span>
             </div>
          )}

          {nodeData.status === NodeStatus.ERROR && (
              <div className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">
                  错误: {nodeData.errorMessage || "生成失败"}
              </div>
          )}
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
        isOpen={isImagePreviewOpen}
        onClose={() => setIsImagePreviewOpen(false)}
        title={
          <div className="flex items-center gap-2">
             <div className="p-1.5 bg-purple-100 rounded-md">
                <ImageIcon className="w-4 h-4 text-purple-600" />
             </div>
             <div>
                <h3 className="text-sm font-semibold text-zinc-800">图片预览</h3>
                <p className="text-[10px] text-zinc-500 leading-none">{nodeData.prompt ? nodeData.prompt.slice(0, 30) + '...' : 'AI 生成结果'}</p>
             </div>
          </div>
        }
        headerActions={
            <button 
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg text-xs font-medium transition-all"
            >
                <Download className="w-3.5 h-3.5" />
                下载原图
            </button>
        }
      >
         <div className="w-full h-full bg-zinc-950 flex items-center justify-center p-4">
             {nodeData.generatedImage && (
                 <img 
                    src={`data:image/png;base64,${nodeData.generatedImage}`} 
                    alt="Full Preview" 
                    className="max-w-full max-h-full object-contain shadow-2xl"
                 />
             )}
         </div>
      </FullScreenModal>
    </>
  );
};
