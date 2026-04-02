/**
 * Maps database client enum values to user-friendly display names.
 */
export function displayClientName(enumValue: string | undefined | null): string {
    if (!enumValue) return '-';

    const displayMap: Record<string, string> = {
        'SAFEMARK': 'SafeMark',
        'ONEWORLD': 'OneWorld',
        'A.A ASSOCIATES': 'A.A Associates',
    };

    return displayMap[enumValue] || enumValue;
}
