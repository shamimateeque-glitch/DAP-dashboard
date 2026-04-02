import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Columns, RotateCcw } from 'lucide-react';
import { TableHead } from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ColumnDef {
    key: string;
    label: string;
    defaultVisible?: boolean; // default: true
    locked?: boolean;         // cannot be hidden
}

// ---------------------------------------------------------------------------
// useColumnState hook — manages visibility + order, persists to localStorage
// ---------------------------------------------------------------------------
export function useColumnState(defs: ColumnDef[], storageKey: string) {
    const getInitial = (): { order: string[]; hidden: string[] } => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return {
            order: defs.map(d => d.key),
            hidden: defs.filter(d => d.defaultVisible === false).map(d => d.key),
        };
    };

    const [state, setState] = useState(getInitial);

    // Persist on change
    useEffect(() => {
        try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* ignore */ }
    }, [state, storageKey]);

    // If defs change (e.g. new columns added), merge them in
    useEffect(() => {
        setState(prev => {
            const existingKeys = new Set(prev.order);
            const newKeys = defs.map(d => d.key).filter(k => !existingKeys.has(k));
            if (newKeys.length === 0) return prev;
            return { ...prev, order: [...prev.order, ...newKeys] };
        });
    }, [defs]);

    const columns: ColumnDef[] = state.order
        .map(key => defs.find(d => d.key === key))
        .filter(Boolean) as ColumnDef[];

    const visibleKeys = new Set(
        columns
            .filter(c => !state.hidden.includes(c.key) || c.locked)
            .map(c => c.key)
    );

    const toggle = (key: string) => {
        const def = defs.find(d => d.key === key);
        if (def?.locked) return; // cannot hide locked columns
        setState(prev => ({
            ...prev,
            hidden: prev.hidden.includes(key)
                ? prev.hidden.filter(k => k !== key)
                : [...prev.hidden, key],
        }));
    };

    const reorder = useCallback((fromIdx: number, toIdx: number) => {
        setState(prev => {
            const newOrder = [...prev.order];
            const [moved] = newOrder.splice(fromIdx, 1);
            newOrder.splice(toIdx, 0, moved);
            return { ...prev, order: newOrder };
        });
    }, []);

    const resetToDefault = () => {
        setState({
            order: defs.map(d => d.key),
            hidden: defs.filter(d => d.defaultVisible === false).map(d => d.key),
        });
    };

    return { columns, visibleKeys, toggle, reorder, resetToDefault };
}

// ---------------------------------------------------------------------------
// ColumnSelector component — checkboxes only, no drag handles
// ---------------------------------------------------------------------------
interface ColumnSelectorProps {
    defs: ColumnDef[];
    storageKey: string;
    onChange: (visibleCols: ColumnDef[]) => void;
    /** Called once on mount to pass back the reorder fn for DraggableHeader */
    onReorder?: (reorderFn: (from: number, to: number) => void) => void;
    /** Called whenever the full column list (including hidden) changes order */
    onColumnsChange?: (allCols: ColumnDef[]) => void;
}

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({ defs, storageKey, onChange, onReorder, onColumnsChange }) => {
    const { columns, visibleKeys, toggle, reorder, resetToDefault } = useColumnState(defs, storageKey);
    const [open, setOpen] = useState(false);

    // Use refs for callbacks to avoid infinite re-render loops
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onReorderRef = useRef(onReorder);
    onReorderRef.current = onReorder;
    const onColumnsChangeRef = useRef(onColumnsChange);
    onColumnsChangeRef.current = onColumnsChange;

    // Expose reorder function to parent (reorder is stable via useCallback)
    useEffect(() => {
        if (onReorderRef.current) onReorderRef.current(reorder);
    }, [reorder]);

    // Derive a stable key for visible columns to avoid infinite loops
    const visibleKeyStr = columns.filter(c => visibleKeys.has(c.key)).map(c => c.key).join(',');
    const orderKeyStr = columns.map(c => c.key).join(',');

    // Notify parent whenever visible columns change
    useEffect(() => {
        onChangeRef.current(columns.filter(c => visibleKeys.has(c.key)));
    }, [visibleKeyStr]); // eslint-disable-line react-hooks/exhaustive-deps

    // Notify parent whenever full column order changes
    useEffect(() => {
        if (onColumnsChangeRef.current) onColumnsChangeRef.current(columns);
    }, [orderKeyStr]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Columns className="h-4 w-4" />
                    Columns
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="end">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-sm font-medium">Show / Hide</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground gap-1"
                        onClick={resetToDefault}
                    >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                    </Button>
                </div>
                <div className="max-h-80 overflow-y-auto py-1">
                    {columns.map((col) => {
                        const visible = visibleKeys.has(col.key);
                        return (
                            <div
                                key={col.key}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer select-none"
                                onClick={() => toggle(col.key)}
                            >
                                <div className={`h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center ${visible ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                                    {visible && (
                                        <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <span className={`text-sm flex-1 ${col.locked ? 'text-muted-foreground' : ''}`}>
                                    {col.label}
                                    {col.locked && <span className="text-xs text-muted-foreground ml-1">(locked)</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
};

// ---------------------------------------------------------------------------
// DraggableHeader — renders draggable <TableHead> elements for column reorder
// ---------------------------------------------------------------------------
interface DraggableHeaderProps {
    cols: ColumnDef[];
    /** All columns in their full order (including hidden). Needed to map visible indices → full order indices. */
    allColumns: ColumnDef[];
    onReorder: (fromIdx: number, toIdx: number) => void;
}

export const DraggableHeader: React.FC<DraggableHeaderProps> = ({ cols, allColumns, onReorder }) => {
    const dragIdx = useRef<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    // Map a visible column index → index in the full order array
    const toFullIdx = (visibleIdx: number): number => {
        const key = cols[visibleIdx]?.key;
        return allColumns.findIndex(c => c.key === key);
    };

    const handleDragStart = (e: React.DragEvent, idx: number) => {
        dragIdx.current = idx;
        e.dataTransfer.effectAllowed = 'move';
        const el = e.currentTarget as HTMLElement;
        el.style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.currentTarget as HTMLElement).style.opacity = '1';
        setDragOverIdx(null);
        dragIdx.current = null;
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIdx(idx);
    };

    const handleDragLeave = () => {
        setDragOverIdx(null);
    };

    const handleDrop = (e: React.DragEvent, toIdx: number) => {
        e.preventDefault();
        if (dragIdx.current !== null && dragIdx.current !== toIdx) {
            onReorder(toFullIdx(dragIdx.current), toFullIdx(toIdx));
        }
        dragIdx.current = null;
        setDragOverIdx(null);
    };

    return (
        <>
            {cols.map((col, idx) => (
                <TableHead
                    key={col.key}
                    draggable={!col.locked}
                    onDragStart={e => handleDragStart(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, idx)}
                    className={`text-xs whitespace-nowrap select-none ${
                        !col.locked ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${
                        dragOverIdx === idx ? 'border-l-2 border-primary' : ''
                    }`}
                >
                    {col.label}
                </TableHead>
            ))}
        </>
    );
};

export default ColumnSelector;
