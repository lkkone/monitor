import axios from 'axios';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { formatDateTime } from './utils';

// 状态中文描述
const STATUS_TEXT_CN: Record<number, string> = {
  0: '异常',
  1: '正常',
  2: '等待'
};

// 通知数据接口
interface NotificationData {
  monitorName: string;
  monitorType: string;
  status: string; // 状态描述
  statusText: string; // 状态中文描述
  statusCode: number; // 状态码: 1=正常, 0=异常, 2=等待
  time: string;
  message: string;
  failureCount?: number;
  firstFailureTime?: string;
  lastFailureTime?: string;
  failureDuration?: number;
}

// 邮件配置接口
interface EmailConfig {
  email: string;
  smtpServer: string;
  smtpPort: string | number;
  username?: string;
  password?: string;
}

// Webhook配置接口
interface WebhookConfig {
  url: string;
  method?: string; // HTTP方法，默认POST
  headers?: Record<string, string>; // 自定义请求头
  bodyTemplate?: string; // 请求体模板，支持变量占位符
  contentType?: string; // Content-Type，默认application/json
}

// 微信推送配置接口
interface WechatConfig {
  pushUrl: string;
  titleTemplate?: string;
  contentTemplate?: string;
}

// 钉钉推送配置接口
interface DingTalkConfig {
  webhookUrl: string;
  secret?: string;
}

// 企业微信推送配置接口
interface WorkWechatConfig {
  webhookUrl: string;
}

// 内存缓存，记录每个监控项的最后通知时间和状态
const notificationCache = new Map<string, { time: number; status: number }>();

/**
 * 处理监控状态变更通知
 * @param monitorId 监控项ID
 * @param status 监控状态 (0-异常, 1-正常, 2-等待)
 * @param message 状态消息
 * @param prevStatus 先前状态 (可能为空，表示第一次检查)
 */
