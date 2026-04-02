import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CaseStatus } from '@/types/database';

interface StatusBadgeProps {
    status: CaseStatus;
}

const statusStyles: Record<CaseStatus, string> = {
    IN_HAND: 'bg-gray-500/20 text-gray-400 border-gray-500/50 hover:bg-gray-500/20',
    UPLOADED: 'bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/20',
    APPROVED: 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/20',
    REJECTED: 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/20',
    IN_DEPTH: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50 hover:bg-indigo-500/20',
    ENFORCEMENT: 'bg-purple-500/20 text-purple-400 border-purple-500/50 hover:bg-purple-500/20',
    DESTRUCTION: 'bg-orange-500/20 text-orange-400 border-orange-500/50 hover:bg-orange-500/20',
    CLOSED: 'bg-violet-500/20 text-violet-400 border-violet-500/50 hover:bg-violet-500/20',
};

const statusLabels: Record<CaseStatus, string> = {
    IN_HAND: 'In Hand',
    UPLOADED: 'Uploaded',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    IN_DEPTH: 'In Depth',
    ENFORCEMENT: 'Enforcement',
    DESTRUCTION: 'Destruction',
    CLOSED: 'Closed',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    return (
        <Badge className={`${statusStyles[status]} font-semibold`} variant="outline">
            {statusLabels[status]}
        </Badge>
    );
};

export default StatusBadge;
