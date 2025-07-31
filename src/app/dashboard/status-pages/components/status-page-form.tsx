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

interface StatusPage {
  id: string;
  name: string;
  slug: string;
  title: string;
  isPublic: boolean;
}

interface StatusPageFormProps {
  statusPage?: StatusPage | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function StatusPageForm({ statusPage, onClose, onSuccess }: StatusPageFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    title: '',
    isPublic: true
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 监控项管理状态
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [statusPageMonitors, setStatusPageMonitors] = useState<StatusPageMonitor[]>([]);
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>([]);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [addingMonitors, setAddingMonitors] = useState(false);

  useEffect(() => {
    if (statusPage) {
      setFormData({
        name: statusPage.name,
        slug: statusPage.slug,
        title: statusPage.title,
        isPublic: statusPage.isPublic
      });
      // 加载状态页的监控项
      fetchStatusPageMonitors();
    }
    // 加载所有监控项
    fetchMonitors();
  }, [statusPage]);

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
    if (!statusPage) return;
    
    try {
      const response = await fetch(`/api/status-pages/${statusPage.id}/monitors`);
      if (response.ok) {
        const data = await response.json();
        setStatusPageMonitors(data);
      }
    } catch (error) {
      console.error('获取状态页监控项失败:', error);
    }
  };

  // 临时存储要添加的监控项（用于创建模式）
  const [pendingMonitors, setPendingMonitors] = useState<Array<{
    monitorId: string;
    displayName?: string;
    monitor: Monitor;
  }>>([]);

  // 添加监控项到状态页
  const addMonitorToStatusPage = async () => {
    if (selectedMonitorIds.length === 0) return;

    const selectedMonitors = monitors.filter(m => selectedMonitorIds.includes(m.id));
    if (selectedMonitors.length === 0) return;

    if (statusPage) {
      // 编辑模式：直接添加到数据库
      setAddingMonitors(true);
      try {
        const response = await fetch(`/api/status-pages/${statusPage.id}/monitors`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            monitorIds: selectedMonitorIds,
            displayNames: displayNames
          })
        });