export async function sendStatusChangeNotifications(
  monitorId: string,
  status: number,
  message: string,
  prevStatus: number | null
) {
  try {
    // 获取监控项详情
    const monitor = await prisma.monitor.findUnique({
      where: { id: monitorId },
      include: {
        notificationBindings: {
          where: { enabled: true },
          include: {
            notificationChannel: true
          }
        },
        statusHistory: {
          orderBy: { timestamp: 'desc' },
          take: 2 // 只获取最近2条记录，用于判断状态变化
        }
      }
    });

    if (!monitor) {
      console.error(`找不到监控项: ${monitorId}`);
      return;
    }

    // 如果没有启用的通知配置，则不发送
    if (!monitor.notificationBindings || monitor.notificationBindings.length === 0) {
      return;
    }

    // 检查是否为新添加的监控项（状态历史记录数量小于等于1）
    const isNewMonitor = !monitor.statusHistory || monitor.statusHistory.length <= 1;

    // 使用调度器传入的prevStatus，这是最准确的状态变化信息
    let realPrevStatus = prevStatus;
    
    // 只有当prevStatus为null且有历史记录时，才从历史记录中获取上一个状态
    // 这种情况通常发生在系统重启后第一次检查
    if (prevStatus === null && !isNewMonitor && monitor.statusHistory && monitor.statusHistory.length > 1) {
      const prevStatusFromHistory = monitor.statusHistory[1]?.status;
      if (prevStatusFromHistory !== undefined && prevStatusFromHistory !== null) {
        realPrevStatus = prevStatusFromHistory;
      }
    }

    // 如果状态没有变化，则不发送通知
    // 注意：当prevStatus为null时，表示这是一个状态变化（从未知状态到当前状态），应该发送通知
    if (prevStatus !== null && realPrevStatus === status) {
      return;
    }

    // 如果是新监控项，且状态为正常，则不发送通知
    if (isNewMonitor && status === 1) {
      return;
    }

    // 准备基础通知数据
    const notificationData: NotificationData = {
      monitorName: monitor.name,
      monitorType: monitor.type,
      status: STATUS_TEXT_CN[status] || '未知', // 使用中文状态描述
      statusText: STATUS_TEXT_CN[status] || '未知',
      statusCode: status, // 保存原始状态码
      time: formatDateTime(),
      message: message || '无详细信息'
    };

    // 添加监控地址信息
    if (monitor.config) {
      try {
        const monitorConfig = monitor.config as Record<string, unknown>;
        // 添加URL（针对http、https-cert、keyword类型）
        if (monitorConfig.url) {
          notificationData.message = `监控地址: ${String(monitorConfig.url)}\n${notificationData.message}`;
        }
        // 添加主机和端口信息（针对port、mysql、redis等类型）
        else if (monitorConfig.hostname) {
          const address = monitorConfig.port
            ? `${String(monitorConfig.hostname)}:${String(monitorConfig.port)}`
            : String(monitorConfig.hostname);
          notificationData.message = `监控地址: ${address}\n${notificationData.message}`;
        }
      } catch (error) {
        console.error("处理监控配置信息出错:", error);
      }
    }

    // 检查上次通知时间和状态
    const lastNotification = notificationCache.get(monitorId);
    const now = Date.now();

    // 如果是失败状态
    if (status === 0) {
      // 如果设置了重复通知间隔（按失败次数），需要检查是否达到重复通知条件
      if (monitor.resendInterval > 0) {
        // 如果上次通知状态也是失败状态，需要检查是否达到重复通知的条件
        if (lastNotification && lastNotification.status === 0) {
          // 获取自上次通知之后的连续失败次数（不包含上次通知时的那次失败）
          const failuresSinceLastNotification = await prisma.monitorStatus.count({
            where: {
              monitorId,
              status: 0,
              timestamp: {
                gt: new Date(lastNotification.time) // 使用 gt 而不是 gte，排除上次通知的时间点
              }
            }
          });

          // 如果失败次数未达到重复通知间隔，则不发送通知
          if (failuresSinceLastNotification < monitor.resendInterval) {
            return;
          }
        }
      } else {
        // 如果未设置重复通知间隔（为0），且上次通知状态也是失败，则不发送重复通知
        if (lastNotification && lastNotification.status === 0) {
          return;
        }
      }

      // 查找最近一次成功状态的时间，以确定连续失败的起始点
      const lastSuccess = await prisma.monitorStatus.findFirst({
        where: {
          monitorId,
          status: 1
        },
        orderBy: {
          timestamp: 'desc'
        }
      });

      const continuousFailureStartTime = lastSuccess?.timestamp || new Date(0);

      // 获取连续失败的总次数
      const totalFailures = await prisma.monitorStatus.count({
        where: {
          monitorId,
          status: 0,
          timestamp: {
            gt: continuousFailureStartTime
          }
        }
      });

      // 获取第一次连续失败的时间
      const firstContinuousFailure = await prisma.monitorStatus.findFirst({
        where: {
          monitorId,
          status: 0,
          timestamp: {
            gt: continuousFailureStartTime
          }
        },
        orderBy: {
          timestamp: 'asc'
        }
      });

      // 计算失败持续时间
      const duration = firstContinuousFailure 
        ? Math.floor((now - firstContinuousFailure.timestamp.getTime()) / 1000 / 60) 
        : 0;

      // 扩展通知数据
      const aggregatedData = {
        ...notificationData,
        failureCount: totalFailures,
        firstFailureTime: firstContinuousFailure ? formatDateTime(firstContinuousFailure.timestamp) : '未知',
        lastFailureTime: formatDateTime(),
        failureDuration: duration,
        message: `连续失败 ${totalFailures} 次，首次失败于 ${firstContinuousFailure ? formatDateTime(firstContinuousFailure.timestamp) : '未知'}，持续 ${duration} 分钟\n${notificationData.message}`
      };

      // 发送聚合通知
      for (const binding of monitor.notificationBindings) {
        const channel = binding.notificationChannel;
        if (!channel.enabled) continue;

        try {
          const config = channel.config as Record<string, unknown> || {};
          await sendNotification(channel.type, config, aggregatedData);
        } catch (error) {
          console.error(`向 ${channel.name}(${channel.type}) 发送失败通知失败:`, error);
        }
      }

      // 更新通知缓存
      notificationCache.set(monitorId, { time: now, status: 0 });
    } else if (status === 1 && realPrevStatus === 0 && !isNewMonitor) {
      // 状态从故障恢复为正常，并且不是新添加的监控时才发送恢复通知
      
      // 获取恢复前的失败时长
      const recoverDuration = lastNotification && lastNotification.status === 0
        ? Math.floor((now - lastNotification.time) / 1000 / 60)
        : 0;
        
      // 增强恢复通知内容
      const recoveryData = {
        ...notificationData,
        message: `监控已恢复正常。${recoverDuration > 0 ? `故障持续了约 ${recoverDuration} 分钟。` : ''}\n${notificationData.message}`
      };
      
      // 发送恢复通知
      for (const binding of monitor.notificationBindings) {
        const channel = binding.notificationChannel;
        if (!channel.enabled) continue;

        try {
          const config = channel.config as Record<string, unknown> || {};
          await sendNotification(channel.type, config, recoveryData);
        } catch (error) {
          console.error(`向 ${channel.name}(${channel.type}) 发送恢复通知失败:`, error);
        }
      }
      
      // 更新通知缓存
      notificationCache.set(monitorId, { time: now, status: 1 });
    } else {
      // 其他状态变更通知
      for (const binding of monitor.notificationBindings) {
        const channel = binding.notificationChannel;
        if (!channel.enabled) continue;

        try {
          const config = channel.config as Record<string, unknown> || {};
          await sendNotification(channel.type, config, notificationData);
        } catch (error) {
          console.error(`向 ${channel.name}(${channel.type}) 发送通知失败:`, error);
        }
      }
      
      // 更新通知缓存
      notificationCache.set(monitorId, { time: now, status });
    }
  } catch (error) {
    console.error(`处理监控 ${monitorId} 状态变更通知时出错:`, error);
  }
}

