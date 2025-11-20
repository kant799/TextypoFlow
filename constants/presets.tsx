
import React from 'react';
import { 
  Wand2, 
  FileText, 
  Languages, 
  CreditCard, 
  Image, 
  BarChart3, 
  LayoutTemplate 
} from 'lucide-react';
import { NodeType } from '../types';

export interface PresetItem {
  id: string;
  label: string;
  description: string;
  type: NodeType;
  icon: React.ReactNode;
  // New properties to handle file fetching
  promptPath: string;
  basePath: string; 
}

export interface PresetCategory {
  title: string;
  items: PresetItem[];
}

// Paths for base instructions
const BASE_HTML_PATH = 'prompts/common-html.txt';
const BASE_TEXT_PATH = 'prompts/common-text.txt';

/**
 * 预设节点配置库 (精简版)
 * Files are referenced by path and loaded at runtime.
 */
export const PRESET_CATEGORIES: PresetCategory[] = [
  {
    title: "效率工具",
    items: [
      {
        id: 'polish',
        label: '智能润色',
        description: '优化文本的语气、语法与流畅度',
        type: NodeType.PROCESSOR,
        icon: <Wand2 className="w-4 h-4" />,
        promptPath: 'prompts/polish.txt',
        basePath: BASE_TEXT_PATH
      },
      {
        id: 'summarize',
        label: '核心摘要',
        description: '快速提取长文本的关键信息',
        type: NodeType.PROCESSOR,
        icon: <FileText className="w-4 h-4" />,
        promptPath: 'prompts/summarize.txt',
        basePath: BASE_TEXT_PATH
      },
      {
        id: 'translate',
        label: '中英互译',
        description: '专业、地道的双语互译助手',
        type: NodeType.PROCESSOR,
        icon: <Languages className="w-4 h-4" />,
        promptPath: 'prompts/translate.txt',
        basePath: BASE_TEXT_PATH
      }
    ]
  },
  {
    title: "视觉创作",
    items: [
      {
        id: 'card',
        label: '社交卡片',
        description: '生成适合社媒分享的精致卡片',
        type: NodeType.PROCESSOR,
        icon: <CreditCard className="w-4 h-4" />,
        promptPath: 'prompts/card.txt',
        basePath: BASE_HTML_PATH
      },
      {
        id: 'poster',
        label: '海报设计',
        description: '极具视觉冲击力的活动海报',
        type: NodeType.PROCESSOR,
        icon: <LayoutTemplate className="w-4 h-4" />,
        promptPath: 'prompts/poster.txt',
        basePath: BASE_HTML_PATH
      },
      {
        id: 'card-cover',
        label: '封面设计',
        description: '文章或视频的封面图生成',
        type: NodeType.PROCESSOR,
        icon: <Image className="w-4 h-4" />,
        promptPath: 'prompts/cardCover.txt',
        basePath: BASE_HTML_PATH
      },
      {
        id: 'info-density',
        label: '信息图表',
        description: '高密度数据的可视化排版',
        type: NodeType.PROCESSOR,
        icon: <BarChart3 className="w-4 h-4" />,
        promptPath: 'prompts/infoDensity.txt',
        basePath: BASE_HTML_PATH
      }
    ]
  }
];

export const FLATTENED_PRESETS = PRESET_CATEGORIES.flatMap(c => c.items);
