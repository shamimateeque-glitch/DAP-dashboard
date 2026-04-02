import React, { useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Edit2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';

interface InlineEditSelectProps {
    value: string | null | undefined;
    displayValue?: string;
    options: { label: string; value: string }[];
    onSave: (newValue: string) => Promise<void>;
    canEdit: boolean;
    placeholder?: string;
    className?: string;
}

const InlineEditSelect: React.FC<InlineEditSelectProps> = ({
    value,
    displayValue,
    options,
    onSave,
    canEdit,
    placeholder = 'Not specified',
    className,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSelect = async (newValue: string) => {
        if (newValue === value) {
            setIsEditing(false);
            return;
        }
        setIsSaving(true);
        try {
            await onSave(newValue);
            setIsEditing(false);
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error saving'));
        } finally {
            setIsSaving(false);
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 w-full">
                {isSaving ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                    </div>
                ) : (
                    <Select
                        defaultValue={value || undefined}
                        onValueChange={handleSelect}
                        open={true}
                        onOpenChange={(open) => { if (!open) setIsEditing(false); }}
                    >
                        <SelectTrigger className="h-8 w-full">
                            <SelectValue placeholder={placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                            {options.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
        );
    }

    const display = displayValue ?? (value || placeholder);
    const isEmpty = !value;

    return (
        <div className="flex items-center gap-2 group">
            <p
                className={cn(
                    className,
                    isEmpty && "text-muted-foreground italic",
                    canEdit && "cursor-pointer hover:underline decoration-dotted"
                )}
                onClick={() => canEdit && setIsEditing(true)}
            >
                {display}
            </p>
            {canEdit && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setIsEditing(true)}
                >
                    <Edit2 className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
};

export default InlineEditSelect;