/**
 * 根据不同的通知类型发送通知
 */
async function sendNotification(
  type: string,
  config: Record<string, unknown>,
  data: NotificationData
) {
  switch (type) {
    case '邮件':
      // 转换并验证配置
      const emailConfig: EmailConfig = {
        email: String(config.email || ''),
        smtpServer: String(config.smtpServer || ''),
        smtpPort: config.smtpPort as string || '587',
        username: config.username as string,
        password: config.password as string
      };
      return await sendEmailNotification(emailConfig, data);
    case 'Webhook':
      // 转换并验证配置
      const webhookConfig: WebhookConfig = {
        url: String(config.url || ''),
        method: config.method as string,
        headers: config.headers as Record<string, string>,
        bodyTemplate: config.bodyTemplate as string,
        contentType: config.contentType as string
      };
      return await sendWebhookNotification(webhookConfig, data);
    case '微信推送':
      // 转换并验证配置
      const wechatConfig: WechatConfig = {
        pushUrl: String(config.pushUrl || ''),
        titleTemplate: config.titleTemplate as string,
        contentTemplate: config.contentTemplate as string
      };
      return await sendWechatNotification(wechatConfig, data);
    case '钉钉推送':
      // 转换并验证配置
      const dingtalkConfig: DingTalkConfig = {
        webhookUrl: String(config.webhookUrl || ''),
        secret: config.secret as string
      };
      return await sendDingTalkNotification(dingtalkConfig, data);
    case '企业微信推送':
      // 转换并验证配置
      const workWechatConfig: WorkWechatConfig = {
        webhookUrl: String(config.webhookUrl || '')
      };
      return await sendWorkWechatNotification(workWechatConfig, data);
    default:
      throw new Error(`不支持的通知类型: ${type}`);
  }
}

/**
 * 发送邮件通知
 */