        if (response.ok) {
          await fetchStatusPageMonitors();
          setSelectedMonitorIds([]);
          setDisplayNames({});
        } else {
          const error = await response.json();
          alert(`添加监控项失败: ${error.error}`);
        }
      } catch (error) {
        console.error('添加监控项失败:', error);
        alert('添加监控项失败');
      } finally {
        setAddingMonitors(false);
      }
    } else {
      // 创建模式：临时存储
      setPendingMonitors(prev => [...prev, ...selectedMonitors.map(m => ({
        monitorId: m.id,
        displayName: displayNames[m.id] || undefined,
        monitor: m
      }))]);
      setSelectedMonitorIds([]);
      setDisplayNames({});
    }
  };

  // 从状态页移除监控项
  const removeMonitorFromStatusPage = async (monitorId: string) => {
    if (!confirm('确定要移除此监控项吗？')) return;

    if (statusPage) {
      // 编辑模式：从数据库移除
      try {
        const response = await fetch(`/api/status-pages/${statusPage.id}/monitors/${monitorId}`, {
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
    } else {
      // 创建模式：从临时列表移除
      setPendingMonitors(prev => prev.filter(pm => pm.monitorId !== monitorId));
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '请输入状态页名称';
    }

    if (!formData.slug.trim()) {
      newErrors.slug = '请输入URL标识符';
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'URL标识符只能包含小写字母、数字和连字符';
    }

    if (!formData.title.trim()) {
      newErrors.title = '请输入页面标题';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const url = statusPage 
        ? `/api/status-pages/${statusPage.id}`
        : '/api/status-pages';
      
      const method = statusPage ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        
        // 如果是创建模式且有待添加的监控项，则添加它们
        if (!statusPage && pendingMonitors.length > 0) {
          const newStatusPageId = result.id;
          for (const pendingMonitor of pendingMonitors) {
            try {
              await fetch(`/api/status-pages/${newStatusPageId}/monitors`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  monitorIds: [pendingMonitor.monitorId],
                  displayNames: {
                    [pendingMonitor.monitorId]: pendingMonitor.displayName
                  }
                })
              });
            } catch (error) {
              console.error('添加监控项失败:', error);
            }
          }
        }
        
        onSuccess();
      } else {
        const error = await response.json();
        alert(`操作失败: ${error.error}`);
      }
    } catch (error) {
      console.error('保存状态页失败:', error);
      alert('保存状态页失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 过滤掉已添加的监控项
  const availableMonitors = monitors.filter(
    monitor => !statusPageMonitors.some(spm => spm.monitorId === monitor.id) &&
               !pendingMonitors.some(pm => pm.monitorId === monitor.id)
  );

  // 合并已添加的监控项和待添加的监控项
  const allMonitors = statusPage 
    ? statusPageMonitors 
    : pendingMonitors.map(pm => ({
        monitorId: pm.monitorId,
        displayName: pm.displayName,
        order: 0,
        monitor: pm.monitor
      }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="dark:bg-dark-card bg-light-card rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            {statusPage ? '编辑状态页' : '创建状态页'}
          </h2>
          <button
            onClick={onClose}
            className="text-foreground/60 hover:text-foreground transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                状态页名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-dark-nav bg-light-nav text-foreground focus:outline-none ${
                  errors.name ? 'border-error' : 'border-primary/20 focus:border-primary'
                }`}
                placeholder="例如：主站监控"
              />
              {errors.name && (
                <p className="text-error text-sm mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                URL标识符 *
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => handleInputChange('slug', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-dark-nav bg-light-nav text-foreground focus:outline-none ${
                  errors.slug ? 'border-error' : 'border-primary/20 focus:border-primary'
                }`}
                placeholder="例如：main-site"
              />
              {errors.slug && (
                <p className="text-error text-sm mt-1">{errors.slug}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              页面标题 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg dark:bg-dark-nav bg-light-nav text-foreground focus:outline-none ${
                errors.title ? 'border-error' : 'border-primary/20 focus:border-primary'
              }`}
              placeholder="例如：主站服务状态"
            />
            {errors.title && (
              <p className="text-error text-sm mt-1">{errors.title}</p>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPublic"
              checked={formData.isPublic}
              onChange={(e) => handleInputChange('isPublic', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="isPublic" className="text-sm text-foreground">
              公开访问（无需登录即可查看）
            </label>
          </div>

          {/* 监控项管理 */}
          {(
            <div className="border-t border-primary/20 pt-6">
              <h3 className="text-lg font-medium text-foreground mb-4">管理监控项</h3>
              
              {/* 添加监控项区域 */}
              <div className="mb-6 p-4 border border-primary/20 rounded-lg">
                <h4 className="text-md font-medium text-foreground mb-4">添加监控项</h4>
                
                {availableMonitors.length === 0 ? (
                  <p className="text-foreground/60">所有监控项已添加到状态页</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        选择监控项（可多选）
                      </label>
                      <div className="h-64 overflow-y-auto border border-primary/20 rounded-lg p-3 dark:bg-dark-nav bg-light-nav">
                        {availableMonitors.map((monitor) => (
                          <label key={monitor.id} className="flex items-center space-x-3 p-2 hover:bg-primary/5 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedMonitorIds.includes(monitor.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMonitorIds(prev => [...prev, monitor.id]);
                                } else {
                                  setSelectedMonitorIds(prev => prev.filter(id => id !== monitor.id));
                                  setDisplayNames(prev => {
                                    const newNames = { ...prev };
                                    delete newNames[monitor.id];
                                    return newNames;
                                  });
                                }
                              }}
                              className="text-primary focus:ring-primary"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-foreground">
                                {monitor.name}
                              </div>
                              <div className="text-sm text-foreground/60">
                                {getMonitorDisplayInfo(monitor)}
                              </div>
                              <div className="text-xs text-foreground/40">
                                {getMonitorTypeName(monitor.type)}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                      {selectedMonitorIds.length > 0 && (
                        <p className="text-sm text-foreground/60 mt-2">
                          已选择 {selectedMonitorIds.length} 个监控项
                        </p>
                      )}
                    </div>

                    {selectedMonitorIds.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          自定义显示名称（可选）
                        </label>
                        <div className="space-y-2">
                          {selectedMonitorIds.map((monitorId) => {
                            const monitor = monitors.find(m => m.id === monitorId);
                            if (!monitor) return null;
                            
                            return (
                              <div key={monitorId} className="flex items-center space-x-3">
                                <span className="text-sm text-foreground/60 min-w-0 flex-1 truncate">
                                  {monitor.name}:
                                </span>
                                <input
                                  type="text"
                                  value={displayNames[monitorId] || ''}
                                  onChange={(e) => setDisplayNames(prev => ({
                                    ...prev,
                                    [monitorId]: e.target.value
                                  }))}
                                  placeholder="留空则使用原名称"
                                  className="flex-1 px-3 py-1 text-sm border border-primary/20 rounded dark:bg-dark-nav bg-light-nav text-foreground focus:border-primary focus:outline-none"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={addMonitorToStatusPage}
                      disabled={selectedMonitorIds.length === 0 || addingMonitors}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {addingMonitors ? '添加中...' : `添加 ${selectedMonitorIds.length} 个监控项`}
                    </button>
                  </div>
                )}
              </div>

              {/* 已添加的监控项列表 */}
              <div>
                <h4 className="text-md font-medium text-foreground mb-4">已添加的监控项</h4>
                
                {allMonitors.length === 0 ? (
                  <p className="text-foreground/60">还没有添加任何监控项</p>
                ) : (
                  <div className="h-48 overflow-y-auto space-y-3">
                    {allMonitors.map((spm, index) => (
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
                          type="button"
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
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-primary/20">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-primary/20 rounded-lg text-foreground hover:bg-primary/10 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '保存中...' : (statusPage ? '更新状态页' : '创建状态页')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 