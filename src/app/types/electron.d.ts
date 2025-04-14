interface ElectronAPI {
    uploadFile: (fileData: { name: string; data: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

export {}; 