async function sendEmailNotification(
  config: EmailConfig,
  data: NotificationData
) {
  const { email, smtpServer, smtpPort, username, password } = config;
  
  if (!email || !smtpServer || !smtpPort) {
    throw new Error('邮件配置不完整');
  }
  
  // 创建传输器
  const transporter = nodemailer.createTransport({
    host: smtpServer,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: {
      user: username || email,
      pass: password
    }
  });
  
  // 构建邮件内容
  const subject = `Monitor - ${data.monitorName} 状态${data.statusText}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #6366F1; border-radius: 10px;">
      <h2 style="color: #6366F1;">🔔 监控状态变更通知</h2>
      <div style="background-color: ${data.status === 'UP' ? '#10B981' : '#EF4444'}1a; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0; color: ${data.status === 'UP' ? '#10B981' : '#EF4444'}; font-weight: bold; font-size: 16px;">
          状态: ${data.statusText}
        </p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">监控名称</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${data.monitorName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">监控类型</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.monitorType}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">变更时间</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.time}</td>
        </tr>
      </table>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0; white-space: pre-line;">${data.message}</p>
      </div>
      <hr style="border-top: 1px solid #EEE; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
    </div>
  `;
  
  // 发送邮件
  await transporter.sendMail({
    from: username || email,
    to: email,
    subject,
    html
  });
}

/**
 * 发送Webhook通知
 */
async function sendWebhookNotification(
  config: WebhookConfig,
  data: NotificationData
) {
  const { url, method = 'POST', headers, bodyTemplate, contentType = 'application/json' } = config;
  
  if (!url) {
    throw new Error('Webhook URL不能为空');
  }

  // 向后兼容性日志
  console.log(`Webhook配置: URL=${url}, Method=${method}, ContentType=${contentType}, 自定义模板=${!!bodyTemplate}, 自定义请求头=${!!headers}`);

  // 准备webhook数据
  const webhookData = {
    event: 'status_change',
    timestamp: new Date().toISOString(),
    monitor: {
      name: data.monitorName,
      type: data.monitorType,
      status: data.statusText,  // 中文状态描述
      status_code: data.statusCode, // 使用数字状态码
      time: data.time,
      message: data.message,
      address: null as string | null // 初始化地址字段为null
    },
    // 额外字段用于失败状态
    failure_info: data.failureCount ? {
      count: data.failureCount,
      first_failure_time: data.firstFailureTime,
      last_failure_time: data.lastFailureTime,
      duration_minutes: data.failureDuration
    } : null
  };
  
  // 从消息中提取监控地址信息并添加到webhook数据中
  const addressMatch = data.message.match(/监控地址: (.*?)(?:\n|$)/);
  if (addressMatch && addressMatch[1]) {
    webhookData.monitor.address = addressMatch[1];
  }

  // 处理请求体
  let requestBody: string | Record<string, unknown>;
  if (bodyTemplate) {
    // 使用自定义模板，替换变量
    let body = bodyTemplate;
    Object.entries(data).forEach(([key, value]) => {
      // 对变量值进行JSON转义，只转义真正的控制字符
      const escapedValue = String(value)
        .replace(/\\/g, '\\\\')  // 反斜杠
        .replace(/"/g, '\\"')    // 双引号
        .replace(/\n/g, '\\n')   // 换行符
        .replace(/\r/g, '\\r')   // 回车符
        .replace(/\t/g, '\\t');  // 制表符
      // 移除其他控制字符的转义，避免过度转义
      
      body = body.replace(new RegExp(`\\{${key}\\}`, 'g'), escapedValue);
    });
    
    // 根据Content-Type处理请求体
    if (contentType === 'application/json') {
      try {
        requestBody = JSON.parse(body);
      } catch (error) {
        console.error('自定义JSON模板解析失败，使用原始字符串:', error);
        console.error('原始模板:', body);
        requestBody = body;
      }
    } else {
      requestBody = body;
    }
  } else {
    // 使用默认数据结构
    requestBody = webhookData;
  }

  // 根据Content-Type设置请求头
  const requestHeaders: Record<string, string> = {
    'Content-Type': contentType,
    'User-Agent': 'CoolMonitor-Notification-Service'
  };
  if (headers) {
    Object.assign(requestHeaders, headers);
  }
  
  console.log(`发送Webhook通知: URL=${url}, 监控项=${data.monitorName}, 状态=${data.statusText}`);
  console.log(`Webhook数据: ${JSON.stringify(requestBody)}`);
  
  try {
    // 发送webhook请求
    const response = await axios({
      url,
      method,
      headers: requestHeaders,
      data: requestBody,
      timeout: 10000
    });
    
    console.log(`Webhook通知发送成功: 状态码=${response.status}, 监控项=${data.monitorName}`);
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`Webhook通知发送失败，服务器响应: 状态码=${error.response.status}, 数据=${JSON.stringify(error.response.data)}, 监控项=${data.monitorName}`);
      } else if (error.request) {
        console.error(`Webhook通知发送失败，无响应: ${error.message}, 监控项=${data.monitorName}`);
      } else {
        console.error(`Webhook通知发送失败，请求配置错误: ${error.message}, 监控项=${data.monitorName}`);
      }
    } else {
      console.error(`Webhook通知发送失败，未知错误: ${error}, 监控项=${data.monitorName}`);
    }
    throw error;
  }
}

