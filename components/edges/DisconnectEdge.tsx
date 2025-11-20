
import React, { useState, useCallback, useRef } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
} from '@xyflow/react';
import { Scissors, Unplug } from 'lucide-react';

export const DisconnectEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
}) => {
  const { deleteElements, screenToFlowPosition } = useReactFlow();
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [isBreaking, setIsBreaking] = useState(false);
  
  // Ref to track dragging state without triggering re-renders for global events
  const dragRef = useRef({ startX: 0, startY: 0, currentX: 0, currentY: 0 });

  const pathType = data?.pathType || 'bezier';

  // Select path generation function
  const getPath = pathType === 'smoothstep' ? getSmoothStepPath : getBezierPath;
  const pathOptions = pathType === 'smoothstep' ? { borderRadius: 20 } : {};

  // Calculate the path
  const [edgePath, labelX, labelY] = getPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    ...pathOptions,
  });

  const onPointerDown = (event: React.PointerEvent) => {
    // Prevent React Flow from interpreting this as a canvas drag
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    setIsDragging(true);
    
    // Initial position is the label center
    setDragPos({ x: labelX, y: labelY });
    dragRef.current = { 
        startX: labelX, 
        startY: labelY,
        currentX: labelX,
        currentY: labelY
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!isDragging) return;
    event.stopPropagation();

    // Convert screen movement to flow coordinate delta
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    
    setDragPos({ x: flowPos.x, y: flowPos.y });
    dragRef.current.currentX = flowPos.x;
    dragRef.current.currentY = flowPos.y;
  };

  const onPointerUp = (event: React.PointerEvent) => {
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);

    // Calculate distance from original center
    const dx = dragRef.current.currentX - dragRef.current.startX;
    const dy = dragRef.current.currentY - dragRef.current.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Threshold to break the connection
    if (distance > 100) {
      setIsBreaking(true);
      // Wait for animation then delete
      setTimeout(() => {
        deleteElements({ edges: [{ id }] });
      }, 300);
    } else {
      // Spring back handled by state reset
      setDragPos({ x: labelX, y: labelY });
    }
  };

  // Calculate tension styles
  const dx = dragPos.x - labelX;
  const dy = dragPos.y - labelY;
  const distance = isDragging ? Math.sqrt(dx * dx + dy * dy) : 0;
  
  // Tension color interpolation: Blue -> Red
  const tensionRatio = Math.min(distance / 100, 1);
  const strokeColor = isDragging 
    ? `rgb(${59 + 196 * tensionRatio}, ${130 - 130 * tensionRatio}, ${246 - 246 * tensionRatio})` // Blue-500 to Red-500
    : (style.stroke as string || '#a1a1aa');

  // Logic to determine what to render
  if (isBreaking) {
    return null; 
  }

  return (
    <>
      {/* 1. The Path */}
      {isDragging ? (
        // Tense State: Draw two straight lines to the cursor (rubber band effect)
        <path
          d={`M ${sourceX} ${sourceY} L ${dragPos.x} ${dragPos.y} L ${targetX} ${targetY}`}
          fill="none"
          className="react-flow__edge-path"
          style={{
            ...style,
            stroke: strokeColor,
            strokeWidth: 2,
            strokeDasharray: tensionRatio > 0.8 ? '5,5' : 'none', // Dashed when about to break
            transition: 'stroke 0.1s ease',
          }}
          markerEnd={markerEnd}
        />
      ) : (
        // Normal State: Elegant Bezier Curve or SmoothStep
        <BaseEdge 
            path={edgePath} 
            markerEnd={markerEnd} 
            style={{
                ...style,
                // Highlight if selected
                stroke: selected ? '#3b82f6' : style.stroke
            }} 
        />
      )}

      {/* 2. The Interactive Handle */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${isDragging ? dragPos.x : labelX}px,${isDragging ? dragPos.y : labelY}px)`,
            pointerEvents: 'all',
            zIndex: 0, // Kept low to be below nodes (usually 1000)
            cursor: isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Spring physics on release
          }}
          className="nodrag nopan group p-4" // Increased hit area
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* The Visual Knob */}
          <div 
            className={`
                flex items-center justify-center rounded-full shadow-sm border transition-all duration-200
                ${isDragging 
                    ? (distance > 80 ? 'w-10 h-10 bg-red-500 border-red-600 scale-110' : 'w-8 h-8 bg-blue-500 border-blue-600') 
                    : 'w-1.5 h-1.5 bg-white border-zinc-400 group-hover:w-6 group-hover:h-6 group-hover:border-blue-400 group-hover:shadow-md'}
            `}
          >
            {isDragging ? (
                 <Scissors className={`w-4 h-4 text-white ${distance > 80 ? 'animate-pulse' : ''}`} />
            ) : (
                 <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}
          </div>

          {/* Helper Text appearing on Drag */}
          {isDragging && (
            <div 
                className={`
                    absolute top-12 left-1/2 -translate-x-1/2 text-[8px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap transition-opacity
                    ${distance > 80 ? 'bg-red-100 text-red-600 opacity-100' : 'opacity-0'}
                `}
            >
                松开断开连接
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
