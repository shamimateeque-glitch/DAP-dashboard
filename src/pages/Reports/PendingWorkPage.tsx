import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    Upload, Clock, Search, Gavel, FileText, DollarSign, Trash2,
    ArrowLeft, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PendingCounts {
    upload: number;
    decision: number;
    inDepth: number;
    enforcement: number;
    finalReport: number;
    invoices: number;
    destruction: number;
}

interface CardConfig {
    key: keyof PendingCounts;
    title: string;
    description: string;
    icon: React.ElementType;
    gradient: string;
    href: string;
}

// ─── Card configurations ─────────────────────────────────────────────────────

const CARDS: CardConfig[] = [
    {
        key: 'upload',
        title: 'Pending Upload to Client',
        description: 'Cases created but not yet uploaded to client',
        icon: Upload,
        gradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #93c5fd 100%)',
        href: '/pending-work/upload',
    },
    {
        key: 'decision',
        title: 'Waiting for Client Decision',
        description: 'Uploaded cases awaiting client approval or rejection',
        icon: Clock,
        gradient: 'linear-gradient(135deg, #92400e 0%, #f59e0b 50%, #fde68a 100%)',
        href: '/pending-work/decision',
    },
    {
        key: 'inDepth',
        title: 'Pending In-Depth Investigation',
        description: 'Approved cases with in-depth work pending',
        icon: Search,
        gradient: 'linear-gradient(135deg, #3730a3 0%, #6366f1 50%, #a5b4fc 100%)',
        href: '/pending-work/in-depth',
    },
    {
        key: 'enforcement',
        title: 'Pending Enforcement',
        description: 'In-depth done, enforcement action pending',
        icon: Gavel,
        gradient: 'linear-gradient(135deg, #6b21a8 0%, #a855f7 50%, #d8b4fe 100%)',
        href: '/pending-work/enforcement',
    },
    {
        key: 'finalReport',
        title: 'Pending Final Report',
        description: 'Enforcement done, final report not sent to client',
        icon: FileText,
        gradient: 'linear-gradient(135deg, #155e75 0%, #06b6d4 50%, #67e8f9 100%)',
        href: '/pending-work/final-report',
    },
    {
        key: 'invoices',
        title: 'Pending Invoices',
        description: 'Final report sent, invoice not yet issued to client',
        icon: DollarSign,
        gradient: 'linear-gradient(135deg, #9d174d 0%, #ec4899 50%, #f9a8d4 100%)',
        href: '/pending-work/invoices',
    },
    {
        key: 'destruction',
        title: 'Pending Destruction',
        description: 'Enforcement done, destruction of goods pending',
        icon: Trash2,
        gradient: 'linear-gradient(135deg, #991b1b 0%, #ef4444 50%, #fca5a5 100%)',
        href: '/pending-work/destruction',
    },
];

// ─── Animation ───────────────────────────────────────────────────────────────

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

// ─── Gradient Card Component ─────────────────────────────────────────────────

function PendingWorkCard({
    config,
    count,
    isLoading,
    onClick,
}: {
    config: CardConfig;
    count: number;
    isLoading: boolean;
    onClick: () => void;
}) {
    const [hovered, setHovered] = useState(false);
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const Icon = config.icon;

    const edgeBg = isDark
        ? 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)'
        : 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.08) 100%)';
    const borderColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.18)';
    const shadowDefault = isDark
        ? '0 8px 28px -6px rgba(0,0,0,0.35), 0 4px 10px -4px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.15)'
        : '0 8px 28px -6px rgba(0,0,0,0.12), 0 4px 10px -4px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.2)';
    const shadowHover = isDark
        ? '0 16px 40px -8px rgba(0,0,0,0.45), 0 6px 16px -4px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.2)'
        : '0 16px 40px -8px rgba(0,0,0,0.18), 0 6px 16px -4px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.25)';

    return (
        <motion.div
            variants={item}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onClick={onClick}
            className="cursor-pointer"
            style={{ position: 'relative' }}
        >
            {/* 3D bottom edge */}
            <div
                style={{
                    position: 'absolute',
                    left: '4px',
                    right: '4px',
                    bottom: '-6px',
                    height: '14px',
                    background: edgeBg,
                    borderRadius: '0 0 20px 20px',
                    zIndex: 0,
                }}
            />

            {/* Main card */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    transition: 'transform 0.4s ease, box-shadow 0.4s ease',
                    transform: hovered ? 'translateY(-4px)' : 'translateY(0px)',
                    borderRadius: '22px',
                    background: config.gradient,
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: `1px solid ${borderColor}`,
                    boxShadow: hovered ? shadowHover : shadowDefault,
                    padding: '28px 24px',
                    overflow: 'hidden',
                    minHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                }}
            >
                {/* Glossy light reflection */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-30%',
                        left: '-20%',
                        width: '80%',
                        height: '80%',
                        background: isDark
                            ? 'radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, transparent 70%)'
                            : 'radial-gradient(ellipse at center, rgba(255,255,255,0.18) 0%, transparent 70%)',
                        pointerEvents: 'none',
                        zIndex: 0,
                    }}
                />

                {/* Subtle inner glow along top edge */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '50%',
                        background: isDark
                            ? 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)'
                            : 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)',
                        borderRadius: '22px 22px 0 0',
                        pointerEvents: 'none',
                        zIndex: 1,
                    }}
                />

                {/* Pattern circle overlay */}
                <div className="absolute top-0 right-0 p-3 opacity-[0.1]" style={{ zIndex: 0 }}>
                    <svg width="100" height="100" viewBox="0 0 100 100" fill="white">
                        <circle cx="50" cy="50" r="40" />
                    </svg>
                </div>

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    {/* Icon */}
                    <div
                        style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            background: 'rgba(255,255,255,0.2)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '4px',
                        }}
                    >
                        <Icon className="h-5 w-5" style={{ color: 'white' }} />
                    </div>

                    {/* Title */}
                    <p className="text-sm font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        {config.title}
                    </p>

                    {/* Count */}
                    {isLoading ? (
                        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'rgba(255,255,255,0.7)' }} />
                    ) : (
                        <p className="text-5xl font-extrabold tracking-tight" style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                            {count}
                        </p>
                    )}

                    {/* Description badge */}
                    <p
                        className="text-xs font-medium mt-1 px-3 py-1"
                        style={{
                            background: 'rgba(255,255,255,0.18)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            borderRadius: '20px',
                            color: 'rgba(255,255,255,0.9)',
                            border: '1px solid rgba(255,255,255,0.2)',
                        }}
                    >
                        {config.description}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

