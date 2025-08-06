"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface MonitorGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  displayOrder?: number;
  monitors: Array<{
    id: string;
    name: string;
    lastStatus?: number;
    active: boolean;
  }>;
}

export function MonitorGroupSettings() {
  const [groups, setGroups] = useState<MonitorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MonitorGroup | null>(null);

  // 获取分组列表
  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/monitor-groups');
      if (response.ok) {
        const data = await response.json();
        setGroups(data);
      }
    } catch (error) {
      console.error('获取分组失败:', error);
      toast.error('获取分组失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // 删除分组
  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('确定要删除这个分组吗？删除后，该分组下的监控项将变为未分组状态。')) {
      return;
    }

    try {
      const response = await fetch(`/api/monitor-groups/${groupId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('分组删除成功');
        fetchGroups();
      } else {
        const error = await response.json();
        toast.error(error.message || '删除分组失败');
      }
    } catch (error) {
      console.error('删除分组失败:', error);
      toast.error('删除分组失败');
    }
  };

  // 创建分组对话框
  const CreateGroupDialog = ({ 
    isOpen, 
    onClose, 
    onSuccess,
    editingGroup = null
  }: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSuccess: () => void;
    editingGroup?: MonitorGroup | null;
  }) => {
    const [groupName, setGroupName] = useState(editingGroup?.name || '');
    const [description, setDescription] = useState(editingGroup?.description || '');
    const [color, setColor] = useState(editingGroup?.color || '#6366F1');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
      if (editingGroup) {
        setGroupName(editingGroup.name);
        setDescription(editingGroup.description || '');
        setColor(editingGroup.color);
      } else {
        setGroupName('');
        setDescription('');
        setColor('#6366F1');
      }
    }, [editingGroup]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!groupName.trim()) {
        toast.error('请输入分组名称');
        return;
      }

      try {
        setIsSubmitting(true);
        const url = editingGroup ? `/api/monitor-groups/${editingGroup.id}` : '/api/monitor-groups';
        const method = editingGroup ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: groupName.trim(),
            description: description.trim() || null,
            color: color,
          }),
        });

        if (response.ok) {
          toast.success(editingGroup ? '分组更新成功' : '分组创建成功');
          onSuccess();
          onClose();
        } else {
          const error = await response.json();
          toast.error(error.message || (editingGroup ? '更新分组失败' : '创建分组失败'));
        }
      } catch (error) {
        console.error(editingGroup ? '更新分组失败:' : '创建分组失败:', error);
        toast.error(editingGroup ? '更新分组失败' : '创建分组失败');
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card border border-primary/20 rounded-lg p-6 w-full max-w-md mx-4">
          <h3 className="text-lg font-medium mb-4 text-primary">
            {editingGroup ? '编辑分组' : '新建分组'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-foreground/80 font-medium mb-2">分组名称 *</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="请输入分组名称"
                className="w-full px-4 py-2 rounded-lg dark:bg-dark-input bg-light-input border border-primary/20 focus:border-primary focus:outline-none"
                required
              />
            </div>
            
            <div>
              <label className="block text-foreground/80 font-medium mb-2">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选的分组描述"
                rows={3}
                className="w-full px-4 py-2 rounded-lg dark:bg-dark-input bg-light-input border border-primary/20 focus:border-primary focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-foreground/80 font-medium mb-2">颜色</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-10 rounded border border-primary/20"
                />
                <span className="text-sm text-foreground/60">选择分组显示颜色</span>
              </div>
            </div>
            
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-primary/30 text-primary rounded-lg hover:bg-primary/5 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !groupName.trim()}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '保存中...' : (editingGroup ? '更新分组' : '创建分组')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-primary">
          <i className="fas fa-spinner fa-spin mr-2"></i>
          加载分组数据中...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-foreground">监控分组管理</h3>
          <p className="text-sm text-foreground/60 mt-1">
            管理监控项的分组，便于组织和分类监控项
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center space-x-2"
        >
          <i className="fas fa-plus"></i>
          <span>新建分组</span>
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            <i className="fas fa-folder text-2xl text-primary"></i>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">暂无分组</h3>
          <p className="text-foreground/60 mb-4">创建分组来更好地组织您的监控项</p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            创建第一个分组
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="dark:bg-dark-card bg-light-card border border-primary/10 rounded-lg p-4 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  ></div>
                  <div>
                    <h4 className="font-medium text-foreground">{group.name}</h4>
                    {group.description && (
                      <p className="text-sm text-foreground/60">{group.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-foreground/50 bg-primary/10 px-2 py-1 rounded">
                    {group.monitors.length} 个监控项
                  </span>
                  <button
                    onClick={() => setEditingGroup(group)}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="编辑分组"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="删除分组"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              
              {group.monitors.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-foreground/70">包含的监控项：</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.monitors.map((monitor) => (
                      <div
                        key={monitor.id}
                        className="flex items-center space-x-2 p-2 bg-primary/5 rounded text-sm"
                      >
                        <div className={`w-2 h-2 rounded-full ${
                          monitor.lastStatus === 1 ? 'bg-success' :
                          monitor.lastStatus === 0 ? 'bg-error' :
                          monitor.lastStatus === 2 ? 'bg-primary' :
                          'bg-foreground/50'
                        }`}></div>
                        <span className={`${!monitor.active ? 'opacity-50' : ''}`}>
                          {monitor.name}
                        </span>
                        {!monitor.active && (
                          <span className="text-xs text-foreground/50">(暂停)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateGroupDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={fetchGroups}
        editingGroup={null}
      />

      <CreateGroupDialog
        isOpen={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        onSuccess={() => {
          fetchGroups();
          setEditingGroup(null);
        }}
        editingGroup={editingGroup}
      />
    </div>
  );
} 