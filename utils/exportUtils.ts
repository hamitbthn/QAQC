import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Converts an array of objects to CSV string
 */
export const convertToCSV = (data: any[]): string => {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(obj =>
        headers.map(header => {
            const val = obj[header];
            // Escape quotes and handle commas
            const stringVal = val === null || val === undefined ? '' : String(val);
            return `"${stringVal.replace(/"/g, '""')}"`;
        }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
};

/**
 * Saves and shares a CSV file
 */
export const exportCSV = async (filename: string, content: string) => {
    try {
        const fileUri = `${FileSystem.documentDirectory}${filename}`;

        // On web, we handle differently usually, but Expo Sharing/FileSystem works for native
        if (Platform.OS === 'web') {
            const blob = new Blob([content], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', filename);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
        }

        await FileSystem.writeAsStringAsync(fileUri, content, {
            encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri);
        } else {
            console.error('Sharing is not available');
        }
    } catch (error) {
        console.error('Error exporting CSV:', error);
        throw error;
    }
};
