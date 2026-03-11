// Telegram 服务模块
// 提供 Telegram Bot API 文件存储功能

/**
 * Telegram 服务类
 */
export class TelegramService {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.apiBaseUrl = `https://api.telegram.org/bot${botToken}`;
    // 不在构造器中固定 chunkSize，按每个文件总大小动态选择分片大小（与前端保持一致）
  }

  /**
   * 上传文件到 Telegram
   * @param {Uint8Array} fileData - 文件数据
   * @param {string} fileName - 文件名
   * @returns {Array} 上传的telegramFileId列表
   */
  async uploadFile(fileData, fileName) {
    console.log(`[TELEGRAM] 开始上传文件到 Telegram: ${fileName}, 大小: ${fileData.length} 字节`);

    // 放宽最大文件限制以与前端一致（前端允许最大 2GB）
    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
    if (fileData.length > MAX_FILE_SIZE) {
      throw new Error(`文件大小超出限制: ${fileData.length} 字节，最大允许: ${MAX_FILE_SIZE} 字节`);
    }

    try {
      // 分片策略（与前端统一）
      // - 文件 <= 50MB：不分片，直接一次性上传
      // - 50MB < 文件 <= 200MB：使用 20MB 分片
      // - 文件 > 200MB：使用 10MB 分片
      const NO_CHUNK_LIMIT = 50 * 1024 * 1024; // 50MB
      const MID_LIMIT = 200 * 1024 * 1024; // 200MB
      const CHUNK_20MB = 20 * 1024 * 1024; // 20MB
      const CHUNK_10MB = 10 * 1024 * 1024; // 10MB

      let chunkSize;
      if (fileData.length <= NO_CHUNK_LIMIT) {
        chunkSize = fileData.length; // 单次上传
      } else if (fileData.length <= MID_LIMIT) {
        chunkSize = CHUNK_20MB;
      } else {
        chunkSize = CHUNK_10MB;
      }

      // 计算分片数量和大小，但不创建所有分片
      const totalChunks = Math.ceil(fileData.length / chunkSize);
      console.log(`[TELEGRAM] 文件 ${fileName} 将分割为 ${totalChunks} 个分片，分片大小: ${chunkSize} 字节`);

      const messageIds = [];

      // 流式处理：一次只处理一个分片
      for (let i = 0; i < totalChunks; i++) {
        const startOffset = i * chunkSize;
        const endOffset = Math.min(startOffset + chunkSize, fileData.length);

        // 创建单个分片，避免同时保存所有分片
        let chunk = fileData.slice(startOffset, endOffset);

        const chunkFileName = totalChunks > 1
          ? `${fileName}.part${i.toString().padStart(3, '0')}`
          : fileName;

        console.log(`[TELEGRAM] 上传分片 ${i+1}/${totalChunks}: ${chunkFileName}, 大小: ${chunk.length} 字节`);
        const startTime = Date.now();

        try {
          const telegramResult = await this.uploadChunk(chunk, chunkFileName);
          const duration = Date.now() - startTime;
          console.log(`[TELEGRAM] 分片 ${i+1}/${totalChunks} 上传完成，用时: ${duration}ms, 文件ID: ${telegramResult.document.file_id.substring(0, 10)}...`);

          messageIds.push({
            index: i,
            telegramFileId: telegramResult.document.file_id,
            telegramMessageId: telegramResult.message_id,
            size: chunk.length
          });
        } catch (chunkError) {
          console.error(`[TELEGRAM] [ERROR] 上传分片 ${i+1}/${totalChunks} 失败:`, chunkError);
          throw new Error(`上传分片 ${i+1}/${totalChunks} 失败: ${chunkError.message}`);
        }

        // 手动释放分片内存引用（虽然 JS 有垃圾回收，但显式释放有助于减少内存压力）
        // 主动覆盖分片内容并释放引用，帮助在高内存压力下尽早回收
        try {
          if (chunk && typeof chunk.fill === 'function') {
            chunk.fill(0);
          }
        } catch (e) {
          // ignore fill errors
        }
        chunk = null;
        if (typeof globalThis !== 'undefined' && typeof globalThis.gc === 'function') {
          try { globalThis.gc(); } catch (e) {}
        }
      }

      console.log(`[TELEGRAM] 文件 ${fileName} 上传到 Telegram 完成，共 ${totalChunks} 个分片`);
      return messageIds;
    } catch (error) {
      console.error(`[TELEGRAM] [ERROR] 上传文件 ${fileName} 到 Telegram 失败:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        fileName: fileName,
        fileSize: fileData.length,
        errorStack: error.stack
      };
      throw new Error(`上传文件到 Telegram 失败: ${errorMessage}`, { cause: errorDetails });
    }
  }

  /**
   * 从 Telegram 下载文件
   * @param {Array} chunks - 文件分片信息数组 [{ telegram_file_id, chunk_index, size }]
   * @returns {Uint8Array} 合并后的文件数据
   */
  async downloadFile(chunks) {
    console.log(`[TELEGRAM] 开始从 Telegram 下载文件，共 ${chunks.length} 个分片`);
    try {
      // 按索引排序分片
      const sortedChunks = chunks.sort((a, b) => a.chunk_index - b.chunk_index);
      console.log(`[TELEGRAM] 分片已排序，准备下载`);
      const chunkDataArray = [];

      for (let i = 0; i < sortedChunks.length; i++) {
        const chunk = sortedChunks[i];
        console.log(`[TELEGRAM] 下载分片 ${i+1}/${sortedChunks.length}, 文件ID: ${chunk.telegram_file_id.substring(0, 10)}...`);
        const startTime = Date.now();
        const chunkData = await this.downloadChunk(chunk.telegram_file_id);
        const duration = Date.now() - startTime;
        console.log(`[TELEGRAM] 分片 ${i+1}/${sortedChunks.length} 下载完成，大小: ${chunkData.length} 字节，用时: ${duration}ms`);
        chunkDataArray.push(chunkData);
      }

      // 合并所有分片
      console.log(`[TELEGRAM] 所有分片下载完成，开始合并`);
      const mergedData = this.mergeChunks(chunkDataArray);
      console.log(`[TELEGRAM] 分片合并完成，总大小: ${mergedData.length} 字节`);

      // 主动清理已下载的分片数据，覆盖并释放引用以减少内存峰值
      try {
        for (let j = 0; j < chunkDataArray.length; j++) {
          const c = chunkDataArray[j];
          if (c && typeof c.fill === 'function') {
            try { c.fill(0); } catch (e) {}
          }
          chunkDataArray[j] = null;
        }
      } catch (e) {
        // ignore cleanup errors
      }

      if (typeof globalThis !== 'undefined' && typeof globalThis.gc === 'function') {
        try { globalThis.gc(); } catch (e) {}
      }

      return mergedData;
    } catch (error) {
      console.error(`[TELEGRAM] [ERROR] 从 Telegram 下载文件失败:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        chunksCount: chunks.length,
        chunkIds: chunks.map(chunk => chunk.telegram_file_id).join(','),
        errorStack: error.stack,
        timestamp: new Date().toISOString()
      };
      throw new Error(`从 Telegram 下载文件失败: ${errorMessage}`, { cause: errorDetails });
    }
  }

  /**
   * 删除 Telegram 中的文件
   * @param {Array} chunks - 文件分片信息数组
   */
  async deleteFile(chunks) {
    try {
      for (const chunk of chunks) {
        await this.deleteTelegramFileById(chunk);
      }
    } catch (error) {
      console.error('Error deleting file from Telegram:', error);
      // 不抛出错误，因为删除失败不应该阻止数据库操作
    }
  }

  /**
   * 将文件分割成分片（已弃用，使用流式处理替代）
   * @deprecated 使用流式处理替代，避免内存溢出
   * @param {Uint8Array} fileData - 文件数据
   * @returns {Array} 分片数组
   */
  splitFileIntoChunks(fileData, chunkSize = 5 * 1024 * 1024) {
    // 这个方法已经在 uploadFile 中用流式处理替代
    // 保留此方法以确保向后兼容，但不建议直接使用
    console.warn('[TELEGRAM] [DEPRECATED] splitFileIntoChunks 方法已弃用，建议使用流式处理');

    const chunks = [];
    let offset = 0;

    while (offset < fileData.length) {
      const currentChunkSize = Math.min(chunkSize, fileData.length - offset);
      const chunk = fileData.slice(offset, offset + currentChunkSize);
      chunks.push(chunk);
      offset += currentChunkSize;
    }

    return chunks;
  }

  /**
   * 合并文件分片
   * @param {Array} chunkDataArray - 分片数据数组
   * @returns {Uint8Array} 合并后的文件数据
   */
  mergeChunks(chunkDataArray) {
    // 计算总大小
    const totalSize = chunkDataArray.reduce((sum, chunk) => sum + chunk.length, 0);

    // 创建新的 Uint8Array
    const mergedData = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of chunkDataArray) {
      mergedData.set(chunk, offset);
      offset += chunk.length;
    }

    return mergedData;
  }

  /**
   * 上传单个分片到 Telegram
   * @param {Uint8Array} chunkData - 分片数据
   * @param {string} fileName - 文件名
   * @returns {string} telegramFile的ID
   */
  async uploadChunk(chunkOrBlob, fileName) {
    try {
      let formData = new FormData();
      formData.append('chat_id', this.chatId);

      let size = 0;
      // 支持传入 Uint8Array 或 Blob/File，避免在 Worker 中不必要的复制
      if (chunkOrBlob instanceof Uint8Array) {
        formData.append('document', new Blob([chunkOrBlob]), fileName);
        size = chunkOrBlob.length;
      } else {
        // 假设为 Blob / File
        formData.append('document', chunkOrBlob, fileName);
        try { size = chunkOrBlob.size || 0; } catch (e) { size = 0; }
      }

      console.log(`[TELEGRAM] 发送请求到 Telegram API: /sendDocument, 文件名: ${fileName}, 大小: ${size} 字节`);
      const response = await fetch(`${this.apiBaseUrl}/sendDocument`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        console.error(`[TELEGRAM] [ERROR] Telegram API 响应错误: ${response.status} ${response.statusText}`);
        throw new Error(`Telegram API HTTP error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.ok) {
        console.error(`[TELEGRAM] [ERROR] Telegram API 返回错误: ${result.description}`);
        throw new Error(`Telegram API error: ${result.description}`);
      }

      // 尝试尽早释放对表单数据的引用
      try { formData = null; } catch (e) {}

      return result.result;
    } catch (error) {
      console.error(`[TELEGRAM] [ERROR] 上传分片到 Telegram 失败:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        fileName: fileName,
        chunkSize: chunkData.length,
        errorStack: error.stack
      };
      throw new Error(`上传分片到 Telegram 失败: ${errorMessage}`, { cause: errorDetails });
    }
  }

  /**
   * 从 Telegram 下载单个分片
   * @param {string} telegram_file_id - Telegram文件ID
   * @returns {Uint8Array} 分片数据
   */
  async downloadChunk(telegram_file_id) {
    try {
      // 首先获取文件信息
      console.log(`[TELEGRAM] 获取文件信息，文件ID: ${telegram_file_id.substring(0, 10)}...`);
      const fileInfo = await this.getFileInfo(telegram_file_id);
      console.log(`[TELEGRAM] 文件信息获取成功，文件路径: ${fileInfo.file_path}`);

      // 然后下载文件
      console.log(`[TELEGRAM] 开始下载文件: ${fileInfo.file_path}`);
      const response = await fetch(`https://api.telegram.org/file/bot${this.botToken}/${fileInfo.file_path}`);

      if (!response.ok) {
        console.error(`[TELEGRAM] [ERROR] 下载文件失败: ${response.status} ${response.statusText}`);
        throw new Error(`下载文件失败: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      console.log(`[TELEGRAM] 文件下载成功，大小: ${data.length} 字节`);
      return data;
    } catch (error) {
      console.error(`[TELEGRAM] [ERROR] 从 Telegram 下载分片失败:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        telegram_file_id: telegram_file_id,
        errorStack: error.stack
      };
      throw new Error(`从 Telegram 下载分片失败: ${errorMessage}`, { cause: errorDetails });
    }
  }

  /**
   * 获取文件信息
   * @param {string} telegramFileId - Telegram文件ID
   * @returns {Object} 文件信息
   */
  async getFileInfo(telegramFileId) {
    try {
      console.log(`[TELEGRAM] 直接通过文件ID获取文件信息: ${telegramFileId.substring(0, 10)}...`);
      // 直接通过文件ID获取文件详细信息
      const fileResponse = await fetch(`${this.apiBaseUrl}/getFile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_id: telegramFileId
        })
      });

      const fileResult = await fileResponse.json();

      if (!fileResult.ok) {
        console.error(`[TELEGRAM] [ERROR] 获取文件信息失败: ${fileResult.description}`);
        throw new Error(`获取文件信息失败: ${fileResult.description}`);
      }

      return fileResult.result;
    } catch (error) {
      console.error(`[TELEGRAM] [ERROR] 获取文件信息失败:`, error);
      // 提供更详细的错误信息
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = {
        telegram_file_id: telegramFileId,
        errorStack: error.stack
      };
      throw new Error(`获取文件信息失败: ${errorMessage}`, { cause: errorDetails });
    }
  }

  /**
   * 删除 Telegram 文件
   * @param {string} telegram_file_id - 文件id
   */
	// todo telegram 是否支持直接删除文件
  async deleteTelegramFileById(chunk) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/deleteMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          message_id: parseInt(chunk.telegram_message_id)
        })
      });
			
      const result = await response.json();
			
      if (!result.ok) {
        console.warn(`Failed to delete message ${chunk.telegram_message_id}: ${result.description}`);
      }
    } catch (error) {
      console.warn('Error deleting message from Telegram:', error);
    }
  }

  /**
   * 测试 Bot 连接
   * @returns {boolean} 连接是否成功
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/getMe`);
      const result = await response.json();
      return result.ok;
    } catch (error) {
      console.error('Error testing Telegram connection:', error);
      return false;
    }
  }
}
