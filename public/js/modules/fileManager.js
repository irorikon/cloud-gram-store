// 文件管理模块
// 负责文件和文件夹的操作管理

export class FileManager {
    constructor(apiClient) {
        this.apiClient = apiClient;
    }

    /**
     * 获取目录内容
     * @param {string|null} folderId - 文件夹ID，null表示根目录
     * @returns {Promise<Object>} - 目录内容
     */
    async getDirectoryContents(folderId = null) {
        try {
            console.log(`获取目录内容: ${folderId || '根目录'}`);
            const result = await this.apiClient.getEntries(folderId);
            console.log(`目录内容获取成功: ${folderId || '根目录'}, 文件夹: ${result.folders?.length || 0}, 文件: ${result.files?.length || 0}`);
            return result;
        } catch (error) {
            console.error('获取目录内容失败:', error);

            // 创建新的错误对象，保留原始错误的详细信息
            const newError = new Error('获取目录内容失败：' + error.message);

            // 复制原始错误的属性
            if (error.status) newError.status = error.status;
            if (error.url) newError.url = error.url;
            if (error.method) newError.method = error.method;
            if (error.details) newError.details = error.details;

            // 添加文件夹ID
            newError.folderId = folderId;

            throw newError;
        }
    }

    /**
     * 创建文件夹
     * @param {string} name - 文件夹名称
     * @param {string|null} parentId - 父文件夹ID
     * @returns {Promise<Object>} - 创建结果
     */
    async createFolder(name, parentId = null) {
        try {
            console.log(`创建文件夹: ${name}, 父文件夹ID: ${parentId || '根目录'}`);
            const result = await this.apiClient.createFolder(name, parentId);
            console.log(`文件夹创建成功: ${name}, ID: ${result.id}`);
            return result;
        } catch (error) {
            console.error('创建文件夹失败:', error);

            // 创建新的错误对象，保留原始错误的详细信息
            const newError = new Error('创建文件夹失败：' + error.message);

            // 复制原始错误的属性
            if (error.status) newError.status = error.status;
            if (error.url) newError.url = error.url;
            if (error.method) newError.method = error.method;
            if (error.details) newError.details = error.details;
            if (error.timestamp) newError.timestamp = error.timestamp;

            // 添加文件夹信息
            newError.folderName = name;
            newError.parentId = parentId;

            throw newError;
        }
    }

    /**
     * 更新文件夹名称
     * @param {string} folderId - 文件夹ID
     * @param {string} newName - 新文件夹名称
     * @returns {Promise<Object>} - 更新结果
     */
    async updateFolderName(folderId, newName) {
        try {
            console.log(`重命名文件夹: ID ${folderId}, 新名称: ${newName}`);
            const result = await this.apiClient.updateFolder(folderId, newName);
            console.log(`文件夹重命名成功: ID ${folderId}, 新名称: ${newName}`);
            return result;
        } catch (error) {
            console.error('重命名文件夹失败:', error);

            // 创建新的错误对象，保留原始错误的详细信息
            const newError = new Error('重命名文件夹失败：' + error.message);

            // 复制原始错误的属性
            if (error.status) newError.status = error.status;
            if (error.url) newError.url = error.url;
            if (error.method) newError.method = error.method;
            if (error.details) newError.details = error.details;
            if (error.timestamp) newError.timestamp = error.timestamp;

            // 添加文件夹信息
            newError.folderId = folderId;
            newError.newName = newName;

            throw newError;
        }
    }

    /**
     * 删除文件夹
     * @param {string} folderId - 文件夹ID
     * @returns {Promise<Object>} - 删除结果
     */
    async deleteFolder(folderId) {
        try {
            console.log(`删除文件夹: ID ${folderId}`);
            const result = await this.apiClient.deleteFolder(folderId);
            console.log(`文件夹删除成功: ID ${folderId}`);
            return result;
        } catch (error) {
            console.error('删除文件夹失败:', error);

            // 创建新的错误对象，保留原始错误的详细信息
            const newError = new Error('删除文件夹失败：' + error.message);

            // 复制原始错误的属性
            if (error.status) newError.status = error.status;
            if (error.url) newError.url = error.url;
            if (error.method) newError.method = error.method;
            if (error.details) newError.details = error.details;
            if (error.timestamp) newError.timestamp = error.timestamp;

            // 添加文件夹ID
            newError.folderId = folderId;

            throw newError;
        }
    }

