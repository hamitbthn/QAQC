import * as FileSystem from 'expo-file-system/legacy';

const APP_DIR = `${FileSystem.documentDirectory}JeoValid_Data/`;

export const initFileSystem = async () => {
    const dirInfo = await FileSystem.getInfoAsync(APP_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(APP_DIR, { intermediates: true });
    }
};

export const saveDatasetLocally = async (datasetKey: string, data: any) => {
    await initFileSystem();
    const fileUri = `${APP_DIR}${datasetKey}.json`;
    try {
        await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data), {
            encoding: FileSystem.EncodingType.UTF8,
        });
        console.log(`[Local Storage] Saved ${datasetKey} successfully.`);
        return true;
    } catch (error) {
        console.error(`[Local Storage] Failed to save ${datasetKey}:`, error);
        throw new Error('Dosya cihaza kaydedilemedi.');
    }
};

export const loadDatasetLocally = async (datasetKey: string) => {
    const fileUri = `${APP_DIR}${datasetKey}.json`;
    try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) return null;

        const content = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.UTF8,
        });
        return JSON.parse(content);
    } catch (error) {
        console.error(`[Local Storage] Failed to load ${datasetKey}:`, error);
        return null;
    }
};

export const clearAllLocalData = async () => {
    try {
        const dirInfo = await FileSystem.getInfoAsync(APP_DIR);
        if (dirInfo.exists) {
            await FileSystem.deleteAsync(APP_DIR, { idempotent: true });
        }
        await initFileSystem();
    } catch (error) {
        console.error('[Local Storage] Failed to clear data:', error);
    }
};
