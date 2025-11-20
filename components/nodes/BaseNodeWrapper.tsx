import React, { ReactNode } from 'react';
import { NodeStatus } from '../../types';
import { AlertCircle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';

interface BaseNodeWrapperProps {
  id: string;
  title: string;
  icon: ReactNode;
  status: NodeStatus;
  children: ReactNode;
  selected?: boolean;
  className?: string;
  width?: string;
}

export const BaseNodeWrapper: React.FC<BaseNodeWrapperProps> = ({
  id,
  title,
  icon,
  status,
  children,
  selected,
  className = '',
  width = 'w-80'
}) => {
  const { deleteElements } = useReactFlow();
  
  let statusColor = "border-zinc-200 bg-white";
  let shadow = "shadow-sm";
  
  if (selected) {
    statusColor = "border-zinc-400 ring-1 ring-zinc-400 bg-white";
  }

  if (status === NodeStatus.RUNNING) {
    statusColor = "border-blue-500 bg-white ring-2 ring-blue-500/20 node-running";
  } else if (status === NodeStatus.SUCCESS) {
    statusColor = "border-green-500 bg-white";
    shadow = "shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)]";
  } else if (status === NodeStatus.ERROR) {
    statusColor = "border-red-500 bg-red-50";
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div className={`${width} rounded-xl border ${statusColor} ${shadow} transition-all duration-300 flex flex-col ${className} group/node`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 rounded-t-xl">
        <div className="flex items-center gap-2 text-zinc-700 font-semibold text-sm">
          <span className="text-zinc-500">{icon}</span>
          {title}
        </div>
        <div className="flex items-center gap-2">
          {status === NodeStatus.RUNNING && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
          {status === NodeStatus.SUCCESS && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          {status === NodeStatus.ERROR && <AlertCircle className="w-4 h-4 text-red-500" />}
          
          <button 
            onClick={handleDelete}
            className="opacity-0 group-hover/node:opacity-100 focus:opacity-100 transition-opacity text-zinc-400 hover:text-red-500 hover:bg-red-50 p-1 rounded"
            title="删除节点"
            aria-label="Delete node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};