const PendingWorkPage = () => {
    const navigate = useNavigate();

    const { data: counts, isLoading } = useQuery({
        queryKey: ['pending-work-counts'],
        queryFn: async (): Promise<PendingCounts> => {
            const { data, error } = await supabase
                .from('cases')
                .select(`
                    id,
                    case_status,
                    case_uploads(decision_status),
                    in_depth_stages(status),
                    enforcement_stages(status),
                    final_reports(id, status),
                    invoices(status),
                    destruction_stages(status)
                `);

            if (error) throw error;
            const cases = data || [];

            const getFirst = (rel: any) => (Array.isArray(rel) ? rel[0] : rel);

            let upload = 0;
            let decision = 0;
            let inDepth = 0;
            let enforcement = 0;
            let finalReport = 0;
            let invoices = 0;
            let destruction = 0;

            for (const c of cases) {
                const uploadRec = getFirst(c.case_uploads);
                const inDepthRec = getFirst(c.in_depth_stages);
                const enforcementRec = getFirst(c.enforcement_stages);
                const finalReportRec = getFirst(c.final_reports);
                const invoiceRec = getFirst(c.invoices);
                const destructionRec = getFirst(c.destruction_stages);

                // 1. Pending Upload: IN_HAND (not yet uploaded)
                if (c.case_status === 'IN_HAND') {
                    upload++;
                }

                // 2. Waiting for Decision: UPLOADED (not approved/rejected yet)
                if (c.case_status === 'UPLOADED') {
                    decision++;
                }

                // 3. Pending In-Depth: Approved but in-depth not done
                if (
                    (c.case_status === 'APPROVED' || c.case_status === 'IN_DEPTH') &&
                    (!inDepthRec || inDepthRec.status !== 'DONE')
                ) {
                    inDepth++;
                }

                // 4. Pending Enforcement: In-depth done but enforcement not done
                if (
                    inDepthRec?.status === 'DONE' &&
                    (!enforcementRec || enforcementRec.status !== 'DONE')
                ) {
                    enforcement++;
                }

                // 5. Pending Final Report: Enforcement done but final report not submitted
                if (
                    enforcementRec?.status === 'DONE' &&
                    (!finalReportRec || finalReportRec.status !== 'DONE')
                ) {
                    finalReport++;
                }

                // 6. Pending Invoices: Final report DONE but no invoice issued yet
                if (
                    finalReportRec?.status === 'DONE' &&
                    !invoiceRec
                ) {
                    invoices++;
                }

                // 7. Pending Destruction: Enforcement done but destruction not done
                if (
                    enforcementRec?.status === 'DONE' &&
                    (!destructionRec || destructionRec.status !== 'DONE')
                ) {
                    destruction++;
                }
            }

            return { upload, decision, inDepth, enforcement, finalReport, invoices, destruction };
        },
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Pending Work Status</h2>
                <p className="text-muted-foreground">
                    Track and monitor pending work across all stages of the case lifecycle.
                </p>
            </div>

            {/* Cards Grid */}
            <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                variants={container}
                initial="hidden"
                animate="show"
            >
                {CARDS.map((card) => (
                    <PendingWorkCard
                        key={card.key}
                        config={card}
                        count={counts?.[card.key] ?? 0}
                        isLoading={isLoading}
                        onClick={() => navigate(card.href)}
                    />
                ))}
            </motion.div>
        </div>
    );
};

export default PendingWorkPage;