    /**
     * 上传文件（支持前端分片）
     * @param {File} file - 要上传的文件
     * @param {string|null} folderId - 目标文件夹ID
     * @param {Function|null} onProgress - 进度回调函数
     * @returns {Promise<Object>} - 上传结果
     */
    async uploadFile(file, folderId = null, onProgress = null) {
        try {
            // 验证文件
            this.validateFile(file);

            // 设置分片大小阈值，超过此大小使用分片上传
            // 注意：后端会将上传数据按照 Telegram 的要求再分片（后端默认 chunkSize 在 `src/services/telegram.js` 中），
            // 为保持前后端一致并减少分片数量，这里将前端阈值调整为 25MB。
            // 如需更改，请同时同步修改后端 `src/services/telegram.js` 中的 `chunkSize`。
            const CHUNK_THRESHOLD = 25 * 1024 * 1024; // 25MB

            if (file.size > CHUNK_THRESHOLD) {
                console.log(`文件大小 ${this.formatFileSize(file.size)} 超过阈值${CHUNK_THRESHOLD}，使用分片上传`);
                // 使用分片上传
                return await this.uploadFileWithChunks(file, folderId, onProgress);
            } else {
                console.log(`文件大小 ${this.formatFileSize(file.size)} 未超过阈值，使用普通上传`);
                // 使用普通上传
                const result = await this.apiClient.uploadFile(file, folderId, onProgress);
                return result;
            }
        } catch (error) {
            console.error('上传文件失败:', error);

            // 保留原始错误的详细信息
            if (error.message.includes('上传文件失败')) {
                // 已经是格式化过的错误，直接抛出
                throw error;
            } else {
                // 创建新的错误对象，保留原始错误的详细信息
                const newError = new Error('上传文件失败：' + error.message);

                // 复制原始错误的属性
                if (error.fileName) newError.fileName = error.fileName;
                if (error.fileSize) newError.fileSize = error.fileSize;
                if (error.folderId) newError.folderId = error.folderId;
                if (error.status) newError.status = error.status;
                if (error.url) newError.url = error.url;
                if (error.method) newError.method = error.method;
                if (error.details) newError.details = error.details;
                if (error.timestamp) newError.timestamp = error.timestamp;

                throw newError;
            }
        }
    }

