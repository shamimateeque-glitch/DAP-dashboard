import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Edit2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';

interface InlineEditDateProps {
    value: string | null | undefined;
    onSave: (newValue: string) => Promise<void>;
    canEdit: boolean;
    placeholder?: string;
    className?: string;
    displayFormat?: string;
}

const toLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
};

const InlineEditDate: React.FC<InlineEditDateProps> = ({
    value,
    onSave,
    canEdit,
    placeholder = 'Not set',
    className,
    displayFormat = 'MMM dd, yyyy',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSelect = async (date: Date | undefined) => {
        if (!date) return;
        const dateStr = format(date, 'yyyy-MM-dd');
        if (dateStr === value) {
            setIsOpen(false);
            return;
        }
        setIsSaving(true);
        try {
            await onSave(dateStr);
            setIsOpen(false);
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error saving date'));
        } finally {
            setIsSaving(false);
        }
    };

    const displayText = value ? format(toLocalDate(value), displayFormat) : placeholder;
    const isEmpty = !value;

    return (
        <div className="flex items-center gap-2 group">
            {isSaving ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                </div>
            ) : (
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                        <p
                            className={cn(
                                className,
                                isEmpty && "text-muted-foreground italic",
                                canEdit && "cursor-pointer hover:underline decoration-dotted"
                            )}
                            onClick={() => canEdit && setIsOpen(true)}
                        >
                            {displayText}
                        </p>
                    </PopoverTrigger>
                    {canEdit && (
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={value ? toLocalDate(value) : undefined}
                                onSelect={handleSelect}
                                initialFocus
                            />
                        </PopoverContent>
                    )}
                </Popover>
            )}
            {canEdit && !isOpen && !isSaving && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setIsOpen(true)}
                >
                    <Edit2 className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
};

export default InlineEditDate;
