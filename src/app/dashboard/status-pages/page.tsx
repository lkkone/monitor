"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { StatusPageList } from "./components/status-page-list";
import { StatusPageForm } from "./components/status-page-form";

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

export default function StatusPagesPage() {
  const [statusPages, setStatusPages] = useState<StatusPage[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingStatusPage, setEditingStatusPage] = useState<StatusPage | null>(null);

  // 获取状态页列表
  const fetchStatusPages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/status-pages');
      if (response.ok) {
        const data = await response.json();
        setStatusPages(data);
      }
    } catch (error) {
      console.error('获取状态页列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusPages();
  }, []);

  const handleCreateSuccess = () => {
    setIsFormOpen(false);
    setEditingStatusPage(null);
    fetchStatusPages();
  };

  const handleEdit = (statusPage: StatusPage) => {
    setEditingStatusPage(statusPage);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个状态页吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/status-pages/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchStatusPages();
      } else {
        const error = await response.json();
        alert(`删除失败: ${error.error}`);
      }
    } catch (error) {
      console.error('删除状态页失败:', error);
      alert('删除状态页失败');
    }
  };



  return (
    <div className="flex min-h-screen bg-gradient-to-br from-light-bg to-light-bg/95 dark:from-dark-bg dark:to-dark-bg/95">
      <div className="flex-1">
        <Header />
        <main className="px-6 pt-24 pb-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center space-x-4">
                <a
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors border border-primary/20"
                >
                  <i className="fas fa-arrow-left mr-2"></i>
                  返回监控面板
                </a>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">状态页管理</h1>
                  <p className="text-foreground/60 mt-2">管理您的公开状态页面</p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(true)}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors"
              >
                <i className="fas fa-plus mr-2"></i>
                创建状态页
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-primary">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  加载中...
                </div>
              </div>
            ) : (
              <StatusPageList
                statusPages={statusPages}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </div>
        </main>
      </div>

      {isFormOpen && (
        <StatusPageForm
          statusPage={editingStatusPage}
          onClose={() => {
            setIsFormOpen(false);
            setEditingStatusPage(null);
          }}
          onSuccess={handleCreateSuccess}
        />
      )}


    </div>
  );
} 