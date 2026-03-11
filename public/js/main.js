// CloudGramStore 主 JavaScript 文件
// 模块化前端应用入口

import { AuthManager } from './modules/auth.js';
import { FileManager } from './modules/fileManager.js';
import { UIManager } from './modules/uiManager.js';
import { ApiClient } from './modules/apiClient.js';
import { NotificationManager } from './modules/notification.js';

/**
 * 应用主类
 */
class CloudGramApp {
    constructor() {
        this.apiClient = new ApiClient();
        this.authManager = new AuthManager(this.apiClient);
        this.fileManager = new FileManager(this.apiClient);
        this.uiManager = new UIManager();
        this.notification = new NotificationManager();

        this.currentFolderId = null;
        this.breadcrumbPath = [];

        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        try {
            // 绑定事件监听器
            this.bindEvents();

            // 检查登录状态
            if (this.authManager.isLoggedIn()) {
                await this.showMainPage();
            } else {
                this.showLoginPage();
            }

            // 隐藏页面加载指示器
            this.hidePageLoader();
        } catch (error) {
            console.error('应用初始化失败:', error);
            this.notification.error('应用初始化失败', error.message);
            // 即使出错也要隐藏加载指示器
            this.hidePageLoader();
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 登录表单
        const loginForm = document.getElementById('loginForm');
        loginForm.addEventListener('submit', this.handleLogin.bind(this));

        // 用户下拉菜单（登出在下拉项中）
        const userToggle = document.getElementById('userDropdownToggle');
        const userMenu = document.getElementById('userDropdownMenu');
        const logoutMenuItem = document.getElementById('logoutMenuItem');

        if (userToggle && userMenu) {
            userToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('show');
                if (userMenu.classList.contains('show')) {
                    userMenu.style.display = 'block';
                } else {
                    userMenu.style.display = 'none';
                }
            });

            // 点击页面其他地方关闭下拉
            document.addEventListener('click', () => {
                if (userMenu.classList.contains('show')) {
                    userMenu.classList.remove('show');
                    userMenu.style.display = 'none';
                }
            });
        }

        if (logoutMenuItem) {
            logoutMenuItem.addEventListener('click', this.handleLogout.bind(this));
        }

        // 工具栏按钮
        document.getElementById('uploadBtn').addEventListener('click', this.handleUploadClick.bind(this));
        document.getElementById('createFolderBtn').addEventListener('click', this.handleCreateFolderClick.bind(this));
        document.getElementById('refreshBtn').addEventListener('click', this.refreshCurrentDirectory.bind(this));

        // 文件输入
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // 模态框确认按钮
        document.getElementById('confirmCreateFolder').addEventListener('click', this.handleCreateFolder.bind(this));
        document.getElementById('confirmRename').addEventListener('click', this.handleRename.bind(this));
        document.getElementById('confirmDelete').addEventListener('click', this.handleDelete.bind(this));

        // 拖拽上传
        this.bindDragAndDrop();

