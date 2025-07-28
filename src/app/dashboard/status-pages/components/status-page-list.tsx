"use client";

interface StatusPage {
  id: string;
  name: string;
  slug: string;
  title: string;
  isPublic: boolean;
  createdAt: string;
  monitors: Array<{
    monitor: {
      id: string;
      name: string;
    };
  }>;
}

interface StatusPageListProps {
  statusPages: StatusPage[];
  onEdit: (statusPage: StatusPage) => void;
  onDelete: (id: string) => void;
}

export function StatusPageList({ statusPages, onEdit, onDelete }: StatusPageListProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusPageUrl = (slug: string) => {
    return `${window.location.origin}/status/${slug}`;
  };

  if (statusPages.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-foreground/40 text-6xl mb-4">
          <i className="fas fa-chart-line"></i>
        </div>
        <h3 className="text-xl font-medium text-foreground mb-2">还没有状态页</h3>
        <p className="text-foreground/60">创建您的第一个状态页来展示监控状态</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {statusPages.map((statusPage) => (
        <div
          key={statusPage.id}
          className="dark:bg-dark-card bg-light-card rounded-lg border border-primary/10 hover:border-primary/20 transition-all p-6"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {statusPage.name}
              </h3>
              <p className="text-sm text-foreground/60">{statusPage.title}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onEdit(statusPage)}
                className="text-primary hover:text-primary/80 transition-colors"
                title="编辑"
              >
                <i className="fas fa-edit"></i>
              </button>
              <button
                onClick={() => onDelete(statusPage.id)}
                className="text-error hover:text-error/80 transition-colors"
                title="删除"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground/60">URL标识符:</span>
              <code className="bg-foreground/5 px-2 py-1 rounded text-xs">
                {statusPage.slug}
              </code>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground/60">监控项数量:</span>
              <span className="font-medium">{statusPage.monitors.length}个</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground/60">访问权限:</span>
              <span className={`px-2 py-1 rounded-full text-xs ${
                statusPage.isPublic 
                  ? 'bg-success/20 text-success' 
                  : 'bg-warning/20 text-warning'
              }`}>
                {statusPage.isPublic ? '公开' : '私有'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground/60">创建时间:</span>
              <span className="text-foreground/80">{formatDate(statusPage.createdAt)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <a
              href={getStatusPageUrl(statusPage.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-primary hover:bg-primary/90 text-white text-center py-2 rounded-lg transition-colors text-sm"
            >
              <i className="fas fa-external-link-alt mr-2"></i>
              查看状态页
            </a>
            
            <button
              onClick={() => navigator.clipboard.writeText(getStatusPageUrl(statusPage.slug))}
              className="block w-full bg-foreground/5 hover:bg-foreground/10 text-foreground/80 hover:text-foreground transition-colors py-2 rounded-lg text-sm"
            >
              <i className="fas fa-copy mr-2"></i>
              复制链接
            </button>
          </div>
        </div>
      ))}
    </div>
  );
} 