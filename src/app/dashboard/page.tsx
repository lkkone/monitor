"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MonitorForm } from "./monitors/monitor-form";
import { MonitorDetail } from "./monitors/monitor-detail";
import { Header } from "@/components/header";

// 监控状态类型
type MonitorItemStatus = "正常" | "故障" | "维护" | "未知" | "暂停";

// 监控项接口类型
interface MonitorItemData {
  id: string;
  name: string;
  type: string;
  active: boolean;
  lastStatus?: number;
  lastCheckAt?: string;
  config?: Record<string, unknown>;
  displayOrder?: number;
  group?: {
    id: string;
    name: string;
    description?: string;
    color?: string;
  } | null;
}

// 监控项状态映射
const statusMapping = (status?: number, active = true): MonitorItemStatus => {
  if (!active) return "暂停";
  
  switch(status) {
    case 1: return "正常";
    case 0: return "故障";
    case 2: return "维护";
    default: return "未知";
  }
};

// 仪表盘状态数据
const statusData = {
  normal: 0,
  error: 0,
  maintenance: 0,
  unknown: 0,
  paused: 0
};

// 侧边栏组件
function Sidebar({ setSelectedMonitor, activeMonitorId }: { setSelectedMonitor: (id: string | null) => void, activeMonitorId: string | null }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isMonitorFormOpen, setIsMonitorFormOpen] = useState(false);
  const [activeItems, setActiveItems] = useState<string[]>([]);
  const [monitors, setMonitors] = useState<MonitorItemData[]>([]);
  const [loading, setLoading] = useState(true);

  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // 添加滚动容器的引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 获取所有监控项
  useEffect(() => {
    const fetchMonitors = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/monitors');
        if (response.ok) {
          const data = await response.json();
          setMonitors(data);
          
          // 如果有活动的监控项ID，选中它
          if (activeMonitorId) {
            setActiveItems([activeMonitorId]);
          }
        }
      } catch (error) {
        console.error("获取监控项失败", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMonitors();
  }, [activeMonitorId]);

  // 滚动到当前选中的监控项
  useEffect(() => {
    // 确保数据加载完成且有选中的监控项
    if (!loading && activeMonitorId && monitors.length > 0) {
      // 延迟执行，确保DOM完全渲染
      const timer = setTimeout(() => {
        const selectedButton = document.querySelector(`[data-monitor-id="${activeMonitorId}"]`) as HTMLElement;
        if (selectedButton) {
          // 使用 scrollIntoView 方法滚动到选中项
          selectedButton.scrollIntoView({
            behavior: 'smooth',
            block: 'center', // 将元素滚动到可视区域的中央
            inline: 'nearest'
          });
        }
      }, 300); // 延迟确保DOM完全渲染
      
      return () => clearTimeout(timer);
    }
  }, [loading, activeMonitorId, monitors]);
  
  // 检查是否有任何监控项属于分组
  const hasGroups = monitors.some(item => item.group);
  
  // 如果有分组，按分组组织；否则平铺展示
  let displayData: Array<{ id: string; name: string; color: string; monitors: MonitorItemData[] }> = [];
  
  if (hasGroups) {
    // 按分组组织监控项
    const groupedMonitors = monitors.reduce((groups, item) => {
      const groupId = item.group?.id || 'ungrouped';
      const groupName = item.group?.name || '未分组';
      const groupColor = item.group?.color || '#6366F1';
      
      if (!groups[groupId]) {
        groups[groupId] = {
          id: groupId,
          name: groupName,
          color: groupColor,
          monitors: []
        };
      }
      
      groups[groupId].monitors.push(item);
      return groups;
    }, {} as Record<string, { id: string; name: string; color: string; monitors: MonitorItemData[] }>);

    // 过滤分组和监控项
    const filteredGroups = Object.values(groupedMonitors).map(group => {
      const filteredMonitors = group.monitors.filter(item => {
        // 名称匹配
        if (item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return true;
        }
        
        // 分组名称匹配
        if (item.group && item.group.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return true;
        }
        
        // 尝试匹配配置中的URL、hostname或IP地址
        if (item.config) {
          const config = item.config as Record<string, unknown>;
          
          // 匹配URL
          if (config.url && String(config.url).toLowerCase().includes(searchQuery.toLowerCase())) {
            return true;
          }
          
          // 匹配hostname
          if (config.hostname && String(config.hostname).toLowerCase().includes(searchQuery.toLowerCase())) {
            return true;
          }
          
          // 匹配IP:端口组合
          if (config.hostname && config.port && 
              `${String(config.hostname)}:${String(config.port)}`.toLowerCase().includes(searchQuery.toLowerCase())) {
            return true;
          }
        }
        
        return false;
      });
      
      return {
        ...group,
        monitors: filteredMonitors
      };
    }).filter(group => group.monitors.length > 0);

    // 按分组显示顺序排序
    displayData = filteredGroups.sort((a, b) => {
      // 未分组始终排在最后
      if (a.id === 'ungrouped') return 1;
      if (b.id === 'ungrouped') return -1;
      return 0;
    });
  } else {
    // 没有分组时，平铺展示所有监控项
    const filteredMonitors = monitors.filter(item => {
      // 名称匹配
      if (item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return true;
      }
      
      // 尝试匹配配置中的URL、hostname或IP地址
      if (item.config) {
        const config = item.config as Record<string, unknown>;
        
        // 匹配URL
        if (config.url && String(config.url).toLowerCase().includes(searchQuery.toLowerCase())) {
          return true;
        }
        
        // 匹配hostname
        if (config.hostname && String(config.hostname).toLowerCase().includes(searchQuery.toLowerCase())) {
          return true;
        }
        
        // 匹配IP:端口组合
        if (config.hostname && config.port && 
            `${String(config.hostname)}:${String(config.port)}`.toLowerCase().includes(searchQuery.toLowerCase())) {
          return true;
        }
      }
      
      return false;
    });
    
    // 创建一个虚拟的"平铺"分组
    displayData = [{
      id: 'flat',
      name: '',
      color: '#6366F1',
      monitors: filteredMonitors
    }];
  }

  const getIconForType = (type: string) => {
    switch(type) {
      case "http":
      case "website":
        return "fas fa-globe";
      case "api":
      case "keyword":
        return "fas fa-code";
      case "database":
      case "mysql":
      case "postgres":
      case "sqlserver":
      case "redis":
        return "fas fa-database";
      case "port":
        return "fas fa-plug";
      case "push":
        return "fas fa-bell";
      default:
        return "fas fa-cube";
    }
  };

  const handleMonitorClick = (id: string) => {
    if (activeItems.includes(id)) {
      // 已选中的项再次点击时取消选中
      setActiveItems(activeItems.filter(item => item !== id));
      setSelectedMonitor(null);
      // 更新URL，移除id参数
      router.push('/dashboard');
    } else {
      // 选中新项时，清除其他选中项
      setActiveItems([id]);
      setSelectedMonitor(id);
      // 更新URL，添加id参数
      router.push(`/dashboard?id=${id}`);
    }
  };

  // 开始拖拽
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragStartIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 拖拽经过
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  // 拖拽结束
  const handleDragEnd = async () => {
    if (dragStartIndex === null || dragOverIndex === null) {
      setDragStartIndex(null);
      setDragOverIndex(null);
      return;
    }

    // 由于现在有分组结构，拖拽逻辑需要重新设计
    // 暂时禁用跨分组的拖拽，只允许在分组内重新排序
    const startGroupIndex = Math.floor(dragStartIndex / 1000);
    const endGroupIndex = Math.floor(dragOverIndex / 1000);
    
    if (startGroupIndex === endGroupIndex && dragStartIndex !== dragOverIndex) {
      // 在同一分组内拖拽
             const group = displayData[startGroupIndex];
      const newMonitors = [...group.monitors];
      const startItemIndex = dragStartIndex % 1000;
      const endItemIndex = dragOverIndex % 1000;
      
      const [movedItem] = newMonitors.splice(startItemIndex, 1);
      newMonitors.splice(endItemIndex, 0, movedItem);
      
      // 更新排序值
      const updates = newMonitors.map((monitor, index) => ({
        id: monitor.id,
        displayOrder: index
      }));

      // 发送到服务器
      updateMonitorOrder(updates);
      
      // 重新获取数据以更新UI
      const fetchResponse = await fetch('/api/monitors');
      if (fetchResponse.ok) {
        const data = await fetchResponse.json();
        setMonitors(data);
      }
    }

    setDragStartIndex(null);
    setDragOverIndex(null);
  };

  // 更新监控项排序
  const updateMonitorOrder = async (updates: Array<{ id: string; displayOrder: number }>) => {
    try {
      const response = await fetch('/api/monitors/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        console.error('更新排序失败');
        // 重新获取数据
        const fetchResponse = await fetch('/api/monitors');
        if (fetchResponse.ok) {
          const data = await fetchResponse.json();
          setMonitors(data);
        }
      }
    } catch (error) {
      console.error('更新排序失败:', error);
      // 重新获取数据
      const fetchResponse = await fetch('/api/monitors');
      if (fetchResponse.ok) {
        const data = await fetchResponse.json();
        setMonitors(data);
      }
    }
  };

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-80 dark:bg-dark-card bg-light-card border-r border-primary/10">
      <div className="p-5">
        <div 
          className="text-xl font-bold text-primary mb-8 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            router.push('/dashboard');
            setSelectedMonitor(null);
            setActiveItems([]);
          }}
        >Monitor</div>
        <button 
          className="bg-gradient-to-r from-primary to-secondary text-white px-6 py-2.5 rounded-button hover:opacity-90 transition-opacity flex items-center space-x-2 w-full mb-5 justify-center"
          onClick={() => setIsMonitorFormOpen(true)}
        >
          <i className="fas fa-plus"></i>
          <span>添加监控项</span>
        </button>
        <div className="relative mb-5">
          <input 
            type="text" 
            placeholder="搜索监控项..." 
            className="search-input dark:bg-dark-card bg-light-card border border-primary/20 rounded-button px-4 py-2.5 w-full focus:outline-none text-foreground"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <i className="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-foreground/50"></i>
        </div>
        <div className="px-4 mb-3">
          <span className="text-sm text-foreground/50">监控列表</span>
        </div>
        <div 
          ref={scrollContainerRef}
          className="space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] pr-1"
        >
          {loading ? (
            <div className="text-center py-4 text-foreground/60">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              加载中...
            </div>
          ) : displayData.length === 0 ? (
            <div className="text-center py-4 text-foreground/60">
              未找到监控项
            </div>
          ) : (
                                      displayData.map((group, groupIndex) => (
               <div key={group.id} className="space-y-2">
                 {/* 分组标题 - 只在有分组时显示 */}
                 {hasGroups && (
                   <div className="flex items-center px-2 py-1">
                     <div 
                       className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                       style={{ backgroundColor: group.color }}
                     ></div>
                     <span className="text-sm font-medium text-foreground/70 truncate">
                       {group.name}
                     </span>
                     <span className="ml-auto text-xs text-foreground/50">
                       {group.monitors.length}
                     </span>
                   </div>
                 )}
                 
                 {/* 分组下的监控项 */}
                 <div className={`space-y-1 ${hasGroups ? 'ml-4' : ''}`}>
                  {group.monitors.map((item, itemIndex) => {
                    const status = statusMapping(item.lastStatus, item.active);
                    const globalIndex = groupIndex * 1000 + itemIndex; // 用于拖拽的全局索引
                    const isDragging = dragStartIndex === globalIndex;
                    const isDragOver = dragOverIndex === globalIndex;
                    
                    return (
                      <div
                        key={item.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, globalIndex)}
                        onDragOver={(e) => handleDragOver(e, globalIndex)}
                        onDragEnd={handleDragEnd}
                        className={`${
                          isDragging ? 'opacity-50' : ''
                        } ${
                          isDragOver ? 'border-t-2 border-primary' : ''
                        }`}
                      >
                                                 <button 
                           data-monitor-id={item.id}
                           onClick={() => handleMonitorClick(item.id)}
                           className={`flex items-center ${hasGroups ? 'px-3 py-2.5' : 'px-4 py-3'} rounded-lg w-full text-left ${
                             activeItems.includes(item.id) ? "bg-primary/10 text-primary" : "hover:bg-primary/5 text-foreground/90"
                           } cursor-grab active:cursor-grabbing`}
                         >
                           <i className={`${getIconForType(item.type)} ${hasGroups ? 'w-5 h-5 mr-3' : 'w-6 h-6 mr-3.5'} flex items-center justify-center flex-shrink-0`}></i>
                           <div className="flex-grow min-w-0">
                             <span className={`block truncate ${hasGroups ? 'text-sm' : ''} font-medium`}>{item.name}</span>
                           </div>
                           <div className={`${hasGroups ? 'w-2.5 h-2.5' : 'w-3 h-3'} rounded-full ${getStatusDotClass(status)} flex-shrink-0`}></div>
                         </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* 监控项表单 */}
      <MonitorForm 
        isOpen={isMonitorFormOpen} 
        onClose={() => {
          setIsMonitorFormOpen(false);
          // 表单关闭后刷新监控项列表
          fetch('/api/monitors')
            .then(res => res.json())
            .then(data => setMonitors(data))
            .catch(err => console.error("刷新监控项失败", err));
        }} 
      />
    </nav>
  );
}

// 状态卡片组件
type StatusData = {
  normal: number;
  error: number;
  maintenance: number;
  unknown: number;
  paused: number;
};

function StatusCards({ data }: { data: StatusData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 lg:gap-6 mb-8">
      <div className="dark:bg-dark-card bg-light-card p-6 rounded-lg hover-card border border-primary/10">
        <div className="flex justify-between items-center mb-4">
          <span className="text-success font-medium">正常</span>
          <i className="fas fa-check-circle text-success text-xl"></i>
        </div>
        <div className="text-3xl font-bold">{data.normal}</div>
      </div>
      <div className="dark:bg-dark-card bg-light-card p-6 rounded-lg hover-card border border-primary/10">
        <div className="flex justify-between items-center mb-4">
          <span className="text-error font-medium">故障</span>
          <i className="fas fa-exclamation-circle text-error text-xl"></i>
        </div>
        <div className="text-3xl font-bold">{data.error}</div>
      </div>
      <div className="dark:bg-dark-card bg-light-card p-6 rounded-lg hover-card border border-primary/10">
        <div className="flex justify-between items-center mb-4">
          <span className="text-primary font-medium">维护</span>
          <i className="fas fa-wrench text-primary text-xl"></i>
        </div>
        <div className="text-3xl font-bold">{data.maintenance}</div>
      </div>
      <div className="dark:bg-dark-card bg-light-card p-6 rounded-lg hover-card border border-primary/10">
        <div className="flex justify-between items-center mb-4">
          <span className="text-warning font-medium">未知</span>
          <i className="fas fa-question-circle text-warning text-xl"></i>
        </div>
        <div className="text-3xl font-bold">{data.unknown}</div>
      </div>
      <div className="dark:bg-dark-card bg-light-card p-6 rounded-lg hover-card border border-primary/10">
        <div className="flex justify-between items-center mb-4">
          <span className="text-foreground/50 font-medium">暂停</span>
          <i className="fas fa-pause-circle text-foreground/50 text-xl"></i>
        </div>
        <div className="text-3xl font-bold">{data.paused}</div>
      </div>
    </div>
  );
}

// 监控表格组件
type MonitorItem = {
  id: string;
  name: string;
  status: MonitorItemStatus;
  lastCheck: string;
  message: string;
};

// 获取监控项状态点样式 (全局函数，避免重复)
const getStatusDotClass = (status: MonitorItemStatus) => {
  switch (status) {
    case "正常":
      return "bg-success";
    case "故障":
      return "bg-error";
    case "维护":
      return "bg-primary";
    case "未知":
      return "bg-warning";
    case "暂停":
      return "bg-foreground/50";
    default:
      return "bg-foreground/50";
  }
};

function MonitorTable({ items, setSelectedMonitor }: { items: MonitorItem[], setSelectedMonitor: (id: string | null) => void }) {
  const router = useRouter();
  
  const getStatusClass = (status: MonitorItemStatus) => {
    switch (status) {
      case "正常":
        return "bg-success/20 text-success";
      case "故障":
        return "bg-error/20 text-error";
      case "维护":
        return "bg-primary/20 text-primary";
      case "未知":
        return "bg-warning/20 text-warning";
      case "暂停":
        return "bg-foreground/20 text-foreground/50";
      default:
        return "bg-foreground/20 text-foreground/50";
    }
  };

  const handleLinkClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    // 更新URL和状态
    router.push(`/dashboard?id=${id}`);
    // 设置选中的监控项
    setSelectedMonitor(id);
  };

  return (
    <div className="dark:bg-dark-card bg-light-card rounded-lg shadow-sm overflow-hidden border border-primary/10">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="dark:bg-dark-nav bg-light-nav">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-medium text-foreground/80">名称</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-foreground/80">状态</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-foreground/80">日期时间</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-foreground/80">消息</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr 
                key={item.id} 
                className={`hover:bg-primary/5 ${index !== items.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusDotClass(item.status)} mr-2 flex-shrink-0`}></div>
                    <Link 
                      href={`/dashboard?id=${item.id}`} 
                      className="text-primary hover:underline truncate max-w-xs"
                      onClick={(e) => handleLinkClick(item.id, e)}
                    >
                      {item.name}
                    </Link>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(item.status)}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-foreground/70">{item.lastCheck}</td>
                <td className="px-6 py-4 text-sm text-foreground/70">{item.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 仪表盘概览组件
function Dashboard({ setSelectedMonitor }: { setSelectedMonitor: (id: string | null) => void }) {
  const [monitorItems, setMonitorItems] = useState<MonitorItem[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusData>(statusData);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchMonitors = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/monitors');
        if (response.ok) {
          const data = await response.json();
          
          // 将后端数据转换为前端需要的格式
          const formattedItems = data.map((item: MonitorItemData) => ({
            id: item.id,
            name: item.name,
            status: statusMapping(item.lastStatus, item.active),
            lastCheck: item.lastCheckAt ? new Date(item.lastCheckAt).toLocaleString() : '暂无检查',
            message: item.lastStatus === 1 ? "200 - OK" : (item.lastStatus === 0 ? "连接失败" : "未知状态")
          }));
          
          setMonitorItems(formattedItems);
          
          // 统计各种状态的数量
          const counts = {
            normal: 0,
            error: 0,
            maintenance: 0,
            unknown: 0,
            paused: 0
          };
          
          formattedItems.forEach((item: MonitorItem) => {
            switch(item.status) {
              case "正常": counts.normal++; break;
              case "故障": counts.error++; break;
              case "维护": counts.maintenance++; break;
              case "未知": counts.unknown++; break;
              case "暂停": counts.paused++; break;
            }
          });
          
          setStatusCounts(counts);
        }
      } catch (error) {
        console.error("获取监控数据失败", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMonitors();
  }, []);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-primary">
          <i className="fas fa-spinner fa-spin mr-2"></i>
          加载监控数据中...
        </div>
      </div>
    );
  }
  
  return (
    <>
      <StatusCards data={statusCounts} />
      <MonitorTable items={monitorItems} setSelectedMonitor={setSelectedMonitor} />
    </>
  );
}

// 定义历史记录类型
interface HistoryRecord {
  id: string;
  status: number;
  message?: string;
  ping?: number;
  timestamp: string;
}

// 添加计算在线时间的函数
const calculateUptime = (statusHistory: HistoryRecord[] | undefined) => {
  if (!statusHistory || statusHistory.length === 0) {
    return "100%";
  }
  
  // 统计成功的检查次数
  const totalChecks = statusHistory.length;
  const successChecks = statusHistory.filter(record => record.status === 1).length;
  
  // 计算在线率，如果有监控记录但没有失败记录，则返回100%
  if (successChecks === totalChecks) {
    return "100%";
  }
  
  // 计算在线率百分比
  const uptimePercentage = (successChecks / totalChecks) * 100;
  return uptimePercentage.toFixed(1) + "%";
};

// 添加计算可用性的函数
const calculateAvailability = (statusHistory: HistoryRecord[] | undefined) => {
  if (!statusHistory || statusHistory.length === 0) {
    return "100%";
  }
  
  // 获取最近24小时的历史记录
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const recentHistory = statusHistory.filter(item => 
    new Date(item.timestamp) >= oneDayAgo
  );
  
  if (recentHistory.length === 0) {
    return "100%";
  }
  
  // 统计成功的检查次数
  const totalChecks = recentHistory.length;
  const successChecks = recentHistory.filter(record => record.status === 1).length;
  
  // 计算可用性百分比
  if (successChecks === totalChecks) {
    return "100%";
  }
  
  const availabilityPercentage = (successChecks / totalChecks) * 100;
  return availabilityPercentage.toFixed(1) + "%";
};

// 定义详细监控数据的接口类型
interface MonitorDetailData {
  id: string;
  name: string;
  type: string;
  status: MonitorItemStatus;
  message: string;
  responseTime: string;
  uptime: string;
  availability: string;
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const monitorId = searchParams ? searchParams.get('id') : null;
  
  const [selectedMonitor, setSelectedMonitor] = useState<string | null>(monitorId);
  const [monitorData, setMonitorData] = useState<MonitorDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  

  
  // 监听 URL 参数变化
  useEffect(() => {
    setSelectedMonitor(monitorId);
  }, [monitorId]);
  
  // 根据选中的监控项ID查找对应的监控项
  useEffect(() => {
    if (!selectedMonitor) {
      setMonitorData(null);
      return;
    }
    
    const fetchMonitorDetails = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/monitors/${selectedMonitor}`);
        if (response.ok) {
          const data = await response.json();
          // 计算在线时间
          const uptime = calculateUptime(data.statusHistory);
          // 计算可用性
          const availability = calculateAvailability(data.statusHistory);
          
          // 准备展示数据
          setMonitorData({
            id: data.id,
            name: data.name,
            type: data.type,
            status: statusMapping(data.lastStatus, data.active),
            message: data.lastStatus === 1 ? "200 - OK" : (data.lastStatus === 0 ? "连接失败" : "未知状态"),
            responseTime: data.statusHistory && data.statusHistory[0]?.ping ? `${data.statusHistory[0].ping}ms` : "N/A",
            uptime: uptime, // 使用计算的在线时间
            availability: availability // 使用计算的可用性
          });
        }
      } catch (error) {
        console.error("获取监控详情失败", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMonitorDetails();
  }, [selectedMonitor]);
  
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-light-bg to-light-bg/95 dark:from-dark-bg dark:to-dark-bg/95">
      <Sidebar setSelectedMonitor={setSelectedMonitor} activeMonitorId={monitorId} />
      <div className="flex-1">
        <Header />
        <main className="ml-80 px-6 pt-24 pb-8">
          {selectedMonitor === null ? (
            <Dashboard setSelectedMonitor={setSelectedMonitor} />
          ) : isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-primary">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                加载监控详情中...
              </div>
            </div>
          ) : monitorData && (
            <MonitorDetail 
              id={monitorData.id}
              name={monitorData.name}
              type={monitorData.type}
              status={monitorData.status}
              uptime={monitorData.uptime}
              availability={monitorData.availability}
              responseTime={monitorData.responseTime}
              message={monitorData.message}
            />
          )}
        </main>
      </div>
    </div>
  );
} 