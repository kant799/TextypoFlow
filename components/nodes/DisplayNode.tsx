
import React, { useEffect, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Monitor, FileCode, Maximize2, Copy, Check, ExternalLink, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { DisplayNodeData } from '../../types';
import { BaseNodeWrapper } from './BaseNodeWrapper';
import { FullScreenModal } from '../ui/FullScreenModal';

// Helper to extract HTML from Markdown code blocks
export const extractHtmlContent = (content: string): string | null => {
  if (!content) return null;
  
  // 1. Check for markdown code blocks (html or xml)
  const codeBlockRegex = /```(html|xml)\s*([\s\S]*?)\s*```/i;
  const match = content.match(codeBlockRegex);
  if (match && match[2]) {
    const extracted = match[2];
    // Basic validation to ensure it looks like HTML
    if (extracted.includes('<') && extracted.includes('>')) {
        return extracted;
    }
  }

  // 2. Check if it looks like raw HTML (starts with doctype or html tag)
  const trimmed = content.trim();
  if (trimmed.match(/^<!DOCTYPE html>/i) || trimmed.match(/^<html/i)) {
    return content;
  }

  return null;
};

// Helper to ensure HTML is renderable (adds basic structure if missing)
export const normalizeHtml = (html: string) => {
    if (!html.includes('<body')) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>body { padding: 2rem; font-family: system-ui, sans-serif; }</style>
</head>
<body>
    ${html}
</body>
</html>`;
    }
    return html;
};

export const DisplayNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const { updateNodeData } = useReactFlow();
  const nodeData = data as DisplayNodeData;
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Reset zoom when opening full screen
  useEffect(() => {
    if (isFullScreen) {
      setZoom(1);
    }
  }, [isFullScreen]);

  // Auto-detect content type and prepare preview
  useEffect(() => {
    if (nodeData.content) { // Run even on idle if content exists
      const extracted = extractHtmlContent(nodeData.content);
      
      if (extracted) {
        setPreviewHtml(normalizeHtml(extracted));
        if (nodeData.contentType !== 'html') {
          updateNodeData(id, { contentType: 'html' });
        }
      } else {
        setPreviewHtml(null);
        // Simple markdown detection
        const isMd = nodeData.content.includes('# ') || nodeData.content.includes('**') || nodeData.content.includes('```');
        if (nodeData.contentType !== (isMd ? 'markdown' : 'text')) {
          updateNodeData(id, { contentType: isMd ? 'markdown' : 'text' });
        }
      }
    }
  }, [nodeData.content, id, updateNodeData]); 

  const handleCopy = async () => {
      if (!nodeData.content) return;
      
      let textToCopy = nodeData.content;
      
      // Intelligent Copy Logic
      if (nodeData.contentType === 'html') {
          // 1. Try to extract code from markdown block
          const codeBlockRegex = /```(html|xml)\s*([\s\S]*?)\s*```/i;
          const match = nodeData.content.match(codeBlockRegex);
          
          if (match && match[2]) {
             textToCopy = match[2]; // Copy only the code inside the block
          } else {
             // If it's raw HTML or just text that looks like HTML
             textToCopy = nodeData.content;
          }
      }
      // For Markdown/Text, we copy the full content (default behavior)

      try {
          await navigator.clipboard.writeText(textToCopy);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      } catch (err) {
          console.error('Failed to copy:', err);
      }
  };

  const handleOpenNewTab = () => {
      if (!previewHtml) return;
      const blob = new Blob([previewHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
  };

  const handleDownloadHtml = () => {
      if (!previewHtml) return;
      const blob = new Blob([previewHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `textypoflow-export-${Date.now()}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const renderNodeContent = () => {
    if (!nodeData.content) {
      return <div className="text-zinc-400 italic text-xs text-center py-8">等待输出结果...</div>;
    }

    if (nodeData.contentType === 'html' && previewHtml) {
      return (
        <div className="w-full h-64 border border-zinc-200 rounded bg-white overflow-hidden relative group/preview">
             <div className="absolute top-0 left-0 right-0 bg-zinc-100 text-[10px] px-2 py-1 text-zinc-500 border-b border-zinc-200 flex items-center justify-between z-10">
                <div className="flex items-center gap-1">
                    <FileCode className="w-3 h-3" /> HTML 预览
                </div>
             </div>
            <div className="w-full h-full pt-6 bg-white overflow-hidden relative">
                {/* Interaction Trigger (Transparent Layer) */}
                <div 
                    className="absolute inset-0 z-10 bg-transparent cursor-pointer"
                    onClick={() => setIsFullScreen(true)}
                    title="点击全屏预览"
                />
                <iframe 
                    srcDoc={previewHtml} 
                    className="w-[200%] h-[200%] border-none pointer-events-none select-none origin-top-left scale-50" 
                    sandbox="allow-scripts"
                    title="preview-small"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/5 opacity-0 group-hover/preview:opacity-100 transition-opacity z-20 pointer-events-none">
                    <div className="bg-white/90 text-zinc-800 px-3 py-1 rounded-full text-xs font-medium shadow-sm flex items-center gap-1 transform scale-100">
                        <Maximize2 className="w-3 h-3" /> 点击全屏交互
                    </div>
                </div>
            </div>
        </div>
      );
    }

    return (
      <div className="w-full max-h-64 overflow-y-auto p-3 bg-zinc-50 rounded border border-zinc-200 text-xs text-zinc-700 font-mono relative custom-scrollbar">
         {nodeData.contentType === 'markdown' ? (
            <div className="prose prose-zinc prose-sm prose-p:text-xs prose-headings:text-sm max-w-none">
              <ReactMarkdown>{nodeData.content}</ReactMarkdown>
            </div>
         ) : (
            <div className="whitespace-pre-wrap">{nodeData.content}</div>
         )}
      </div>
    );
  };

  return (
    <>
        <BaseNodeWrapper 
          id={id}
          title="结果展示" 
          icon={<Monitor className="w-4 h-4" />} 
          status={nodeData.status}
          selected={selected}
          width="w-96"
        >
          <Handle type="target" position={Position.Left} className="!bg-zinc-400 hover:!bg-zinc-900 transition-colors" />
          
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                        {nodeData.contentType || 'TEXT'}
                    </span>
                    {nodeData.contentType === 'html' && (
                         <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                            <FileCode className="w-3 h-3" /> code
                         </span>
                    )}
                </div>
                
                <div className="flex items-center gap-1">
                    {nodeData.content && (
                        <>
                            <button
                                onClick={() => setIsFullScreen(true)}
                                className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
                                title="全屏查看"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                                onClick={handleCopy}
                                className={`
                                    flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-all
                                    ${copied 
                                        ? 'bg-green-100 text-green-700 border border-green-200' 
                                        : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'}
                                `}
                                title={nodeData.contentType === 'html' ? "仅复制代码" : "复制全部内容"}
                            >
                                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copied ? '已复制' : (nodeData.contentType === 'html' ? '复制代码' : '复制')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {renderNodeContent()}
          </div>
        </BaseNodeWrapper>

        <FullScreenModal
            isOpen={isFullScreen}
            onClose={() => setIsFullScreen(false)}
            title={
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-zinc-100 rounded-md">
                         <Monitor className="w-4 h-4 text-zinc-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-800">
                            {nodeData.contentType === 'html' ? 'HTML 预览' : '结果详情'}
                        </h3>
                    </div>
                </div>
            }
            headerActions={
                <div className="flex items-center gap-3">
                    {/* Zoom Controls for HTML */}
                    {nodeData.contentType === 'html' && (
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
                                title="重置比例"
                            >
                                <RotateCcw className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                    
                    {nodeData.contentType === 'html' && <div className="w-px h-4 bg-zinc-200" />}

                    {/* Icon-only Actions */}
                    {nodeData.contentType === 'html' && (
                        <>
                            <button 
                                onClick={handleDownloadHtml}
                                className="p-2 hover:bg-zinc-100 rounded-md text-zinc-500 hover:text-zinc-900 transition-colors"
                                title="下载 HTML 源码"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={handleOpenNewTab}
                                className="p-2 hover:bg-zinc-100 rounded-md text-zinc-500 hover:text-zinc-900 transition-colors"
                                title="新窗口打开"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </button>
                        </>
                    )}
                     <button 
                        onClick={handleCopy}
                        className="p-2 hover:bg-zinc-100 rounded-md text-zinc-500 hover:text-zinc-900 transition-colors"
                        title={copied ? '已复制' : '复制内容'}
                    >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                </div>
            }
        >
            <div className="w-full h-full bg-zinc-100 overflow-hidden flex flex-col">
                 {nodeData.contentType === 'html' && previewHtml ? (
                     <div className="flex-1 w-full h-full bg-zinc-500/5 relative overflow-hidden">
                         <iframe 
                            srcDoc={previewHtml} 
                            className="border-none origin-top-left transition-all duration-200 ease-in-out bg-white shadow-sm"
                            style={{
                                width: `${100 / zoom}%`,
                                height: `${100 / zoom}%`,
                                transform: `scale(${zoom})`
                            }}
                            sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin allow-top-navigation"
                            title="full-screen-preview"
                         />
                     </div>
                 ) : (
                     <div className="flex-1 overflow-y-auto p-8">
                         <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-zinc-200 p-8 min-h-[50vh]">
                             {nodeData.contentType === 'markdown' ? (
                                <div className="prose prose-zinc prose-sm sm:prose-base max-w-none">
                                    <ReactMarkdown>{nodeData.content}</ReactMarkdown>
                                </div>
                             ) : (
                                <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-700 leading-relaxed">
                                    {nodeData.content}
                                </pre>
                             )}
                         </div>
                     </div>
                 )}
            </div>
        </FullScreenModal>
    </>
  );
};
