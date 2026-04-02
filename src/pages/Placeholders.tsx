import React from 'react';

interface PagePlaceholderProps {
    title: string;
}

export const PagePlaceholder: React.FC<PagePlaceholderProps> = ({ title }) => {
    return (
        <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
            <div className="rounded-md border border-dashed p-24 flex items-center justify-center text-muted-foreground bg-card">
                <p>{title} page content will be implemented in the next phase.</p>
            </div>
        </div>
    );
};


export const CasesPage = () => <PagePlaceholder title="All Cases" />;
export const UploadedPage = () => <PagePlaceholder title="Uploaded Cases" />;
export const ApprovedPage = () => <PagePlaceholder title="Approved Cases" />;
export const InvoicesPage = () => <PagePlaceholder title="Invoices" />;
export const ReportsPage = () => <PagePlaceholder title="Reports" />;
export const SettingsPage = () => <PagePlaceholder title="System Settings" />;
