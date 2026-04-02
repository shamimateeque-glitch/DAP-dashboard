import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Edit2, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';

interface InlineEditFieldProps {
    value: string | number | null | undefined;
    displayValue?: string;
    onSave: (newValue: string) => Promise<void>;
    canEdit: boolean;
    type?: 'text' | 'number' | 'textarea';
    placeholder?: string;
    className?: string;
    inputClassName?: string;
}

const InlineEditField: React.FC<InlineEditFieldProps> = ({
    value,
    displayValue,
    onSave,
    canEdit,
    type = 'text',
    placeholder = 'Not specified',
    className,
    inputClassName,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const startEditing = () => {
        if (!canEdit) return;
        setTempValue(String(value ?? ''));
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (type === 'number') {
            const num = parseFloat(tempValue);
            if (isNaN(num) || num < 0) {
                toast.error('Please enter a valid number');
                return;
            }
        }
        setIsSaving(true);
        try {
            await onSave(tempValue);
            setIsEditing(false);
        } catch (error: any) {
            if (error?.message !== '__handled__') {
                toast.error(sanitizeErrorMessage(error, 'Error saving'));
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setTempValue(String(value ?? ''));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') handleCancel();
        if (e.key === 'Enter' && type !== 'textarea') handleSave();
        if (e.key === 'Enter' && e.ctrlKey && type === 'textarea') handleSave();
    };

    if (isEditing) {
        return (
            <div className="flex items-start gap-2 w-full">
                {type === 'textarea' ? (
                    <Textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={cn("min-h-[60px] text-sm", inputClassName)}
                        disabled={isSaving}
                    />
                ) : (
                    <Input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type={type}
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={cn("h-8 py-1", inputClassName)}
                        disabled={isSaving}
                    />
                )}
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:bg-green-50"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:bg-red-50"
                        onClick={handleCancel}
                        disabled={isSaving}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }

    const display = displayValue ?? (value != null && value !== '' ? String(value) : placeholder);
    const isEmpty = value == null || value === '';

    return (
        <div className="flex items-center gap-2 group">
            <p
                className={cn(
                    className,
                    isEmpty && "text-muted-foreground italic",
                    canEdit && "cursor-pointer hover:underline decoration-dotted"
                )}
                onClick={startEditing}
            >
                {display}
            </p>
            {canEdit && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={startEditing}
                >
                    <Edit2 className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
};

export default InlineEditField;