        // 键盘快捷键
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    /**
     * 绑定拖拽上传事件
     */
    bindDragAndDrop() {
        const contentArea = document.querySelector('.content-area');

        contentArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            contentArea.classList.add('drag-over');
        });

        contentArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!contentArea.contains(e.relatedTarget)) {
                contentArea.classList.remove('drag-over');
            }
        });

        contentArea.addEventListener('drop', (e) => {
            e.preventDefault();
            contentArea.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.uploadFiles(files);
            }
        });
    }

    /**
     * 处理键盘快捷键
     */
    handleKeydown(e) {
        // Ctrl/Cmd + U: 上传文件
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            this.handleUploadClick();
        }

        // Ctrl/Cmd + N: 新建文件夹
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            this.handleCreateFolderClick();
        }

        // F5: 刷新
        if (e.key === 'F5') {
            e.preventDefault();
            this.refreshCurrentDirectory();
        }
    }

    /**
     * 显示登录页面
     */
    showLoginPage() {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('mainPage').style.display = 'none';
        document.getElementById('username').focus();
    }

    /**
     * 显示主页面
     */
    async showMainPage() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainPage').style.display = 'flex';

        // 显示用户信息
        const userInfo = await this.authManager.getUserInfo();
        document.getElementById('currentUser').textContent = userInfo.username;

        // 加载根目录内容
        await this.loadDirectory(null);
    }

    /**
     * 处理登录
     */
    async handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorElement = document.getElementById('loginError');

        try {
            await this.authManager.login(username, password);
            errorElement.classList.remove('show');
            await this.showMainPage();
            this.notification.success('登录成功', `欢迎回来，${username}！`);
        } catch (error) {
            errorElement.textContent = error.message;
            errorElement.classList.add('show');
        }
    }

    /**
     * 处理登出
     */
    async handleLogout() {
        try {
            await this.authManager.logout();
            this.showLoginPage();
            this.notification.info('已登出', '您已成功登出系统');
        } catch (error) {
            this.notification.error('登出失败', error.message);
        }
    }

    /**
     * 处理上传按钮点击
     */
    handleUploadClick() {
        document.getElementById('fileInput').click();
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            this.uploadFiles(files);
        }
        // 清空文件输入
        e.target.value = '';
    }

    /**
     * 上传文件
     * @param {File[]} files - 要上传的文件列表
     */
    async uploadFiles(files) {
        this.uiManager.showLoading('正在上传...');
        for (const file of files) {
            try {
                // 在每个文件开始上传时显示上传模态（会自动隐藏全局 loading 遮罩）
                this.uiManager.showUploadModal && this.uiManager.showUploadModal();
                // 立即显示文件名和 0% 进度，确保在第一个分片完成前能看到文件名
                this.uiManager.updateUploadProgress && this.uiManager.updateUploadProgress(file.name, 0);

                await this.fileManager.uploadFile(file, this.currentFolderId, (progress) => {
                    this.uiManager.updateUploadProgress && this.uiManager.updateUploadProgress(file.name, progress);
                });

                // 上传完成 — 由后端返回并且 uploadFile() resolve 后执行
                this.uiManager.hideUploadModal && this.uiManager.hideUploadModal();

                this.notification.success('上传成功', `文件 ${file.name} 上传完成`);
            } catch (error) {
                // 确保在错误情况下也关闭上传模态
                this.uiManager.hideUploadModal && this.uiManager.hideUploadModal();
                console.error('文件上传错误:', error);
                console.error('文件上传错误:', error);

                // 构建详细错误信息对象
                const errorDetails = {
                    fileName: file.name,
                    fileSize: this.formatFileSize(file.size),
                    folderId: this.currentFolderId,
                    timestamp: new Date().toLocaleString()
                };

                // 合并错误对象中的详细信息
                if (error.details) {
                    Object.assign(errorDetails, error.details);
                }

                // 添加错误状态和URL信息
                if (error.status) errorDetails.status = error.status;
                if (error.url) errorDetails.url = error.url;
                if (error.method) errorDetails.method = error.method;

                this.notification.error(
                    '上传失败',
                    `文件 ${file.name} 上传失败：${error.message}`,
                    8000,  // 显示时间更长
                    errorDetails
                );
            }
        }
        this.uiManager.hideLoading();
        // 刷新目录
        await this.refreshCurrentDirectory();
    }

    /**
     * 处理创建文件夹按钮点击
     */
    handleCreateFolderClick() {
        this.uiManager.showCreateFolderModal();
    }

    /**
     * 处理创建文件夹
     */
    async handleCreateFolder() {
        const folderName = document.getElementById('folderName').value.trim();

        if (!folderName) {
            this.notification.warning('请输入文件夹名称');
            return;
        }
        this.uiManager.showLoading('正在创建文件夹...');
        try {
            await this.fileManager.createFolder(folderName, this.currentFolderId);
            this.uiManager.closeModal('createFolderModal');
            document.getElementById('folderName').value = '';
            await this.refreshCurrentDirectory();
            this.notification.success('创建成功', `文件夹 ${folderName} 创建完成`);
        } catch (error) {
            console.error('创建文件夹错误:', error);

            // 构建详细错误信息对象
            const errorDetails = {
                folderName: folderName,
                parentFolderId: this.currentFolderId,
                timestamp: new Date().toLocaleString()
            };

            // 合并错误对象中的详细信息
            if (error.details) {
                Object.assign(errorDetails, error.details);
            }

            this.notification.error('创建失败', error.message, 8000, errorDetails);
        } finally {
            this.uiManager.hideLoading();
        }
    }

    /**
     * 重命名项目
     */
    async renameItem(type, id, currentName) {
        this.currentRenameItem = { type, id, currentName };
        document.getElementById('newName').value = currentName;
        document.getElementById('renameTitle').textContent = `重命名${type === 'folder' ? '文件夹' : '文件'}`;
        this.uiManager.showModal('renameModal');
    }

    /**
     * 处理重命名
     */
    async handleRename() {
        const newName = document.getElementById('newName').value.trim();

        if (!newName) {
            this.notification.warning('请输入新名称');
            return;
        }

        if (!this.currentRenameItem) {
            return;
        }
        this.uiManager.showLoading('正在重命名...');
        try {
            const { type, id, currentName } = this.currentRenameItem;

            if (type === 'folder') {
                await this.fileManager.updateFolderName(id, newName);
            } else {
                await this.fileManager.updateFileName(id, newName);
            }

            this.uiManager.closeModal('renameModal');
            await this.refreshCurrentDirectory();
            this.notification.success('重命名成功', `${type === 'folder' ? '文件夹' : '文件'}已重命名为 ${newName}`);
        } catch (error) {
            console.error('重命名错误:', error);

            // 构建详细错误信息对象
            const { type, id, currentName } = this.currentRenameItem;
            const errorDetails = {
                itemType: type,
                itemId: id,
                oldName: currentName,
                newName: newName,
                timestamp: new Date().toLocaleString()
            };

            // 合并错误对象中的详细信息
            if (error.details) {
                Object.assign(errorDetails, error.details);
            }

            this.notification.error('重命名失败', error.message, 8000, errorDetails);
        } finally {
            this.uiManager.hideLoading();
        }
    }

    /**
     * 删除项目
     */
    async deleteItem(type, id, name) {
        this.currentDeleteItem = { type, id, name };
        document.getElementById('deleteMessage').textContent =
            `确定要删除${type === 'folder' ? '文件夹' : '文件'} "${name}" 吗？此操作不可撤销。`;
        this.uiManager.showModal('deleteModal');
    }

    /**
     * 处理删除
     */
    async handleDelete() {
        if (!this.currentDeleteItem) {
            return;
        }
        this.uiManager.showLoading('正在删除...');
        try {
            const { type, id, name } = this.currentDeleteItem;

            if (type === 'folder') {
                await this.fileManager.deleteFolder(id);
            } else {
                await this.fileManager.deleteFile(id);
            }

            this.uiManager.closeModal('deleteModal');
            await this.refreshCurrentDirectory();
            this.notification.success('删除成功', `${type === 'folder' ? '文件夹' : '文件'} ${name} 已删除`);
        } catch (error) {
            console.error('删除错误:', error);

            // 构建详细错误信息对象
            const { type, id, name } = this.currentDeleteItem;
            const errorDetails = {
                itemType: type,
                itemId: id,
                itemName: name,
                timestamp: new Date().toLocaleString()
            };

            // 合并错误对象中的详细信息
            if (error.details) {
                Object.assign(errorDetails, error.details);
            }

            this.notification.error('删除失败', error.message, 8000, errorDetails);
        } finally {
            this.uiManager.hideLoading();
        }
    }

    /**
     * 下载文件
     * @param {string} fileId - 文件ID
     * @param {string} fileName - 文件名
     */
    async downloadFile(fileId, fileName) {
        this.uiManager.showLoading('正在下载...');
        try {
            this.notification.info('开始下载', `正在准备下载 ${fileName}...`);
            await this.fileManager.downloadFile(fileId, fileName, (progress) => {
                // 如果UI管理器支持下载进度更新，则调用它
                this.uiManager.updateDownloadProgress &&
                this.uiManager.updateDownloadProgress(fileName, progress);
            });
            this.notification.success('下载完成', `文件 ${fileName} 下载完成`);
        } catch (error) {
            console.error('文件下载错误:', error);

            // 构建详细错误信息对象
            const errorDetails = {
                fileName: fileName,
                fileId: fileId,
                timestamp: new Date().toLocaleString()
            };

            // 合并错误对象中的详细信息
            if (error.details) {
                Object.assign(errorDetails, error.details);
            }

            // 添加错误状态和URL信息
            if (error.status) errorDetails.status = error.status;
            if (error.url) errorDetails.url = error.url;
            if (error.method) errorDetails.method = error.method;

            this.notification.error(
                '下载失败',
                `文件 ${fileName} 下载失败：${error.message}`,
                8000,  // 显示时间更长
                errorDetails
            );
        } finally {
            this.uiManager.hideLoading();
        }
    }

    /**
     * 加载目录内容
     * @param {string|null} folderId - 文件夹ID，null表示根目录
     */
    async loadDirectory(folderId) {
        console.log('loadDirectory called with folderId:', folderId); // 调试用
        try {
            this.uiManager.showLoading();

            const data = await this.fileManager.getDirectoryContents(folderId);
            this.currentFolderId = folderId;

            // 更新面包屑导航
            await this.updateBreadcrumb(folderId);

            // 渲染文件列表
            this.renderFileList(data.folders, data.files);

        } catch (error) {
            console.error('加载目录错误:', error);

            // 构建详细错误信息对象
            const errorDetails = {
                folderId: folderId,
                timestamp: new Date().toLocaleString()
            };

            // 合并错误对象中的详细信息
            if (error.details) {
                Object.assign(errorDetails, error.details);
            }

            this.notification.error('加载失败', error.message, 8000, errorDetails);
        } finally {
            this.uiManager.hideLoading();
        }
    }

    /**
     * 更新面包屑导航
     */
    async updateBreadcrumb(folderId) {
			console.log('更新面包屑导航 floderId=' + folderId);
        if (folderId === null) {
            this.breadcrumbPath = [{ id: null, name: '根目录' }];
        } else {
            try {
                this.breadcrumbPath = await this.fileManager.getFolderPath(folderId);
                this.breadcrumbPath.unshift({ id: null, name: '根目录' });
            } catch (error) {
                console.error('获取文件夹路径失败:', error);
                this.breadcrumbPath = [{ id: null, name: '根目录' }];
            }
        }

        this.renderBreadcrumb();
    }

    /**
     * 渲染面包屑导航
     */
    renderBreadcrumb() {
        console.log('breadcrumbPath:', this.breadcrumbPath); // 调试用，打印路径
        const breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = '';

        this.breadcrumbPath.forEach((item, index) => {
            const breadcrumbItem = document.createElement('div');
            breadcrumbItem.className = 'breadcrumb-item';

            if (index === this.breadcrumbPath.length - 1) {
                // 当前目录
                breadcrumbItem.textContent = item.name;
            } else {
                // 可点击的路径
                const link = document.createElement('a');
                link.className = 'breadcrumb-link';
                link.textContent = item.name;
                link.addEventListener('click', () => this.loadDirectory(item.id));
                breadcrumbItem.appendChild(link);
            }

            breadcrumb.appendChild(breadcrumbItem);
        });
    }

    /**
     * 渲染文件列表
     */
    renderFileList(folders, files) {
        const fileList = document.getElementById('fileList');
        const loading = document.getElementById('loading');
        const emptyState = document.getElementById('emptyState');

        // 隐藏加载状态
        loading.style.display = 'none';

        // 清空现有内容
        const existingItems = fileList.querySelectorAll('.file-item');
        existingItems.forEach(item => item.remove());

        // 检查是否为空
        if (folders.length === 0 && files.length === 0) {
            emptyState.style.display = 'block';
            return;
        } else {
            emptyState.style.display = 'none';
        }

        // 渲染文件夹
        folders.forEach(folder => {
            const folderElement = this.createFolderElement(folder);
            fileList.appendChild(folderElement);
        });

        // 渲染文件
        files.forEach(file => {
            const fileElement = this.createFileElement(file);
            fileList.appendChild(fileElement);
        });
    }

    /**
     * 创建文件夹元素（直接显示重命名和删除按钮）
     */
    createFolderElement(folder) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <div class="file-icon">📁</div>
            <div class="file-info">
                <div class="file-name">${this.escapeHtml(folder.name)}</div>
                <div class="file-meta">
                    <span>创建时间: ${this.formatDate(folder.created_at)}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="action-btn action-btn-secondary" onclick="app.renameItem('folder', ${folder.id}, '${this.escapeHtml(folder.name)}')">重命名</button>
                <button class="action-btn action-btn-danger" onclick="app.deleteItem('folder', ${folder.id}, '${this.escapeHtml(folder.name)}')">删除</button>
            </div>
        `;
        // 添加双击进入文件夹
        div.addEventListener('dblclick', () => {
            this.loadDirectory(folder.id);
        });
        return div;
    }

    /**
     * 创建文件元素
     */
    createFileElement(file) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <div class="file-icon">${this.getFileIcon(file.mime_type)}</div>
            <div class="file-info">
                <div class="file-name">${this.escapeHtml(file.name)}</div>
                <div class="file-meta">
                    <span>大小: ${this.formatFileSize(file.size)}</span>
                    <span>上传时间: ${this.formatDate(file.created_at)}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="action-btn action-btn-primary" onclick="app.downloadFile(${file.id}, '${this.escapeHtml(file.name)}')">下载</button>
                <button class="action-btn action-btn-secondary" onclick="app.renameItem('file', ${file.id}, '${this.escapeHtml(file.name)}')">重命名</button>
                <button class="action-btn action-btn-danger" onclick="app.deleteItem('file', ${file.id}, '${this.escapeHtml(file.name)}')">删除</button>
            </div>
        `;

        return div;
    }

    /**
     * 下载文件
     */
    async downloadFile(fileId, fileName) {
        this.uiManager.showLoading('正在下载...');
        try {
            this.notification.info('开始下载', `正在准备下载 ${fileName}...`);
            await this.fileManager.downloadFile(fileId, fileName);
            this.notification.success('下载完成', `文件 ${fileName} 下载完成`);
        } catch (error) {
            this.notification.error('下载失败', `文件 ${fileName} 下载失败：${error.message}`);
        } finally {
            this.uiManager.hideLoading();
        }
    }

    /**
     * 刷新当前目录
     */
    async refreshCurrentDirectory() {
        await this.loadDirectory(this.currentFolderId);
    }

    /**
     * 转义 HTML 特殊字符
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 格式化日期
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 文件大小（字节）
     * @returns {string} - 格式化后的文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 获取文件图标
     */
    getFileIcon(mimeType) {
        if (!mimeType) return '📄';

        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📕';
        if (mimeType.includes('word')) return '📘';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📗';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📙';
        if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '🗜️';
        if (mimeType.startsWith('text/')) return '📝';

        return '📄';
    }

    /**
     * 隐藏页面加载指示器
     */
    hidePageLoader() {
        const pageLoader = document.getElementById('pageLoader');
        if (pageLoader) {
            pageLoader.style.display = 'none';
        }
    }
}

// 全局函数，用于模态框关闭
window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};

// 应用实例
let app;

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    app = new CloudGramApp();
    window.app = app; // 暴露到全局，方便调试和内联事件处理
});
