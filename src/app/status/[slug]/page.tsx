"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface Monitor {
  id: string;
  name: string;
  type: string;
  status: number | null;
  active: boolean;
  lastCheckAt: string | null;
  description: string | null;
}

interface StatusPageData {
  id: string;
  name: string;
  title: string;
  slug: string;
  monitors: Monitor[];
  statistics: {
    total: number;
    normal: number;
    error: number;
    paused: number;
    unknown: number;
    uptime: number;
  };
  lastUpdated: string;
}

export default function StatusPage() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [statusData, setStatusData] = useState<StatusPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取状态页数据
  const fetchStatusData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/status/${slug}`);
      if (response.ok) {
        const data = await response.json();
        setStatusData(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '状态页不存在');
      }
    } catch (error) {
      console.error('获取状态页数据失败:', error);
      setError('获取状态页数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      fetchStatusData();
    }
  }, [slug]);

  // 自动刷新
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchStatusData();
      }
    }, 30000); // 每30秒刷新一次

    return () => clearInterval(interval);
  }, [loading]);

  // 获取状态显示文本
  const getStatusText = (monitor: Monitor) => {
    if (!monitor.active) return "暂停";
    if (monitor.status === 1) return "正常";
    if (monitor.status === 0) return "故障";
    return "未知";
  };

  // 获取状态样式类
  const getStatusClass = (monitor: Monitor) => {
    if (!monitor.active) return "bg-foreground/20 text-foreground/50";
    if (monitor.status === 1) return "bg-success/20 text-success";
    if (monitor.status === 0) return "bg-error/20 text-error";
    return "bg-warning/20 text-warning";
  };

  // 获取状态图标
  const getStatusIcon = (monitor: Monitor) => {
    if (!monitor.active) return "fas fa-pause";
    if (monitor.status === 1) return "fas fa-check-circle";
    if (monitor.status === 0) return "fas fa-exclamation-circle";
    return "fas fa-question-circle";
  };

  // 格式化时间
  const formatTime = (dateString: string | null) => {
    if (!dateString) return "暂无检查";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return "刚刚";
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}天前`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-light-bg to-light-bg/95 dark:from-dark-bg dark:to-dark-bg/95 flex items-center justify-center">
        <div className="text-center">
          <div className="text-primary mb-4">
            <i className="fas fa-spinner fa-spin text-4xl"></i>
          </div>
          <p className="text-foreground/60">加载状态页中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-light-bg to-light-bg/95 dark:from-dark-bg dark:to-dark-bg/95 flex items-center justify-center">
        <div className="text-center">
          <div className="text-error mb-4">
            <i className="fas fa-exclamation-triangle text-4xl"></i>
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">状态页不可用</h1>
          <p className="text-foreground/60">{error}</p>
        </div>
      </div>
    );
  }

  if (!statusData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-bg to-light-bg/95 dark:from-dark-bg dark:to-dark-bg/95">
      <div className="max-w-6xl mx-auto px-6 py-12">


        {/* 头部 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {statusData.title}
          </h1>
          <p className="text-foreground/60 text-lg">
            实时监控系统状态
          </p>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="dark:bg-dark-card bg-light-card rounded-lg border border-primary/10 p-6 text-center">
            <div className="text-3xl font-bold text-foreground mb-2">
              {statusData.statistics.total}
            </div>
            <div className="text-sm text-foreground/60">总计</div>
          </div>
          
          <div className="dark:bg-dark-card bg-light-card rounded-lg border border-primary/10 p-6 text-center">
            <div className="text-3xl font-bold text-success mb-2">
              {statusData.statistics.normal}
            </div>
            <div className="text-sm text-foreground/60">正常</div>
          </div>
          
          <div className="dark:bg-dark-card bg-light-card rounded-lg border border-primary/10 p-6 text-center">
            <div className="text-3xl font-bold text-error mb-2">
              {statusData.statistics.error}
            </div>
            <div className="text-sm text-foreground/60">故障</div>
          </div>
          
          <div className="dark:bg-dark-card bg-light-card rounded-lg border border-primary/10 p-6 text-center">
            <div className="text-3xl font-bold text-warning mb-2">
              {statusData.statistics.paused}
            </div>
            <div className="text-sm text-foreground/60">暂停</div>
          </div>
          
          <div className="dark:bg-dark-card bg-light-card rounded-lg border border-primary/10 p-6 text-center">
            <div className="text-3xl font-bold text-primary mb-2">
              {statusData.statistics.uptime}%
            </div>
            <div className="text-sm text-foreground/60">24小时可用性</div>
          </div>
        </div>

        {/* 监控项列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statusData.monitors.map((monitor) => (
            <div
              key={monitor.id}
              className="dark:bg-dark-card bg-light-card rounded-lg border border-primary/10 p-6 hover:border-primary/20 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {monitor.name}
                  </h3>
                  {monitor.description && (
                    <p className="text-sm text-foreground/60">
                      {monitor.description}
                    </p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(monitor)}`}>
                  <i className={`${getStatusIcon(monitor)} mr-1`}></i>
                  {getStatusText(monitor)}
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground/60">最后检查:</span>
                  <span className="text-foreground/80">
                    {formatTime(monitor.lastCheckAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 底部信息 */}
        <div className="text-center mt-12 pt-8 border-t border-foreground/10">
          <p className="text-foreground/60 text-sm">
            最后更新: {new Date(statusData.lastUpdated).toLocaleString('zh-CN')} • 
            自动刷新: 30秒
          </p>
        </div>
      </div>
    </div>
  );
} 