    /**
     * 分片上传文件
     * @param {File} file - 要上传的文件
     * @param {string|null} folderId - 目标文件夹ID
     * @param {Function|null} onProgress - 进度回调函数
     * @returns {Promise<Object>} - 上传结果
     */
    async uploadFileWithChunks(file, folderId = null, onProgress = null) {
        // 与后端 Telegram 分片大小对齐，避免前端与后端产生不一致的分片策略
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk
        // const CHUNK_SIZE = 25 * 1024 * 1024; // 25MB per chunk
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId = this.generateUploadId();

        console.log(`开始分片上传: ${file.name}, 大小: ${this.formatFileSize(file.size)}, 分片数: ${totalChunks}`);

        try {
            const uploadedChunks = [];
            let uploadedBytes = 0;

            // 逐个上传分片
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunkBlob = file.slice(start, end);

                console.log(`上传分片 ${chunkIndex + 1}/${totalChunks}: ${this.formatFileSize(chunkBlob.size)}`);

                // 创建分片文件对象
                const chunkFile = new File([chunkBlob], `${file.name}.chunk.${chunkIndex}`, {
                    type: file.type
                });

                // 上传分片
                const chunkResult = await this.apiClient.uploadFileChunk({
                    file: chunkFile,
                    uploadId: uploadId,
                    chunkIndex: chunkIndex,
                    totalChunks: totalChunks,
                    originalFileName: file.name,
                    originalFileSize: file.size,
                    folderId: folderId
                });

                uploadedChunks.push(chunkResult);
                uploadedBytes += chunkBlob.size;

                // 更新进度
                if (onProgress) {
                    const progress = (uploadedBytes / file.size) * 100;
                    onProgress(progress);
                }

                console.log(`分片 ${chunkIndex + 1}/${totalChunks} 上传完成`);
            }

            console.log(`所有分片上传完成，开始合并文件`);

            // 通知后端合并分片
            const mergeResult = await this.apiClient.mergeFileChunks({
                uploadId: uploadId,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                folderId: folderId,
                chunks: uploadedChunks
            });

            console.log(`文件合并完成: ${file.name}`);
            return mergeResult;

        } catch (error) {
            console.error(`分片上传失败: ${file.name}`, error);

            // 尝试清理已上传的分片
            try {
                await this.apiClient.cleanupFailedUpload(uploadId);
            } catch (cleanupError) {
                console.warn('清理失败的上传分片时出错:', cleanupError);
            }

            // 重新抛出原始错误
            const newError = new Error(`分片上传失败: ${error.message}`);
            newError.fileName = file.name;
            newError.fileSize = file.size;
            newError.uploadId = uploadId;
            newError.timestamp = new Date().toISOString();
            throw newError;
        }
    }

    /**
     * 生成唯一的上传ID
     * @returns {string} - 上传ID
     */
    generateUploadId() {
        return 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 获取文件信息
     * @param {string} fileId - 文件ID
     * @returns {Promise<Object>} - 文件信息
     */
    async getFileInfo(fileId) {
        try {
            console.log(`获取文件信息: ID ${fileId}`);
            const result = await this.apiClient.getFileInfo(fileId);
            console.log(`文件信息获取成功: ID ${fileId}, 名称: ${result.name}, 大小: ${this.formatFileSize(result.size)}`);
            return result;
        } catch (error) {
            console.error('获取文件信息失败:', error);

            // 创建新的错误对象，保留原始错误的详细信息
            const newError = new Error('获取文件信息失败：' + error.message);

            // 复制原始错误的属性
            if (error.status) newError.status = error.status;
            if (error.url) newError.url = error.url;
            if (error.method) newError.method = error.method;
            if (error.details) newError.details = error.details;
            if (error.timestamp) newError.timestamp = error.timestamp;

            // 添加文件ID
            newError.fileId = fileId;

            throw newError;
        }
    }

    /**
     * 更新文件名称
     * @param {string} fileId - 文件ID
     * @param {string} newName - 新文件名
     * @returns {Promise<Object>} - 更新结果
     */
    async updateFileName(fileId, newName) {
        try {
            console.log(`重命名文件: ID ${fileId}, 新名称: ${newName}`);
            const result = await this.apiClient.updateFile(fileId, newName);
            console.log(`文件重命名成功: ID ${fileId}, 新名称: ${newName}`);
            return result;
        } catch (error) {
            console.error('重命名文件失败:', error);

            // 创建新的错误对象，保留原始错误的详细信息
            const newError = new Error('重命名文件失败：' + error.message);

            // 复制原始错误的属性
            if (error.status) newError.status = error.status;
            if (error.url) newError.url = error.url;
            if (error.method) newError.method = error.method;
            if (error.details) newError.details = error.details;
            if (error.timestamp) newError.timestamp = error.timestamp;

            // 添加文件信息
            newError.fileId = fileId;
            newError.newName = newName;

            throw newError;
        }
    }

    /**
     * 删除文件
     * @param {string} fileId - 文件ID
     * @returns {Promise<Object>} - 删除结果
     */
    async deleteFile(fileId) {
        try {
            console.log(`删除文件: ID ${fileId}`);
            const result = await this.apiClient.deleteFile(fileId);
            console.log(`文件删除成功: ID ${fileId}`);
            return result;
        } catch (error) {
            console.error('删除文件失败:', error);

            // 创建新的错误对象，保留原始错误的详细信息
            const newError = new Error('删除文件失败：' + error.message);

            // 复制原始错误的属性
            if (error.status) newError.status = error.status;
            if (error.url) newError.url = error.url;
            if (error.method) newError.method = error.method;
            if (error.details) newError.details = error.details;
            if (error.timestamp) newError.timestamp = error.timestamp;

            // 添加文件ID
            newError.fileId = fileId;

            throw newError;
        }
    }

    /**
     * 下载文件
     * @param {string} fileId - 文件ID
     * @param {string} fileName - 文件名
     * @param {Function|null} onProgress - 进度回调函数
     * @returns {Promise<void>}
     */
    async downloadFile(fileId, fileName, onProgress = null) {
        try {
            console.log(`开始下载文件: ${fileName} (ID: ${fileId})`);
            const startTime = new Date().getTime();

            // 调用API客户端下载文件
            const response = await this.apiClient.downloadFile(fileId, onProgress);

            // 创建下载链接
            const blob = await response.blob();
            console.log(`文件下载完成: ${fileName}, 大小: ${this.formatFileSize(blob.size)}`);

            const url = window.URL.createObjectURL(blob);

            // 触发下载
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();

            // 清理
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            const endTime = new Date().getTime();
            console.log(`文件下载处理完成: ${fileName}, 耗时: ${(endTime - startTime) / 1000}秒`);

        } catch (error) {
            console.error('下载文件失败:', error);

            // 保留原始错误的详细信息
            if (error.message.includes('下载文件失败')) {
                // 已经是格式化过的错误，直接抛出
                throw error;
            } else {
                // 创建新的错误对象，保留原始错误的详细信息
                const newError = new Error('下载文件失败：' + error.message);

                // 复制原始错误的属性
                if (error.fileId) newError.fileId = error.fileId;
                if (error.status) newError.status = error.status;
                if (error.url) newError.url = error.url;
                if (error.method) newError.method = error.method;
                if (error.details) newError.details = error.details;
                if (error.timestamp) newError.timestamp = error.timestamp;

                // 添加文件名
                newError.fileName = fileName;

                throw newError;
            }
        }
    }

    /**
     * 获取文件夹路径
     * @param {string} folderId - 文件夹ID
     * @returns {Promise<Array>} - 文件夹路径
     */
    async getFolderPath(folderId) {
        console.log(`获取文件夹路径: ID ${folderId}`);
        try {
            // 由于后端没有直接提供路径API，这里使用递归方式构建路径
            // 实际项目中可以在后端实现一个专门的路径API
            const path = [];
            let currentId = folderId;

            while (currentId) {
                // 这里需要后端提供获取单个文件夹信息的API
                // 或者从目录列表中查找
                const folderInfo = await this.getFolderInfo(currentId);
                if (!folderInfo) break;

                path.unshift(folderInfo);
                currentId = folderInfo.parent_id;
            }

            console.log(`文件夹路径获取成功: ID ${folderId}, 路径长度: ${path.length}`);
            return path;
        } catch (error) {
            console.error('获取文件夹路径失败:', error);
            // 这里不抛出错误，而是返回空数组，因为这个方法主要用于UI显示，失败不应阻止整个应用
            return [];
        }
    }

    /**
     * 获取文件夹信息（辅助方法）
     * @param {string} folderId - 文件夹ID
     * @returns {Promise<Object|null>} - 文件夹信息
     */
    async getFolderInfo(folderId) {
        try {
            console.log(`获取文件夹信息: ID ${folderId}`);
            // 调用 API 客户端获取单个文件夹信息
            const result = await this.apiClient.getFolderInfo(folderId);
            console.log(`文件夹信息获取成功: ID ${folderId}, 名称: ${result.name}`);
            return result;
        } catch (error) {
            console.error('获取文件夹信息失败:', error);
            // 这里不抛出错误，而是返回null，因为这个方法主要用于辅助getFolderPath方法
            return null;
        }
    }

    /**
     * 验证文件
     */
    validateFile(file) {
        // 检查文件大小（最大 2GB）
        const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
        if (file.size > maxSize) {
            throw new Error('文件大小超过限制（最大 2GB）');
        }

        // 检查文件名
        if (!file.name || file.name.trim() === '') {
            throw new Error('文件名无效');
        }

        // 检查危险文件类型
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
        const fileExtension = this.getFileExtension(file.name).toLowerCase();

        if (dangerousExtensions.includes(fileExtension)) {
            throw new Error('出于安全考虑，不允许上传此类型的文件');
        }

        return true;
    }

    /**
     * 获取文件扩展名
     */
    getFileExtension(fileName) {
        const lastDotIndex = fileName.lastIndexOf('.');
        return lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
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
     * 获取文件类型图标
     */
    getFileIcon(mimeType) {
        if (!mimeType) return '📄';

        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎬';
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
     * 批量上传文件
     * @param {Array<File>} files - 要上传的文件数组
     * @param {string|null} folderId - 目标文件夹ID
     * @param {Function|null} onProgress - 进度回调函数
     * @returns {Promise<Object>} - 上传结果
     */
    async uploadMultipleFiles(files, folderId = null, onProgress = null) {
        console.log(`开始批量上传文件: ${files.length}个文件, 目标文件夹ID: ${folderId || '根目录'}`);
        const startTime = new Date().getTime();
        const results = [];
        const errors = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`上传第${i+1}/${files.length}个文件: ${file.name}, 大小: ${this.formatFileSize(file.size)}`);

            try {
                const progressCallback = onProgress ? (progress) => {
                    onProgress(i, file.name, progress);
                } : null;

                const result = await this.uploadFile(file, folderId, progressCallback);
                results.push({ file: file.name, result, success: true });
                console.log(`文件上传成功: ${file.name}`);
            } catch (error) {
                console.error(`上传文件 ${file.name} 失败:`, error);
                // 保留原始错误的详细信息
                const errorDetails = {
                    file: file.name,
                    error: error.message,
                    success: false
                };

                // 复制原始错误的属性
                if (error.fileName) errorDetails.fileName = error.fileName;
                if (error.fileSize) errorDetails.fileSize = error.fileSize;
                if (error.folderId) errorDetails.folderId = error.folderId;
                if (error.status) errorDetails.status = error.status;
                if (error.url) errorDetails.url = error.url;
                if (error.method) errorDetails.method = error.method;
                if (error.details) errorDetails.details = error.details;
                if (error.timestamp) errorDetails.timestamp = error.timestamp;

                errors.push(errorDetails);
                results.push(errorDetails);
            }
        }

        const endTime = new Date().getTime();
        console.log(`批量上传完成: 成功${results.filter(r => r.success).length}个, 失败${errors.length}个, 总耗时: ${(endTime - startTime) / 1000}秒`);

        return {
            results,
            errors,
            successCount: results.filter(r => r.success).length,
            errorCount: errors.length,
            totalTime: (endTime - startTime) / 1000
        };
    }
}
