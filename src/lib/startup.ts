/**
 * 系统启动脚本
 * 在服务器启动时自动初始化监控系统
 */
import { upgradeDatabaseIfNeeded } from './database-upgrader';

/**
 * 强制初始化系统
 * 用于系统启动时，确保监控系统被初始化
 */
export async function forceInitSystem() {
  try {
    console.log('系统启动时强制初始化监控系统...');
    
    // 执行数据库迁移
    try {
      console.log('开始执行数据库升级...');
      await upgradeDatabaseIfNeeded();
    } catch (error) {
      console.error('数据库升级失败:', error);
    }
    
    // 启动数据清理任务
    try {
      const { startDataCleanupJob } = await import('./monitors/data-cleaner');
      startDataCleanupJob();
      console.log('数据清理定时任务已启动');
    } catch (error) {
      console.error('启动数据清理任务失败:', error);
    }
    
    try {
      // 动态导入监控调度器
      const { resetAllMonitors } = await import('./monitors/scheduler');
      
      // 重置所有监控项
      const count = await resetAllMonitors();
      
      console.log(`系统启动初始化成功，已启动 ${count} 个监控项`);
    } catch (error) {
      console.error('系统启动初始化失败:', error);
    }
    
    console.log(`监控系统启动初始化完成`);
    return true;
  } catch (error) {
    console.error('监控系统启动初始化处理失败:', error);
    return false;
  }
}

// 导出标记，表示此模块已加载
export const SYSTEM_INITIALIZED = true; 