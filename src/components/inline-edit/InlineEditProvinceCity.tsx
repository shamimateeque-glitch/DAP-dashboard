import React, { useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Edit2, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';
import { PROVINCE_CITIES, PROVINCES } from '@/lib/locationData';

interface InlineEditProvinceCityProps {
    province: string;
    city: string;
    onSave: (province: string, city: string) => Promise<void>;
    canEdit: boolean;
    className?: string;
}

const InlineEditProvinceCity: React.FC<InlineEditProvinceCityProps> = ({
    province,
    city,
    onSave,
    canEdit,
    className,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempProvince, setTempProvince] = useState(province);
    const [tempCity, setTempCity] = useState(city);
    const [isSaving, setIsSaving] = useState(false);

    const startEditing = () => {
        if (!canEdit) return;
        setTempProvince(province);
        setTempCity(city);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!tempProvince || !tempCity) {
            toast.error('Please select both province and city');
            return;
        }
        setIsSaving(true);
        try {
            await onSave(tempProvince, tempCity);
            setIsEditing(false);
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error saving location'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleProvinceChange = (val: string) => {
        setTempProvince(val);
        const cities = PROVINCE_CITIES[val] || [];
        if (!cities.includes(tempCity)) {
            setTempCity(cities[0] || '');
        }
    };

    if (isEditing) {
        const cities = PROVINCE_CITIES[tempProvince] || [];
        return (
            <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center gap-2">
                    <Select value={tempProvince} onValueChange={handleProvinceChange}>
                        <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue placeholder="Province" />
                        </SelectTrigger>
                        <SelectContent>
                            {PROVINCES.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={tempCity} onValueChange={setTempCity}>
                        <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue placeholder="City" />
                        </SelectTrigger>
                        <SelectContent>
                            {cities.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
                            onClick={() => setIsEditing(false)}
                            disabled={isSaving}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group">
            <p
                className={cn(
                    className,
                    canEdit && "cursor-pointer hover:underline decoration-dotted"
                )}
                onClick={startEditing}
            >
                {province}, {city}
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

export default InlineEditProvinceCity;
