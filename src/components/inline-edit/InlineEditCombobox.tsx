import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Edit2, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';

interface InlineEditComboboxProps {
    value: string | null | undefined;
    options: string[];
    onSave: (newValue: string) => Promise<void>;
    canEdit: boolean;
    placeholder?: string;
    className?: string;
    allowAdd?: boolean;
}

const InlineEditCombobox: React.FC<InlineEditComboboxProps> = ({
    value,
    options,
    onSave,
    canEdit,
    placeholder = 'Not specified',
    className,
    allowAdd = true,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [search, setSearch] = useState('');

    const handleSelect = async (selectedValue: string) => {
        if (selectedValue === value) {
            setIsOpen(false);
            return;
        }
        setIsSaving(true);
        setIsOpen(false);
        try {
            await onSave(selectedValue);
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error saving'));
        } finally {
            setIsSaving(false);
            setSearch('');
        }
    };

    const filteredOptions = options.filter((opt) =>
        opt.toLowerCase().includes(search.toLowerCase())
    );
    const showAddNew = search.trim() && !filteredOptions.some(o => o.toLowerCase() === search.toLowerCase());

    const display = value || placeholder;
    const isEmpty = !value;

    return (
        <div className="flex items-center gap-2 group">
            {isSaving ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                </div>
            ) : (
                <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setSearch(''); }}>
                    <PopoverTrigger asChild>
                        <p
                            className={cn(
                                className,
                                isEmpty && "text-muted-foreground italic",
                                canEdit && "cursor-pointer hover:underline decoration-dotted"
                            )}
                            onClick={() => canEdit && setIsOpen(true)}
                        >
                            {display}
                        </p>
                    </PopoverTrigger>
                    {canEdit && (
                        <PopoverContent className="w-[220px] p-0" align="start">
                            <Command>
                                <CommandInput
                                    placeholder="Search..."
                                    value={search}
                                    onValueChange={setSearch}
                                />
                                <CommandList>
                                    <CommandEmpty>
                                        {search.trim() ? 'No matches found.' : 'No options.'}
                                    </CommandEmpty>
                                    <CommandGroup>
                                        {filteredOptions.map((opt) => (
                                            <CommandItem
                                                key={opt}
                                                value={opt}
                                                onSelect={() => handleSelect(opt)}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                                                {opt}
                                            </CommandItem>
                                        ))}
                                        {allowAdd && showAddNew && (
                                            <CommandItem
                                                value={`__add__${search}`}
                                                onSelect={() => handleSelect(search.trim())}
                                            >
                                                + Add "{search.trim()}"
                                            </CommandItem>
                                        )}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
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

export default InlineEditCombobox;
