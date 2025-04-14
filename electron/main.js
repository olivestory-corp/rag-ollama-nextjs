const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // 개발 모드에서는 Next.js 개발 서버를, 프로덕션 모드에서는 빌드된 파일을 로드
    if (isDev) {
        console.log('Loading Next.js development server...');
        mainWindow.loadURL('http://localhost:3000');
    } else {
        console.log('Loading production build...');
        mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
    }

    // 파일 업로드 처리
    ipcMain.handle('upload-file', async (event, fileData) => {
        console.log('Received file upload request:', fileData);
        try {
            const { name, data } = fileData;
            const uploadDir = path.join(app.getPath('userData'), 'uploads');
            
            // uploads 디렉토리가 없으면 생성
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const filePath = path.join(uploadDir, name);
            console.log('Saving file to:', filePath);
            
            const buffer = Buffer.from(data, 'base64');
            
            // 파일 저장
            fs.writeFileSync(filePath, buffer);
            
            console.log('File saved successfully');
            return { success: true, path: filePath };
        } catch (error) {
            console.error('File upload error:', error);
            return { success: false, error: error.message };
        }
    });
}

app.whenReady().then(() => {
    console.log('Electron app is ready');
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
}); 