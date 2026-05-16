// 引入 Electron 模块
// app: 应用程序生命周期
// BrowserWindow: 创建窗口
// Tray: 系统托盘
// Menu: 右键菜单
// Notification: 桌面通知
// nativeImage: 托盘图标
// ipcMain: 主进程 IPC 通信
const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain } = require('electron');
const path = require('path');

let win = null;       // 主窗口引用
let tray = null;      // 系统托盘引用
let isQuitting = false; // 是否正在退出（区分「关闭窗口」和「退出应用」）

/**
 * 创建主窗口
 */
function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 620,
    resizable: false,           // 禁止调整窗口大小
    titleBarStyle: 'hidden',    // 隐藏原生标题栏（使用自绘 UI）
    backgroundColor: '#1a1a2e', // 与 CSS 背景色一致，避免白闪
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // 预加载脚本
      contextIsolation: true,   // 开启上下文隔离（安全）
      nodeIntegration: false,   // 关闭 Node 注入（安全）
    },
  });

  // 加载渲染进程页面
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // 隐藏菜单栏
  win.setMenuBarVisibility(false);
  win.setTitle('番茄钟');

  // 点击关闭按钮时不退出，改为隐藏到托盘
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault(); // 阻止默认关闭行为
      win.hide();         // 隐藏窗口
    }
  });

  // 窗口关闭后清空引用
  win.on('closed', () => {
    win = null;
  });
}

/**
 * 创建系统托盘
 */
function createTray() {
  // 使用生成的番茄图标
  const iconPath = path.join(__dirname, 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  // 右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (win) win.show();
      },
    },
    { type: 'separator' }, // 分隔线
    {
      label: '退出',
      click: () => {
        isQuitting = true; // 标记为退出，绕过 close 事件的 hide 逻辑
        app.quit();
      },
    },
  ]);

  tray.setToolTip('番茄钟');
  tray.setContextMenu(contextMenu);
  // 双击托盘图标打开窗口
  tray.on('double-click', () => {
    if (win) win.show();
  });
}

// Electron 初始化完成后创建窗口和托盘
app.whenReady().then(() => {
  createWindow();
  createTray();
});

// 监听渲染进程发来的通知请求
ipcMain.on('show-notification', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

// 窗口控制：最小化
ipcMain.on('minimize-window', () => {
  if (win) win.minimize();
});

// 窗口控制：关闭（隐藏到托盘）
ipcMain.on('hide-window', () => {
  if (win) win.hide();
});

// 所有窗口关闭时：macOS 下保持运行（符合平台惯例），其他平台退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 退出前设置标记，确保 close 事件不会拦截
app.on('before-quit', () => {
  isQuitting = true;
});

// macOS 点击 Dock 图标时重新显示窗口
app.on('activate', () => {
  if (win === null) {
    createWindow();
  } else {
    win.show();
  }
});
