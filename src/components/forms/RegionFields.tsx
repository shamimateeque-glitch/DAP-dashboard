import type { UseFormReturn } from 'react-hook-form';
import { PROVINCES, PROVINCE_CITIES } from '@/lib/locationData';
import {
    FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// Sentinel for "whole province (all cities)" — Radix Selects can't use an empty string value.
export const REGION_ALL_CITIES = '__ALL__';

/**
 * Province (required) + City (optional) selects for assigning an Investigation Team member's
 * region. The city list cascades from the chosen province; "Whole province" maps to no city.
 * Bind to form fields named `assigned_province` and `assigned_city`.
 */
export function RegionFields({ form }: { form: UseFormReturn<any> }) {
    const province: string | undefined = form.watch('assigned_province');
    const cities = province ? (PROVINCE_CITIES[province] || []) : [];

    return (
        <div className="grid grid-cols-2 gap-3">
            <FormField
                control={form.control}
                name="assigned_province"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Province</FormLabel>
                        <Select
                            value={field.value || ''}
                            onValueChange={(v) => {
                                field.onChange(v);
                                // Reset city to "whole province" whenever the province changes.
                                form.setValue('assigned_city', REGION_ALL_CITIES);
                            }}
                        >
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="assigned_city"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>City</FormLabel>
                        <Select value={field.value || REGION_ALL_CITIES} onValueChange={field.onChange} disabled={!province}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Whole province" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value={REGION_ALL_CITIES}>Whole province (all cities)</SelectItem>
                                {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}

/** Convert form values to the province/city to persist (null when not a team member / whole province). */
export function regionForSubmit(role: string, assignedProvince?: string, assignedCity?: string) {
    if (role !== 'INVESTIGATION_TEAM') return { province: null as string | null, city: null as string | null };
    const province = assignedProvince || null;
    const city = assignedCity && assignedCity !== REGION_ALL_CITIES ? assignedCity : null;
    return { province, city };
}