/**
 * 发送微信推送通知
 */
async function sendWechatNotification(
  config: WechatConfig,
  data: NotificationData
) {
  const { pushUrl, titleTemplate, contentTemplate } = config;
  
  if (!pushUrl) {
    throw new Error('微信推送URL不能为空');
  }
  
  // 替换模板中的变量
  let title = titleTemplate || "Monitor - {monitorName} 状态{statusText}";
  let content = contentTemplate || 
    "## 监控状态变更通知\n\n" +
    "- **监控名称**: {monitorName}\n" +
    "- **监控类型**: {monitorType}\n" +
    "- **当前状态**: {statusText}\n" +
    "- **变更时间**: {time}\n" +
    (data.failureCount ? 
      "- **连续失败次数**: {failureCount} 次\n" +
      "- **首次失败时间**: {firstFailureTime}\n" +
      "- **最后失败时间**: {lastFailureTime}\n" +
      "- **失败持续时间**: {failureDuration} 分钟\n\n" : "\n") +
    "{message}";
  
  // 替换所有模板变量
  Object.entries(data).forEach(([key, value]) => {
    title = title.replace(new RegExp(`{${key}}`, 'g'), String(value));
    content = content.replace(new RegExp(`{${key}}`, 'g'), String(value));
  });
  
  // 发送微信推送请求
  await axios.post(pushUrl, { 
    title, 
    content 
  }, {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 10000
  });
}

/**
 * 发送钉钉推送通知
 */
