import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, CalendarIcon, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { sanitizeErrorMessage } from '@/lib/security';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

import { PROVINCE_CITIES } from '@/lib/locationData';

const REPORTERS = [
    "Rana Abubakar",
    "Rana Adil",
    "Rana Hasnain",
    "Faheem",
    "Muhammad Qaiser",
] as const;

const caseSchema = z.object({
    case_type: z.string().min(1, 'Case type is required'),
    target_name: z.string().min(2, 'Target name is required'),
    target_category: z.string().min(2, 'Category is required'),
    target_address: z.string().min(5, 'Address is required'),
    city: z.string().min(2, 'City is required'),
    province: z.string().min(2, 'Province is required'),
    brand_name: z.string().min(2, 'Brand name is required'),
    products_name: z.string().min(2, 'Products name is required'),
    case_reported_date: z.string(),
    case_reported_by: z.string().min(2, 'Reported by is required'),
    notes_description: z.string().optional(),
});

type CaseFormValues = z.infer<typeof caseSchema>;

const EditCaseForm = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { appUser } = useAuth();
    const { can } = usePermissions();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [brands, setBrands] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [isBrandPopOpen, setIsBrandPopOpen] = useState(false);
    const [isCategoryPopOpen, setIsCategoryPopOpen] = useState(false);
    const [isCityPopOpen, setIsCityPopOpen] = useState(false);
    const [brandSearch, setBrandSearch] = useState("");
    const [categorySearch, setCategorySearch] = useState("");
    const [citySearch, setCitySearch] = useState("");

    const { data: caseData, isLoading } = useQuery({
        queryKey: ['case', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('cases')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    const form = useForm<CaseFormValues>({
        resolver: zodResolver(caseSchema),
        defaultValues: {
            case_type: '',
            target_name: '',
            target_category: '',
            target_address: '',
            city: '',
            province: '',
            brand_name: '',
            products_name: '',
            case_reported_date: '',
            case_reported_by: '',
            notes_description: '',
        },
    });

    useEffect(() => {
        if (caseData) {
            form.reset({
                case_type: caseData.case_type || '',
                target_name: caseData.target_name,
                target_category: caseData.target_category,
                target_address: caseData.target_address,
                city: caseData.city,
                province: caseData.province,
                brand_name: caseData.brand_name,
                products_name: caseData.products_name,
                case_reported_date: caseData.case_reported_date,
                case_reported_by: caseData.case_reported_by || '',
                notes_description: caseData.notes_description || '',
            });
        }
    }, [caseData, form]);

    useEffect(() => {
        const fetchExistingData = async () => {
            // Fetch unique brands
            const { data: brandData } = await supabase
                .from('cases')
                .select('brand_name')
                .not('brand_name', 'is', null);

            if (brandData) {
                const uniqueBrands = Array.from(new Set(brandData.map(d => d.brand_name).filter(Boolean))) as string[];
                setBrands(uniqueBrands.sort());
            }


            // Fetch unique categories
            const { data: categoryData } = await supabase
                .from('cases')
                .select('target_category')
                .not('target_category', 'is', null);

            if (categoryData) {
                const uniqueCategories = Array.from(new Set(categoryData.map(d => d.target_category).filter(Boolean))) as string[];
                setCategories(uniqueCategories.sort());
            }
        };
        fetchExistingData();
    }, []);

    const onSubmit = async (values: CaseFormValues) => {
        setIsSubmitting(true);
        try {
            // Clean up optional fields
            const sanitizedValues = {
                ...values,
                notes_description: values.notes_description || null,
            };

            const { error } = await supabase
                .from('cases')
                .update(sanitizedValues)
                .eq('id', id);

            if (error) {
                throw error;
            }

            toast.success('Case updated successfully');
            navigate(`/cases/${id}`);
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error updating case'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!can('cases', 'edit')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <h2 className="text-2xl font-bold">Access Denied</h2>
                <p className="text-muted-foreground">You do not have permission to edit cases.</p>
                <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-3xl font-bold tracking-tight">Edit Case: {caseData?.case_id}</h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Case Information</CardTitle>
                    <CardDescription>Update the details for this operational case.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="case_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Case Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select case type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Customs">Customs</SelectItem>
                                                    <SelectItem value="Market">Market</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="target_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Target Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="target_category"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="mb-2">Target Category</FormLabel>
                                            <Popover open={isCategoryPopOpen} onOpenChange={setIsCategoryPopOpen}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn(
                                                                "w-full justify-between font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value || "Select category..."}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                    <Command>
                                                        <CommandInput
                                                            placeholder="Search or add category..."
                                                            value={categorySearch}
                                                            onValueChange={setCategorySearch}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>No categories found.</CommandEmpty>
                                                            {categorySearch && !categories.includes(categorySearch) && (
                                                                <CommandGroup>
                                                                    <CommandItem
                                                                        value={categorySearch}
                                                                        onSelect={() => {
                                                                            field.onChange(categorySearch);
                                                                            if (!categories.includes(categorySearch)) {
                                                                                setCategories(prev => [...prev, categorySearch].sort());
                                                                            }
                                                                            setIsCategoryPopOpen(false);
                                                                            setCategorySearch("");
                                                                        }}
                                                                        className="text-primary font-medium"
                                                                    >
                                                                        <Plus className="mr-2 h-4 w-4" />
                                                                        Add "{categorySearch}"
                                                                    </CommandItem>
                                                                </CommandGroup>
                                                            )}
                                                            <CommandGroup>
                                                                {categories.map((cat) => (
                                                                    <CommandItem
                                                                        key={cat}
                                                                        value={cat}
                                                                        onSelect={() => {
                                                                            field.onChange(cat);
                                                                            setIsCategoryPopOpen(false);
                                                                            setCategorySearch("");
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                cat === field.value ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {cat}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="brand_name"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="mb-2">Brand Name</FormLabel>
                                            <Popover open={isBrandPopOpen} onOpenChange={setIsBrandPopOpen}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn(
                                                                "w-full justify-between font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value || "Select brand..."}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                    <Command>
                                                        <CommandInput
                                                            placeholder="Search or add brand..."
                                                            value={brandSearch}
                                                            onValueChange={setBrandSearch}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>No brands found.</CommandEmpty>
                                                            {brandSearch && !brands.includes(brandSearch) && (
                                                                <CommandGroup>
                                                                    <CommandItem
                                                                        value={brandSearch}
                                                                        onSelect={() => {
                                                                            field.onChange(brandSearch);
                                                                            if (!brands.includes(brandSearch)) {
                                                                                setBrands(prev => [...prev, brandSearch].sort());
                                                                            }
                                                                            setIsBrandPopOpen(false);
                                                                            setBrandSearch("");
                                                                        }}
                                                                        className="text-primary font-medium"
                                                                    >
                                                                        <Plus className="mr-2 h-4 w-4" />
                                                                        Add "{brandSearch}"
                                                                    </CommandItem>
                                                                </CommandGroup>
                                                            )}
                                                            <CommandGroup>
                                                                {brands.map((brand) => (
                                                                    <CommandItem
                                                                        key={brand}
                                                                        value={brand}
                                                                        onSelect={() => {
                                                                            field.onChange(brand);
                                                                            setIsBrandPopOpen(false);
                                                                            setBrandSearch("");
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                brand === field.value ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {brand}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="products_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Products Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="md:col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="target_address"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Target Address</FormLabel>
                                                <FormControl>
                                                    <Textarea {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="mb-2">City</FormLabel>
                                            <Popover open={isCityPopOpen} onOpenChange={setIsCityPopOpen}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn(
                                                                "w-full justify-between font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                            disabled={!form.watch('province')}
                                                        >
                                                            {field.value || (form.watch('province') ? "Select city..." : "Select province first")}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                    <Command>
                                                        <CommandInput
                                                            placeholder="Search or add city..."
                                                            value={citySearch}
                                                            onValueChange={setCitySearch}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>No cities found.</CommandEmpty>
                                                            {citySearch && !(PROVINCE_CITIES[form.watch('province')] || []).includes(citySearch) && (
                                                                <CommandGroup>
                                                                    <CommandItem
                                                                        value={citySearch}
                                                                        onSelect={() => {
                                                                            field.onChange(citySearch);
                                                                            setIsCityPopOpen(false);
                                                                            setCitySearch("");
                                                                        }}
                                                                        className="text-primary font-medium"
                                                                    >
                                                                        <Plus className="mr-2 h-4 w-4" />
                                                                        Add "{citySearch}"
                                                                    </CommandItem>
                                                                </CommandGroup>
                                                            )}
                                                            <CommandGroup>
                                                                {(PROVINCE_CITIES[form.watch('province')] || []).map((city) => (
                                                                    <CommandItem
                                                                        key={city}
                                                                        value={city}
                                                                        onSelect={() => {
                                                                            field.onChange(city);
                                                                            setIsCityPopOpen(false);
                                                                            setCitySearch("");
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                city === field.value ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {city}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="province"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Province</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a province" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {Object.keys(PROVINCE_CITIES).map((prov) => (
                                                        <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="case_reported_date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Case Reported Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "w-full pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value ? (
                                                                format(new Date(field.value + "T00:00:00"), "PPP")
                                                            ) : (
                                                                <span>Pick a date</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        captionLayout="dropdown-buttons"
                                                        fromYear={1900}
                                                        toYear={new Date().getFullYear() + 2}
                                                        selected={field.value ? new Date(field.value + "T00:00:00") : undefined}
                                                        onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                                        disabled={(date) => {
                                                            const today = new Date();
                                                            today.setHours(23, 59, 59, 999);
                                                            return date > today || date < new Date("1900-01-01");
                                                        }}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="case_reported_by"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="mb-2">Case Reported By</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select reporter" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {REPORTERS.map((name) => (
                                                        <SelectItem key={name} value={name}>{name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="md:col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="notes_description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Notes / Description</FormLabel>
                                                <FormControl>
                                                    <Textarea {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Updating...' : 'Update Case'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
};

export default EditCaseForm;
