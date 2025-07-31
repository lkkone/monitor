import { NextRequest, NextResponse } from 'next/server';
import { monitorOperations } from '@/lib/db';
import { validateAuth } from '@/lib/auth-helpers';

// PUT /api/monitors/reorder - 更新监控项排序
export async function PUT(request: NextRequest) {
  try {
    // 验证用户是否已登录
    const authError = await validateAuth();
    if (authError) return authError;
    
    const data = await request.json();
    const { updates } = data;
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: '排序数据格式错误' },
        { status: 400 }
      );
    }
    
    // 验证每个更新项
    for (const update of updates) {
      if (!update.id || typeof update.displayOrder !== 'number') {
        return NextResponse.json(
          { error: '排序数据格式错误' },
          { status: 400 }
        );
      }
    }
    
    // 批量更新排序
    await monitorOperations.updateMonitorsOrder(updates);
    
    return NextResponse.json({
      message: '排序更新成功',
      updates
    });
  } catch (error) {
    console.error('更新监控项排序失败:', error);
    return NextResponse.json(
      { error: '更新监控项排序失败，请稍后重试' },
      { status: 500 }
    );
  }
} 