async function sendDingTalkNotification(
  config: DingTalkConfig,
  data: NotificationData
) {
  const { webhookUrl, secret } = config;
  const messageType = 'markdown'; // 固定使用markdown格式
  
  if (!webhookUrl) {
    throw new Error('钉钉Webhook URL不能为空');
  }
  
  // 构建消息内容
  let content = '';
  const title = `Monitor - ${data.monitorName} 状态${data.statusText}`;
  
  // 使用Markdown消息格式
  content = `## 🔔 监控状态变更通知\n\n` +
    `- **监控名称**: ${data.monitorName}\n` +
    `- **监控类型**: ${data.monitorType}\n` +
    `- **当前状态**: <font color="${data.statusCode === 1 ? '#10B981' : '#EF4444'}">${data.statusText}</font>\n` +
    `- **变更时间**: ${data.time}\n`;
  
  if (data.failureCount) {
    content += `- **连续失败次数**: ${data.failureCount} 次\n` +
      `- **首次失败时间**: ${data.firstFailureTime}\n` +
      `- **最后失败时间**: ${data.lastFailureTime}\n` +
      `- **失败持续时间**: ${data.failureDuration} 分钟\n`;
  }
  
  content += `\n**详细信息**:\n\n${data.message}`;
  
  // 构建钉钉消息体
  interface DingTalkMessageBody {
    msgtype: string;
    text?: {
      content: string;
    };
    markdown?: {
      title: string;
      text: string;
    };
    at: {
      atMobiles: string[];
      atUserIds: string[];
      isAtAll: boolean;
    };
  }
  
  const messageBody: DingTalkMessageBody = {
    msgtype: messageType,
    markdown: {
      title: title,
      text: content
    },
    at: {
      atMobiles: [],
      atUserIds: [],
      isAtAll: false
    }
  };
  
  // 如果配置了加签密钥，则生成签名
  let finalUrl = webhookUrl;
  if (secret) {
    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${secret}`;
    const sign = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
    const encodedSign = encodeURIComponent(sign);
    finalUrl = `${webhookUrl}&timestamp=${timestamp}&sign=${encodedSign}`;
  }
  
  console.log(`发送钉钉通知: URL=${webhookUrl}, 监控项=${data.monitorName}, 状态=${data.statusText}`);
  console.log(`钉钉消息数据: ${JSON.stringify(messageBody)}`);
  
  try {
    // 发送钉钉推送请求
    const response = await axios.post(finalUrl, messageBody, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CoolMonitor-DingTalk-Notification'
      },
      timeout: 10000
    });
    
    console.log(`钉钉通知发送成功: 状态码=${response.status}, 监控项=${data.monitorName}`);
    
    // 检查钉钉API返回的结果
    if (response.data && response.data.errcode !== 0) {
      throw new Error(`钉钉API返回错误: ${response.data.errmsg || '未知错误'}`);
    }
    
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`钉钉通知发送失败，服务器响应: 状态码=${error.response.status}, 数据=${JSON.stringify(error.response.data)}, 监控项=${data.monitorName}`);
      } else if (error.request) {
        console.error(`钉钉通知发送失败，无响应: ${error.message}, 监控项=${data.monitorName}`);
      } else {
        console.error(`钉钉通知发送失败，请求配置错误: ${error.message}, 监控项=${data.monitorName}`);
      }
    } else {
      console.error(`钉钉通知发送失败，未知错误: ${error}, 监控项=${data.monitorName}`);
    }
    throw error;
  }
}

/**
 * 发送企业微信推送通知
 */
async function sendWorkWechatNotification(
  config: WorkWechatConfig,
  data: NotificationData
) {
  const { webhookUrl } = config;
  
  if (!webhookUrl) {
    throw new Error('企业微信Webhook URL不能为空');
  }
  
  // 构建企业微信消息内容
  const content = {
    msgtype: "markdown",
    markdown: {
      content: `## 🔔 监控状态变更通知\n\n` +
        `**监控名称**: ${data.monitorName}\n` +
        `**监控类型**: ${data.monitorType}\n` +
        `**当前状态**: <font color="${data.statusCode === 1 ? 'info' : 'warning'}">${data.statusText}</font>\n` +
        `**变更时间**: ${data.time}\n` +
        (data.failureCount ? 
          `**连续失败次数**: ${data.failureCount} 次\n` +
          `**首次失败时间**: ${data.firstFailureTime}\n` +
          `**最后失败时间**: ${data.lastFailureTime}\n` +
          `**失败持续时间**: ${data.failureDuration} 分钟\n` : '') +
        `\n**详细信息**: ${data.message}`
    }
  };
  
  console.log(`发送企业微信通知: URL=${webhookUrl}, 监控项=${data.monitorName}, 状态=${data.statusText}`);
  console.log(`企业微信消息数据: ${JSON.stringify(content)}`);
  
  try {
    // 发送企业微信推送请求
    const response = await axios.post(webhookUrl, content, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CoolMonitor-WorkWechat-Notification'
      },
      timeout: 10000
    });
    
    console.log(`企业微信通知发送成功: 状态码=${response.status}, 监控项=${data.monitorName}`);
    
    // 检查企业微信API返回结果
    if (response.data && response.data.errcode !== 0) {
      throw new Error(`企业微信API返回错误: ${response.data.errmsg || '未知错误'}`);
    }
    
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`企业微信通知发送失败，服务器响应: 状态码=${error.response.status}, 数据=${JSON.stringify(error.response.data)}, 监控项=${data.monitorName}`);
      } else if (error.request) {
        console.error(`企业微信通知发送失败，无响应: ${error.message}, 监控项=${data.monitorName}`);
      } else {
        console.error(`企业微信通知发送失败，请求配置错误: ${error.message}, 监控项=${data.monitorName}`);
      }
    } else {
      console.error(`企业微信通知发送失败，未知错误: ${error}, 监控项=${data.monitorName}`);
    }
    throw error;
  }
}
