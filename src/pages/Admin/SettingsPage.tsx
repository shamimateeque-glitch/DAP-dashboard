import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { sanitizeErrorMessage, validateImageFile } from '@/lib/security';
import {
    Save,
    Hash,
    Calendar,
    Building,
    ArrowLeft,
    RefreshCcw,
    Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SettingsPage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [localSettings, setLocalSettings] = useState<Record<string, any>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const { data: settings, isLoading } = useQuery({
        queryKey: ['system-settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('system_settings')
                .select('*');
            if (error) throw error;
            return data;
        }
    });

    useEffect(() => {
        if (settings) {
            const initialSettings = settings.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});
            setLocalSettings(initialSettings);
        }
    }, [settings]);

    const handleChange = (key: string, field: string, value: any) => {
        setLocalSettings(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const validation = validateImageFile(file);
        if (!validation.valid) {
            toast.error(validation.error!);
            return;
        }

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('branding')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('branding')
                .getPublicUrl(fileName);

            handleChange('company_info', 'logo_url', data.publicUrl);
            toast.success('Logo uploaded successfully. Don\'t forget to save changes.');
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error uploading logo'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates = Object.entries(localSettings).map(([key, value]) =>
                supabase
                    .from('system_settings')
                    .update({ value, updated_at: new Date().toISOString() })
                    .eq('key', key)
            );

            const results = await Promise.all(updates);

            const errors = results.filter(r => r.error);
            if (errors.length > 0) throw errors[0].error;

            queryClient.invalidateQueries({ queryKey: ['system-settings'] });
            toast.success('Settings saved successfully');
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error saving settings'));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                    <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
                    <p>Loading system settings...</p>
                </div>
            </div>
        );
    }

    const workflowDefaults = localSettings['workflow_defaults'] || {};
    const idPrefixes = localSettings['id_prefixes'] || {};
    const companyInfo = localSettings['company_info'] || {};

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
                    <p className="text-muted-foreground">Global configuration for the dashboard application.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate(-1)}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-md border-primary/10">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">Workflow Defaults</CardTitle>
                        </div>
                        <CardDescription>Default timelines for case progression stages.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="in_depth_days">In-Depth Investigation (Days)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="in_depth_days"
                                        type="number"
                                        value={workflowDefaults.in_depth_days || ''}
                                        onChange={(e) => handleChange('workflow_defaults', 'in_depth_days', parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="enforcement_days">Enforcement Stage (Days)</Label>
                                <Input
                                    id="enforcement_days"
                                    type="number"
                                    value={workflowDefaults.enforcement_days || ''}
                                    onChange={(e) => handleChange('workflow_defaults', 'enforcement_days', parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice_due_days">Invoice Due Period (Days)</Label>
                                <Input
                                    id="invoice_due_days"
                                    type="number"
                                    value={workflowDefaults.invoice_due_days || ''}
                                    onChange={(e) => handleChange('workflow_defaults', 'invoice_due_days', parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md border-primary/10">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center gap-2">
                            <Hash className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">ID Prefixes</CardTitle>
                        </div>
                        <CardDescription>System-generated ID formats.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="case_prefix">Case ID Prefix</Label>
                                <Input
                                    id="case_prefix"
                                    placeholder="e.g. DAP"
                                    value={idPrefixes.case || ''}
                                    onChange={(e) => handleChange('id_prefixes', 'case', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice_prefix">Invoice ID Prefix</Label>
                                <Input
                                    id="invoice_prefix"
                                    placeholder="e.g. INV"
                                    value={idPrefixes.invoice || ''}
                                    onChange={(e) => handleChange('id_prefixes', 'invoice', e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md border-primary/10 md:col-span-2">
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">Company Profile</CardTitle>
                        </div>
                        <CardDescription>Company details used in reports and invoices.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 md:col-span-2">
                                <Label>Company Logo</Label>
                                <div className="flex items-center gap-4 mt-2">
                                    {companyInfo.logo_url && (
                                        <div className="h-16 w-16 relative border rounded-lg overflow-hidden bg-muted/20">
                                            <img
                                                src={companyInfo.logo_url}
                                                alt="Company Logo"
                                                className="h-full w-full object-contain"
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <Input
                                            id="logo_upload"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            disabled={isUploading}
                                            className="cursor-pointer"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {isUploading ? 'Uploading...' : 'Upload a square logo (PNG or JPG) for best results.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="company_name">Company Name</Label>
                                <Input
                                    id="company_name"
                                    value={companyInfo.name || ''}
                                    onChange={(e) => handleChange('company_info', 'name', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="company_email">Support Email</Label>
                                <Input
                                    id="company_email"
                                    type="email"
                                    value={companyInfo.email || ''}
                                    onChange={(e) => handleChange('company_info', 'email', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="company_address">Office Address</Label>
                                <Input
                                    id="company_address"
                                    value={companyInfo.address || ''}
                                    onChange={(e) => handleChange('company_info', 'address', e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SettingsPage;
