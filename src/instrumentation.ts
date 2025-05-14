/**
 * Next.js Instrumentation
 * 在服务器启动时自动初始化监控系统
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      console.log('========================');
      console.log('系统启动中，执行自动初始化...');
      
      // 动态导入初始化模块
      const { forceInitSystem } = await import('./lib/startup');
      
      // 调用系统初始化函数
      const result = await forceInitSystem();
      
      if (result) {
        console.log('系统初始化成功');
      } else {
        console.log('系统初始化失败或无需初始化');
      }
      console.log('========================');
    } catch (error) {
      console.error('系统自动初始化过程中发生错误:', error);
    }
  }
} 