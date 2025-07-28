"use client";

import { useState, useEffect } from "react";

interface Monitor {
  id: string;
  name: string;
  type: string;
  url?: string;
  host?: string;
  port?: number;
}

interface StatusPageMonitor {
  monitorId: string;
  displayName?: string;
  order: number;
  monitor: Monitor;
}

interface MonitorManagerProps {
  statusPageId: string;
  statusPageName: string;
  onClose: () => void;
}

export function MonitorManager({ statusPageId, statusPageName, onClose }: MonitorManagerProps) {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [statusPageMonitors, setStatusPageMonitors] = useState<StatusPageMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingMonitor, setAddingMonitor] = useState(false);
  const [selectedMonitorId, setSelectedMonitorId] = useState('');
  const [displayName, setDisplayName] = useState('');

  // 获取所有监控项
  const fetchMonitors = async () => {
    try {
      const response = await fetch('/api/monitors');
      if (response.ok) {
        const data = await response.json();
        setMonitors(data);
      }
    } catch (error) {
      console.error('获取监控项失败:', error);
    }
  };

  // 获取状态页的监控项
  const fetchStatusPageMonitors = async () => {
    try {
      const response = await fetch(`/api/status-pages/${statusPageId}/monitors`);
      if (response.ok) {
        const data = await response.json();
        setStatusPageMonitors(data);
      }
    } catch (error) {
      console.error('获取状态页监控项失败:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMonitors(), fetchStatusPageMonitors()]);
      setLoading(false);
    };
    loadData();
  }, [statusPageId]);

  // 添加监控项到状态页
  const addMonitorToStatusPage = async () => {
    if (!selectedMonitorId) return;

    setAddingMonitor(true);
    try {
      const response = await fetch(`/api/status-pages/${statusPageId}/monitors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          monitorId: selectedMonitorId,
          displayName: displayName.trim() || undefined
        })
      });

      if (response.ok) {
        await fetchStatusPageMonitors();
        setSelectedMonitorId('');
        setDisplayName('');
      } else {
        const error = await response.json();
        alert(`添加监控项失败: ${error.error}`);
      }
    } catch (error) {
      console.error('添加监控项失败:', error);
      alert('添加监控项失败');
    } finally {
      setAddingMonitor(false);
    }
  };

  // 从状态页移除监控项
  const removeMonitorFromStatusPage = async (monitorId: string) => {
    if (!confirm('确定要移除此监控项吗？')) return;

    try {
      const response = await fetch(`/api/status-pages/${statusPageId}/monitors/${monitorId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchStatusPageMonitors();
      } else {
        const error = await response.json();
        alert(`移除监控项失败: ${error.error}`);
      }
    } catch (error) {
      console.error('移除监控项失败:', error);
      alert('移除监控项失败');
    }
  };

  // 获取监控项类型显示名称
  const getMonitorTypeName = (type: string) => {
    const typeNames: Record<string, string> = {
      'http': 'HTTP监控',
      'https-cert': 'HTTPS证书',
      'port': '端口监控',
      'keyword': '关键词监控',
      'push': '推送监控',
      'mysql': 'MySQL监控',
      'redis': 'Redis监控',
      'icmp': 'ICMP监控'
    };
    return typeNames[type] || type;
  };

  // 获取监控项显示信息
  const getMonitorDisplayInfo = (monitor: Monitor) => {
    switch (monitor.type) {
      case 'http':
      case 'https-cert':
      case 'keyword':
        return monitor.url || '未知URL';
      case 'port':
        return `${monitor.host}:${monitor.port}`;
      case 'mysql':
      case 'redis':
        return `${monitor.host}:${monitor.port}`;
      default:
        return monitor.name;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="dark:bg-dark-card bg-light-card rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>加载中...</span>
          </div>
        </div>
      </div>
    );
  }

  // 过滤掉已添加的监控项
  const availableMonitors = monitors.filter(
    monitor => !statusPageMonitors.some(spm => spm.monitorId === monitor.id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="dark:bg-dark-card bg-light-card rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            管理状态页监控项 - {statusPageName}
          </h2>
          <button
            onClick={onClose}
            className="text-foreground/60 hover:text-foreground transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* 添加监控项区域 */}
        <div className="mb-6 p-4 border border-primary/20 rounded-lg">
          <h3 className="text-lg font-medium text-foreground mb-4">添加监控项</h3>
          
          {availableMonitors.length === 0 ? (
            <p className="text-foreground/60">所有监控项已添加到状态页</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  选择监控项
                </label>
                                      <select
                        value={selectedMonitorId}
                        onChange={(e) => setSelectedMonitorId(e.target.value)}
                        className="w-full px-3 py-2 border border-primary/20 rounded-lg dark:bg-dark-nav bg-light-nav text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="" className="text-foreground">请选择监控项</option>
                        {availableMonitors.map((monitor) => (
                          <option key={monitor.id} value={monitor.id} className="text-foreground">
                            {monitor.name} ({getMonitorTypeName(monitor.type)})
                          </option>
                        ))}
                      </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  显示名称（可选）
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="留空则使用原名称"
                                          className="w-full px-3 py-2 border border-primary/20 rounded-lg dark:bg-dark-nav bg-light-nav text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <button
                onClick={addMonitorToStatusPage}
                disabled={!selectedMonitorId || addingMonitor}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addingMonitor ? '添加中...' : '添加监控项'}
              </button>
            </div>
          )}
        </div>

        {/* 已添加的监控项列表 */}
        <div>
          <h3 className="text-lg font-medium text-foreground mb-4">已添加的监控项</h3>
          
          {statusPageMonitors.length === 0 ? (
            <p className="text-foreground/60">还没有添加任何监控项</p>
          ) : (
            <div className="space-y-3">
              {statusPageMonitors.map((spm, index) => (
                <div
                  key={spm.monitorId}
                  className="flex items-center justify-between p-3 border border-primary/10 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-foreground/40">#{index + 1}</span>
                      <div>
                        <div className="font-medium text-foreground">
                          {spm.displayName || spm.monitor.name}
                        </div>
                        <div className="text-sm text-foreground/60">
                          {getMonitorDisplayInfo(spm.monitor)}
                        </div>
                        <div className="text-xs text-foreground/40">
                          {getMonitorTypeName(spm.monitor.type)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removeMonitorFromStatusPage(spm.monitorId)}
                    className="text-error hover:text-error/80 transition-colors ml-4"
                    title="移除"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 