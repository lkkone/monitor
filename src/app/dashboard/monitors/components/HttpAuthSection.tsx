import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface HttpAuthSectionProps {
  monitorType: string;
  requestHeaders: string;
  setRequestHeaders: Dispatch<SetStateAction<string>>;
}

export function HttpAuthSection({
  monitorType,
  requestHeaders,
  setRequestHeaders
}: HttpAuthSectionProps) {
  // HTTP认证状态
  const [authEnabled, setAuthEnabled] = useState(false);
  const [authType, setAuthType] = useState("basic");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");

  // 解析现有的请求头
  useEffect(() => {
    if (requestHeaders) {
      try {
        const headersObj = JSON.parse(requestHeaders);
        if (headersObj.Authorization) {
          setAuthEnabled(true);
          const authValue = headersObj.Authorization;
          
          if (authValue.startsWith("Basic ")) {
            setAuthType("basic");
            try {
              const decoded = atob(authValue.substring(6));
              const [user, pass] = decoded.split(":");
              setUsername(user || "");
              setPassword(pass || "");
            } catch {
              // 如果解码失败，保持为空
            }
          } else if (authValue.startsWith("Bearer ")) {
            setAuthType("bearer");
            setToken(authValue.substring(7));
          }
        }
              } catch {
          // 如果解析失败，保持默认状态
        }
    }
  }, [requestHeaders]);

  // 更新请求头
  const updateRequestHeaders = (newAuthHeader: string | null) => {
    try {
      let headersObj: Record<string, string> = {};
      if (requestHeaders) {
        headersObj = JSON.parse(requestHeaders);
      }
      
      if (newAuthHeader) {
        headersObj.Authorization = newAuthHeader;
      } else {
        delete headersObj.Authorization;
      }
      
      setRequestHeaders(JSON.stringify(headersObj, null, 2));
    } catch (e) {
      console.error("更新请求头失败:", e);
    }
  };

  // 处理认证类型变化
  const handleAuthTypeChange = (type: string) => {
    setAuthType(type);
    setUsername("");
    setPassword("");
    setToken("");
    updateRequestHeaders(null);
  };

  // 处理用户名密码变化
  const handleBasicAuthChange = (field: "username" | "password", value: string) => {
    if (field === "username") {
      setUsername(value);
    } else {
      setPassword(value);
    }
    
    // 使用当前值而不是状态值，因为状态更新是异步的
    const currentUsername = field === "username" ? value : username;
    const currentPassword = field === "password" ? value : password;
    
    if (currentUsername && currentPassword) {
      const authString = btoa(`${currentUsername}:${currentPassword}`);
      updateRequestHeaders(`Basic ${authString}`);
    } else {
      updateRequestHeaders(null);
    }
  };

  // 处理Bearer Token变化
  const handleTokenChange = (value: string) => {
    setToken(value);
    if (value) {
      updateRequestHeaders(`Bearer ${value}`);
    } else {
      updateRequestHeaders(null);
    }
  };

  // 处理认证开关
  const handleAuthToggle = (enabled: boolean) => {
    setAuthEnabled(enabled);
    if (!enabled) {
      setUsername("");
      setPassword("");
      setToken("");
      updateRequestHeaders(null);
    }
  };

  // 仅对HTTP相关监控类型显示
  if (!["http", "keyword", "https-cert"].includes(monitorType)) {
    return null;
  }

  return (
    <div className="p-5 border border-primary/10 rounded-lg">
      <h3 className="text-lg font-medium mb-4 text-primary">HTTP 认证</h3>
      
      <div className="space-y-4">
        {/* 认证开关 */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="authEnabled"
            checked={authEnabled}
            onChange={(e) => handleAuthToggle(e.target.checked)}
            className="w-4 h-4 text-primary border-primary/30 focus:ring-primary"
          />
          <label htmlFor="authEnabled" className="text-foreground/80">
            启用HTTP认证
          </label>
        </div>

        {authEnabled && (
          <div className="space-y-4 pl-6">
            {/* 认证类型选择 */}
            <div className="space-y-2">
              <label className="block text-foreground/80 font-medium">认证类型</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="authType"
                    value="basic"
                    checked={authType === "basic"}
                    onChange={(e) => handleAuthTypeChange(e.target.value)}
                    className="w-4 h-4 text-primary border-primary/30 focus:ring-primary"
                  />
                  <span className="text-foreground/80">Basic认证</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="authType"
                    value="bearer"
                    checked={authType === "bearer"}
                    onChange={(e) => handleAuthTypeChange(e.target.value)}
                    className="w-4 h-4 text-primary border-primary/30 focus:ring-primary"
                  />
                  <span className="text-foreground/80">Bearer Token</span>
                </label>
              </div>
            </div>

            {/* Basic认证表单 */}
            {authType === "basic" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-foreground/80 font-medium">用户名</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => handleBasicAuthChange("username", e.target.value)}
                    placeholder="输入用户名"
                    className="w-full px-4 py-2 rounded-lg dark:bg-dark-input bg-light-input border border-primary/20 focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-foreground/80 font-medium">密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => handleBasicAuthChange("password", e.target.value)}
                    placeholder="输入密码"
                    className="w-full px-4 py-2 rounded-lg dark:bg-dark-input bg-light-input border border-primary/20 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Bearer Token表单 */}
            {authType === "bearer" && (
              <div className="space-y-2">
                <label className="block text-foreground/80 font-medium">Token</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => handleTokenChange(e.target.value)}
                  placeholder="输入Bearer Token"
                  className="w-full px-4 py-2 rounded-lg dark:bg-dark-input bg-light-input border border-primary/20 focus:border-primary focus:outline-none"
                />
                                 <p className="text-xs text-foreground/50">
                   输入完整的Token，系统会自动添加&ldquo;Bearer &rdquo;前缀
                 </p>
              </div>
            )}

            {/* 提示信息 */}
            <div className="text-xs text-foreground/50 bg-primary/5 p-3 rounded-lg">
              <p className="font-medium mb-1">认证信息说明：</p>
              <ul className="space-y-1">
                <li>• Basic认证：适用于需要用户名密码的API接口</li>
                <li>• Bearer Token：适用于需要API密钥或JWT Token的接口</li>
                <li>• 认证信息会自动添加到请求头中</li>
                <li>• 密码和Token信息会以加密形式存储</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 