export const PAYMENT_TERMS: Record<string, number> = {
    'OneWorld': 90,
    'A.A Associates': 90,
    'SafeMark': 90,
};

export const normalizeClientName = (clientName?: string): string => {
    if (!clientName) return '';

    const upper = clientName.trim().toUpperCase();

    // Handle specific legacy mappings and variations
    if (upper === 'ONEWORLD' || upper.includes('ONEWORLD')) return 'OneWorld';
    if (upper === 'A.A ASSOCIATES' || upper === 'AA' || upper === 'A.A' || upper.includes('ASSOCIATES')) return 'A.A Associates';
    if (upper === 'SAFEMARK' || upper === 'SAFE MARK' || upper.includes('SAFEMARK')) return 'SafeMark';

    return clientName; // fallback to original if unknown
};

export const getPaymentTermDays = (clientName?: string): number => {
    if (!clientName) return 90; // Default if no client

    const normalized = normalizeClientName(clientName);

    // Check exact match after normalization
    if (PAYMENT_TERMS[normalized]) {
        return PAYMENT_TERMS[normalized];
    }

    // Fallback: check case-insensitive match against keys
    const match = Object.keys(PAYMENT_TERMS).find(
        key => key.toLowerCase() === clientName.toLowerCase() ||
            key.toLowerCase() === normalized.toLowerCase()
    );

    return match ? PAYMENT_TERMS[match] : 90;
};
