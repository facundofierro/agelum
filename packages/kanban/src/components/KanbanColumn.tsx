'use client';

import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KanbanCard } from './KanbanCard';
import type {
  KanbanColumn as KanbanColumnType,
  KanbanCard as KanbanCardType,
  KanbanColumnColor,
} from '@/types';

interface KanbanColumnProps {
  column: KanbanColumnType;
  cards: KanbanCardType[];
  onAddCard?: (columnId: string) => void;
  onCardEdit?: (card: KanbanCardType) => void;
  onCardDelete?: (cardId: string) => void;
  onCardClick?: (card: KanbanCardType) => void;
}

const columnColorMap: Record<KanbanColumnColor, string> = {
  gray: 'bg-gray-400 dark:bg-gray-500',
  red: 'bg-red-400 dark:bg-red-500',
  orange: 'bg-orange-400 dark:bg-orange-500',
  amber: 'bg-amber-400 dark:bg-amber-500',
  yellow: 'bg-yellow-400 dark:bg-yellow-500',
  lime: 'bg-lime-400 dark:bg-lime-500',
  green: 'bg-green-400 dark:bg-green-500',
  emerald: 'bg-emerald-400 dark:bg-emerald-500',
  teal: 'bg-teal-400 dark:bg-teal-500',
  cyan: 'bg-cyan-400 dark:bg-cyan-500',
  sky: 'bg-sky-400 dark:bg-sky-500',
  blue: 'bg-blue-400 dark:bg-blue-500',
  indigo: 'bg-indigo-400 dark:bg-indigo-500',
  violet: 'bg-violet-400 dark:bg-violet-500',
  purple: 'bg-purple-400 dark:bg-purple-500',
  fuchsia: 'bg-fuchsia-400 dark:bg-fuchsia-500',
  pink: 'bg-pink-400 dark:bg-pink-500',
  rose: 'bg-rose-400 dark:bg-rose-500',
};

export function KanbanColumn({
  column,
  cards,
  onAddCard,
  onCardEdit,
  onCardDelete,
  onCardClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      column,
    },
  });

  const cardIds = cards.map((card) => card.id);
  const color = column.color || 'gray';

  return (
    <div
      className={cn(
        'group flex h-full flex-1 min-w-0 flex-col rounded-2xl transition-all duration-200',
        'bg-gray-800/50 backdrop-blur-sm',
        'border border-gray-700/40',
        isOver && 'bg-gray-700/60 border-blue-500/40'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className={cn('h-2.5 w-2.5 rounded-full shadow-sm', columnColorMap[color])} />
          <h3 className="font-semibold text-sm text-gray-200">{column.title}</h3>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-gray-700/60 px-1.5 text-[11px] font-medium text-gray-400">
            {cards.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddCard && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
              onClick={() => onAddCard(column.id)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Cards Container */}
      <ScrollArea className="flex-1 px-2.5">
        <div
          ref={setNodeRef}
          className={cn(
            'flex flex-col gap-2.5 pb-2.5 min-h-[80px] transition-colors duration-200 rounded-xl',
            isOver && 'bg-gray-700/30'
          )}
        >
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                onEdit={onCardEdit}
                onDelete={onCardDelete}
                onClick={onCardClick}
              />
            ))}
          </SortableContext>
          {cards.length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-gray-500">
              No cards
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add Card Button */}
      {onAddCard && (
        <div className="p-2.5 pt-0">
          <Button
            variant="ghost"
            className="w-full h-9 justify-center gap-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-xl text-xs font-normal border border-dashed border-gray-600/40 hover:border-gray-500/50 transition-all"
            onClick={() => onAddCard(column.id)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add card
          </Button>
        </div>
      )}
    </div>
  );
}
