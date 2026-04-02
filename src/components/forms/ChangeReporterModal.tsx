import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ChangeReporterModalProps {
    caseId: string;
    currentReporter?: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const ChangeReporterModal: React.FC<ChangeReporterModalProps> = ({
    caseId,
    currentReporter,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reporter, setReporter] = useState(currentReporter || '');
    const [reporters, setReporters] = useState<string[]>([]);

    useEffect(() => {
        const fetchReporters = async () => {
            const { data } = await supabase
                .from('cases')
                .select('case_reported_by')
                .not('case_reported_by', 'is', null);

            if (data) {
                const unique = Array.from(new Set(data.map(d => d.case_reported_by).filter(Boolean))).sort();
                setReporters(unique as string[]);
            }
        };
        fetchReporters();
    }, []);

    const handleSubmit = async () => {
        if (!reporter) {
            toast.error("Please select a reporter");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('cases')
                .update({ case_reported_by: reporter })
                .eq('id', caseId);

            if (error) throw error;

            toast.success('Reporter assigned successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error updating reporter'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Assign Case</DialogTitle>
                    <DialogDescription>
                        Change the reporter for this case.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="reporter">Select Reporter</Label>
                        <Select value={reporter} onValueChange={setReporter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a reporter..." />
                            </SelectTrigger>
                            <SelectContent>
                                {reporters.map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {r}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Updating...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ChangeReporterModal;
