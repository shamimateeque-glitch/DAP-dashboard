import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface DuplicateErrorDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    value: string;
    description: string;
}

const DuplicateErrorDialog: React.FC<DuplicateErrorDialogProps> = ({
    open,
    onClose,
    title,
    value,
    description,
}) => {
    return (
        <AlertDialog open={open} onOpenChange={onClose}>
            <AlertDialogContent className="sm:max-w-[420px]">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                        </div>
                        <AlertDialogTitle>{title}</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="pt-2 space-y-2">
                        <span className="block">
                            The code <span className="font-mono font-semibold text-foreground">"{value}"</span> is already assigned to another record.
                        </span>
                        <span className="block text-xs">
                            {description}
                        </span>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={onClose}>
                        OK, I'll change it
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default DuplicateErrorDialog;
