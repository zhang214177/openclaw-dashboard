import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('username', username);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
    }
  }, [token, username]);

  const logout = () => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  if (!token) {
    return <Auth setToken={setToken} setUsername={setUsername} />;
  }

  return <Dashboard token={token} username={username} logout={logout} />;
}

function Auth({ setToken, setUsername }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '', email: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await axios.post(`${API_URL}/auth/login`, {
          username: formData.username,
          password: formData.password
        });
        setToken(res.data.token);
        setUsername(res.data.username);
      } else {
        await axios.post(`${API_URL}/auth/register`, formData);
        setIsLogin(true);
        setError('注册成功！请登录');
      }
    } catch (err) {
      setError(err.response?.data?.error || '操作失败');
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>🦞 OpenClaw</h1>
          <p>{isLogin ? '登录监控面板' : '创建账户'}</p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label>邮箱（可选）</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          )}

          <button type="submit" className="btn" disabled={loading}>
            {loading ? '处理中...' : isLogin ? '登录' : '注册'}
          </button>
        </form>

        <button className="btn btn-secondary" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? '没有账户？注册' : '已有账户？登录'}
        </button>
      </div>
    </div>
  );
}

function Dashboard({ token, username, logout }) {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, activitiesRes] = await Promise.all([
        axios.get(`${API_URL}/openclaw/status`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/activities`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setStats(statusRes.data);
      setActivities(activitiesRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, [token]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div className="dashboard">
      <header className="header">
        <h1>🦞 OpenClaw 监控面板</h1>
        <div className="header-right">
          <span className="user-info">{username}</span>
          <button className="refresh-btn" onClick={fetchData} disabled={loading}>
            {loading ? '刷新中...' : '🔄 刷新'}
          </button>
          <button className="logout-btn" onClick={logout}>退出</button>
        </div>
      </header>

      <main className="main-content">
        {loading && !stats ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>运行状态</h3>
                <div className="stat-value">
                  <span className="status-indicator status-online">
                    <span className="status-dot"></span>
                    在线
                  </span>
                </div>
                <div className="stat-detail">OpenClaw Gateway 正常运行中</div>
              </div>

              <div className="stat-card">
                <h3>系统信息</h3>
                <div className="stat-value">{stats?.nodeVersion || 'N/A'}</div>
                <div className="stat-detail">{stats?.os?.substring(0, 40) || 'N/A'}...</div>
              </div>

              <div className="stat-card">
                <h3>已安装 Skills</h3>
                <div className="stat-value">{stats?.skillsCount || 0}</div>
                <div className="stat-detail">个技能已配置</div>
              </div>

              <div className="stat-card">
                <h3>定时任务</h3>
                <div className="stat-value">{stats?.cronCount || 0}</div>
                <div className="stat-detail">个 Cron 任务</div>
              </div>

              <div className="stat-card">
                <h3>运行时间</h3>
                <div className="stat-value" style={{ fontSize: '20px' }}>
                  {stats?.uptime?.split('up ')?.[1]?.split(',')?.[0] || 'N/A'}
                </div>
                <div className="stat-detail">系统持续运行</div>
              </div>

              <div className="stat-card">
                <h3>最后更新</h3>
                <div className="stat-value" style={{ fontSize: '18px' }}>
                  {stats?.timestamp ? formatTime(stats.timestamp) : 'N/A'}
                </div>
                <div className="stat-detail">实时数据</div>
              </div>
            </div>

            <div className="stat-card" style={{ marginBottom: '24px' }}>
              <h3>🧠 Skills 列表</h3>
              <div className="skills-grid">
                {stats?.skillsList?.map((skill) => (
                  <span key={skill} className="skill-tag">{skill}</span>
                )) || '无'}
              </div>
            </div>

            <div className="stat-card">
              <h3>💾 内存使用</h3>
              <pre style={{ 
                background: '#0f172a', 
                padding: '16px', 
                borderRadius: '8px',
                fontSize: '12px',
                overflow: 'auto',
                color: '#94a3b8'
              }}>
                {stats?.memory || 'N/A'}
              </pre>
            </div>

            <div className="activities-section" style={{ marginTop: '24px' }}>
              <h2>📊 最近活动</h2>
              <div className="activities-list">
                {activities.length > 0 ? activities.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="activity-item">
                    <div className="activity-icon">📝</div>
                    <div className="activity-content">
                      <div className="activity-title">{activity.description}</div>
                      <div className="activity-time">
                        {activity.activity_type} · {formatTime(activity.recorded_at)}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                    暂无活动记录
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
