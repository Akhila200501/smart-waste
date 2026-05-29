import React, { useState, useEffect, useRef } from 'react';
import { 
  Leaf, 
  Upload, 
  MessageSquare, 
  LayoutDashboard, 
  History, 
  LogOut, 
  Sparkles, 
  TrendingUp, 
  Trash2, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle,
  HelpCircle,
  Award,
  Send,
  Loader2,
  Calendar,
  CloudLightning,
  Sprout,
  Menu,
  X,
  Plus
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

const BACKEND_URL = 'http://localhost:8000';

function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('authToken') || '');
  const [user, setUser] = useState(null);
  
  // Navigation & UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Dashboard & Logs data
  const [analytics, setAnalytics] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // AI Scanner state
  const [scanImage, setScanImage] = useState(null);
  const [scanFile, setScanFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [accordionOpen, setAccordionOpen] = useState({
    instructions: true,
    sdg: false,
    circular: false
  });
  
  // Chatbot state
  const [chats, setChats] = useState([]);
  const [chatHistoryList, setChatHistoryList] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Auth form states
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  const chatBottomRef = useRef(null);

  // --- Show Toast Notification ---
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // --- Authenticated Fetch Helper ---
  const apiFetch = async (path, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
    });
    
    if (response.status === 401) {
      // Token expired or invalid
      handleLogout();
      showToast('Session expired. Please log in again.', 'error');
      throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'API request failed');
    }
    
    return response.json();
  };

  // --- Check Auth Status & Fetch Profile ---
  useEffect(() => {
    if (token) {
      apiFetch('/api/auth/me')
        .then(userData => {
          setUser(userData);
          fetchDashboardData();
        })
        .catch(err => {
          console.error("Auth check failed:", err);
          handleLogout();
        });
    }
  }, [token]);

  // --- Fetch data for dashboard ---
  const fetchDashboardData = () => {
    apiFetch('/api/dashboard/analytics')
      .then(data => setAnalytics(data))
      .catch(err => console.error("Failed to load analytics:", err));
      
    apiFetch('/api/waste/records')
      .then(data => setLogs(data))
      .catch(err => console.error("Failed to load waste logs:", err));
      
    apiFetch('/api/chat/history')
      .then(data => setChatHistoryList(data))
      .catch(err => console.error("Failed to load chat history:", err));
  };

  // --- Autoscroll Chats ---
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats]);

  // --- Auth Handlers ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput || (authMode === 'register' && !emailInput)) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }
    
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });
        localStorage.setItem('authToken', data.access_token);
        setToken(data.access_token);
        showToast('Successfully logged in!', 'success');
      } else {
        await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username: usernameInput, email: emailInput, password: passwordInput })
        });
        showToast('Registration successful! Logging you in...', 'success');
        // Auto-login
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });
        localStorage.setItem('authToken', data.access_token);
        setToken(data.access_token);
      }
      
      // Clear inputs
      setUsernameInput('');
      setEmailInput('');
      setPasswordInput('');
    } catch (err) {
      showToast(err.message || 'Authentication failed', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setToken('');
    setUser(null);
    setAnalytics(null);
    setLogs([]);
    setChats([]);
    setChatHistoryList([]);
    setScanImage(null);
    setScanResult(null);
    setActiveTab('dashboard');
  };

  // --- Waste Scanner Handlers ---
  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] || e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Invalid file format. Please upload an image.', 'error');
        return;
      }
      setScanFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setScanImage(reader.result);
        setScanResult(null); // Clear previous results
      };
      reader.readAsDataURL(file);
    }
  };

  const runWasteClassification = async () => {
    if (!scanFile) return;
    
    setScanning(true);
    
    const formData = new FormData();
    formData.append('file', scanFile);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/waste/classify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'AI Classification failed.');
      }
      
      const result = await response.json();
      
      // Artificial delay (2s) to show off scanning visual laser lines
      setTimeout(() => {
        setScanResult(result);
        setScanning(false);
        showToast(`Waste detected: ${result.display_name}!`, 'success');
        fetchDashboardData(); // Refresh metrics and graphs
      }, 2000);
      
    } catch (err) {
      showToast(err.message || 'Scanner Error', 'error');
      setScanning(false);
    }
  };

  const resetScanner = () => {
    setScanFile(null);
    setScanImage(null);
    setScanResult(null);
    setScanning(false);
  };

  // --- Sustainability Chatbot Handlers ---
  const handleSendMessage = async (e, text = null) => {
    if (e) e.preventDefault();
    const msg = text || inputMessage;
    if (!msg.trim()) return;
    
    const userMsg = { sender: 'user', message: msg, timestamp: new Date().toISOString() };
    setChats(prev => [...prev, userMsg]);
    setInputMessage('');
    setChatLoading(true);
    
    try {
      const data = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: msg })
      });
      
      const assistantMsg = { 
        sender: 'assistant', 
        message: data.response, 
        timestamp: new Date().toISOString() 
      };
      
      setChats(prev => [...prev, assistantMsg]);
      fetchDashboardData(); // Refresh history listing
    } catch (err) {
      showToast('Error getting chat response.', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  const loadPastChatSession = async (chatRecord) => {
    setChats([
      { sender: 'user', message: chatRecord.message, timestamp: chatRecord.timestamp },
      { sender: 'assistant', message: chatRecord.response, timestamp: chatRecord.timestamp }
    ]);
  };

  // --- Render Functions ---
  
  if (!token) {
    // Unauthenticated Layout
    return (
      <div className="auth-page">
        <div className="glass-card auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <Leaf className="logo-icon" />
              <span>EcoCycle AI</span>
            </div>
            <h2 className="auth-title">
              {authMode === 'login' ? 'Welcome Back!' : 'Create Sustainability Account'}
            </h2>
            <p className="auth-subtitle">
              {authMode === 'login' 
                ? 'Sign in to classify waste and track carbon reduction' 
                : 'Join our circular waste and composting community'}
            </p>
          </div>
          
          <form onSubmit={handleAuthSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter username"
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                required
              />
            </div>
            
            {authMode === 'register' && (
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="Enter email address"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="Enter password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                required
              />
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={authLoading}>
              {authLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Processing...
                </>
              ) : (
                authMode === 'login' ? 'Sign In' : 'Sign Up'
              )}
            </button>
          </form>
          
          <div className="auth-footer">
            {authMode === 'login' ? (
              <p>Don't have an account? <span className="auth-link" onClick={() => setAuthMode('register')}>Sign Up</span></p>
            ) : (
              <p>Already have an account? <span className="auth-link" onClick={() => setAuthMode('login')}>Sign In</span></p>
            )}
          </div>
        </div>
        
        {toast && (
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle size={18} /> : <ShieldAlert size={18} />}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  // Helper colors for circular statistics pie chart
  const PIE_COLORS = {
    plastic: '#06b6d4', // cyan
    glass: '#8b5cf6',   // purple
    paper: '#f59e0b',   // amber
    metal: '#3b82f6',   // blue
    organic: '#10b981'  // emerald
  };

  const getPieChartData = () => {
    if (!analytics || !analytics.categories_count) return [];
    return Object.entries(analytics.categories_count)
      .map(([name, value]) => ({ 
        name: name.charAt(0).toUpperCase() + name.slice(1), 
        value,
        color: PIE_COLORS[name] || '#ffffff'
      }))
      .filter(item => item.value > 0);
  };

  const getBadgeIcon = (name) => {
    switch (name) {
      case 'Eco Pioneer': return <Leaf size={20} />;
      case 'Compost Master': return <Sprout size={20} />;
      case 'Carbon Slasher': return <CloudLightning size={20} />;
      default: return <Award size={20} />;
    }
  };

  // Pre-compiled list of badges for listing locked items
  const ALL_BADGES = [
    { id: 'badge_first', name: 'Eco Pioneer', desc: 'Logged your first piece of waste', icon: 'Seedling' },
    { id: 'badge_compost', name: 'Compost Master', desc: 'Composted 3+ organic items', icon: 'Sprout' },
    { id: 'badge_carbon', name: 'Carbon Slasher', desc: 'Saved over 5kg of CO2 emissions', icon: 'CloudLightning' },
    { id: 'badge_all', name: 'Recycling Maestro', desc: 'Classified waste in all 5 categories', icon: 'Award' }
  ];

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="logo-container">
          <Leaf className="logo-icon" />
          <span className="logo-text">EcoCycle AI</span>
          <button className="btn-logout" style={{ marginLeft: 'auto', display: 'none' }} onClick={() => setMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        
        <nav className="nav-links">
          <div 
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </div>
          <div 
            className={`nav-link ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => { setActiveTab('scanner'); setMobileMenuOpen(false); }}
          >
            <Upload size={20} />
            <span>Waste Classifier</span>
          </div>
          <div 
            className={`nav-link ${activeTab === 'chatbot' ? 'active' : ''}`}
            onClick={() => { setActiveTab('chatbot'); setMobileMenuOpen(false); }}
          >
            <MessageSquare size={20} />
            <span>AI RAG Chatbot</span>
          </div>
          <div 
            className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('history'); setMobileMenuOpen(false); }}
          >
            <History size={20} />
            <span>Waste Logs</span>
          </div>
        </nav>
        
        <div className="user-profile-footer">
          <div className="user-info">
            <span className="user-name">{user?.username || 'Eco Warrior'}</span>
            <span className="user-badge">{analytics?.summary?.rank || 'Eco Beginner'}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Sign Out">
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content">
        {/* Mobile Header Bar */}
        <header className="page-header" style={{ marginBottom: '24px' }}>
          <div>
            <h1 className="page-title">
              {activeTab === 'dashboard' && 'Environmental Dashboard'}
              {activeTab === 'scanner' && 'Computer Vision Classifier'}
              {activeTab === 'chatbot' && 'Granite Chatbot'}
              {activeTab === 'history' && 'Waste Recycling Logs'}
            </h1>
            <p className="page-subtitle">
              {activeTab === 'dashboard' && `Welcome back, ${user?.username}! Aligned with UN SDGs 11, 12, and 13.`}
              {activeTab === 'scanner' && 'Upload images of waste to predict their category and extract recycling guides.'}
              {activeTab === 'chatbot' && 'Retrieval-Augmented Generation sustainability chatbot powered by IBM Granite.'}
              {activeTab === 'history' && 'Audit your circular historical waste activities and carbon footprint offsets.'}
            </p>
          </div>
          
          <button 
            className="btn btn-secondary btn-icon" 
            style={{ display: 'none' }} /* Trigger for mobile menu if needed */
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu size={20} />
          </button>
        </header>

        {/* PAGE 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Analytics Summary Row */}
            <section className="metrics-grid">
              <div className="glass-card metric-card">
                <div className="metric-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                  <Leaf size={24} />
                </div>
                <div className="metric-details">
                  <span className="metric-label">Total Logs</span>
                  <span className="metric-value">{analytics?.summary?.total_items || 0}</span>
                  <span className="metric-sub">Items diverted from landfill</span>
                </div>
              </div>
              
              <div className="glass-card metric-card">
                <div className="metric-icon-box" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>
                  <CloudLightning size={24} />
                </div>
                <div className="metric-details">
                  <span className="metric-label">Carbon Offset</span>
                  <span className="metric-value">{analytics?.summary?.total_carbon_saved || 0} kg</span>
                  <span className="metric-sub">CO2 emissions prevented</span>
                </div>
              </div>
              
              <div className="glass-card metric-card">
                <div className="metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <TrendingUp size={24} />
                </div>
                <div className="metric-details">
                  <span className="metric-label">Circular Offsets</span>
                  <span className="metric-value">{analytics?.summary?.recycling_percentage || 0}%</span>
                  <span className="metric-sub">Ideal circularity rate</span>
                </div>
              </div>
              
              <div className="glass-card metric-card">
                <div className="metric-icon-box" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                  <Award size={24} />
                </div>
                <div className="metric-details">
                  <span className="metric-label">Circular Score</span>
                  <span className="metric-value">{analytics?.summary?.total_points || 0} pts</span>
                  <span className="metric-sub">Rank: {analytics?.summary?.rank || 'Eco Beginner'}</span>
                </div>
              </div>
            </section>

            {/* Visual Analytics Graphs */}
            <section className="dashboard-grid">
              {/* Daily Waste Line Graph */}
              <div className="glass-card chart-card">
                <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>7-Day Waste Offset Trends</h3>
                {analytics?.daily_tracking && analytics.daily_tracking.length > 0 ? (
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <LineChart data={analytics.daily_tracking}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                        <XAxis dataKey="date" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total" name="Total Waste Items" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="organic" name="Organic (Compost)" stroke="#eab308" strokeWidth={1.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                    No time-series data available. Scan your first piece of waste to populate.
                  </div>
                )}
              </div>

              {/* Categorical Distribution Pie Chart */}
              <div className="glass-card chart-card">
                <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Material Breakdown</h3>
                {getPieChartData().length > 0 ? (
                  <div style={{ width: '100%', height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={getPieChartData()}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {getPieChartData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', fontSize: '0.75rem', marginTop: '12px' }}>
                      {getPieChartData().map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color }} />
                          <span style={{ color: '#9ca3af' }}>{item.name}: {item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', textAlign: 'center' }}>
                    Upload waste inside the "Waste Classifier" panel to visualize material flows.
                  </div>
                )}
              </div>
            </section>

            <section className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* Gamification Achievements */}
              <div className="glass-card-no-hover">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.2rem' }}>Circular Achievements</h3>
                  <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>Rank Progress</span>
                </div>
                
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#9ca3af' }}>Current: <b>{analytics?.summary?.rank}</b></span>
                    <span style={{ color: '#9ca3af' }}>Next: <b>{analytics?.summary?.next_rank}</b></span>
                  </div>
                  {analytics?.summary?.next_rank !== 'Max Rank Achieved' ? (
                    <>
                      <div className="points-progress-bar">
                        <div 
                          className="points-progress-fill" 
                          style={{ width: `${Math.min(100, Math.max(0, 100 - (analytics?.summary?.points_to_next / 5)))}%` }} 
                        />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '6px', display: 'block' }}>
                        {analytics?.summary?.points_to_next} points remaining to rank up (10 points per logged item).
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '6px', display: 'block' }}>
                      Highest rank achieved. You are a Circular Ambassador!
                    </span>
                  )}
                </div>
                
                <div className="badges-container">
                  {ALL_BADGES.map((badge) => {
                    const isUnlocked = analytics?.badges?.some(b => b.id === badge.id);
                    return (
                      <div key={badge.id} className={`badge-item ${!isUnlocked ? 'badge-locked' : ''}`}>
                        <div className="badge-icon-box">
                          {getBadgeIcon(badge.name)}
                        </div>
                        <div className="badge-info">
                          <span className="badge-name">{badge.name}</span>
                          <span className="badge-desc">{badge.desc}</span>
                        </div>
                        {isUnlocked && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>UNLOCKED</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* UN SDG & Circular Economy Goals */}
              <div className="glass-card-no-hover" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Aligned UN SDG Metrics</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>SDG 11</span>
                      <span style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '0.9rem' }}>Sustainable Cities and Communities</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Diversion from landfills lessens municipal waste footprints. Keep local cities clean and livable.</p>
                  </div>
                  
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ background: '#f59e0b', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>SDG 12</span>
                      <span style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '0.9rem' }}>Responsible Consumption & Production</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Substantially reduce global waste flows by prioritizing mechanical recycling, reuse and circular composting.</p>
                  </div>
                  
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>SDG 13</span>
                      <span style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: '0.9rem' }}>Climate Action & Carbon Reductions</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Replacing virgin ores saves mining energy, while composting minimizes organic methane production.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* PAGE 2: COMPUTER VISION CLASSIFIER */}
        {activeTab === 'scanner' && (
          <div className="scanner-container">
            {/* Upload Zone */}
            <div className="glass-card-no-hover">
              <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Upload Waste Container</h3>
              
              {!scanImage ? (
                <div 
                  className="upload-zone"
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  <input 
                    type="file" 
                    id="imageUpload" 
                    style={{ display: 'none' }} 
                    accept="image/*"
                    onChange={handleFileDrop}
                  />
                  <label htmlFor="imageUpload" style={{ display: 'contents', cursor: 'pointer' }}>
                    <div className="upload-icon">
                      <Upload size={48} />
                    </div>
                    <span className="upload-title">Drag & Drop Image Here</span>
                    <span className="upload-subtitle">Supports JPG, PNG, WEBP (Max 5MB)</span>
                    <button className="btn btn-secondary" style={{ marginTop: '20px' }}>
                      Browse Files
                    </button>
                  </label>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="upload-zone" style={{ padding: 0 }}>
                    <div className="preview-container">
                      <img src={scanImage} alt="Uploaded waste preview" className="preview-img" />
                      {scanning && <div className="scanner-scanline" />}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      className="btn btn-primary" 
                      onClick={runWasteClassification} 
                      disabled={scanning}
                      style={{ flexGrow: 1 }}
                    >
                      {scanning ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          Analyzing Materials...
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          Analyze with AI
                        </>
                      )}
                    </button>
                    <button className="btn btn-secondary" onClick={resetScanner} disabled={scanning}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Results Display Panel */}
            <div className="glass-card-no-hover" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>AI Diagnostics</h3>
              
              {scanning && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, gap: '16px', color: '#9ca3af' }}>
                  <Loader2 className="animate-spin" size={36} style={{ color: '#10b981' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, color: '#fff' }}>Running Deep CNN Inference</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Decoding patterns, mapping labels, checking recyclability...</p>
                  </div>
                </div>
              )}
              
              {!scanning && !scanResult && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, color: '#6b7280', textAlign: 'center', padding: '40px' }}>
                  <HelpCircle size={48} style={{ marginBottom: '16px' }} />
                  <p style={{ fontWeight: 600, color: '#9ca3af' }}>No material scanned yet</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>Upload an image on the left side and press "Analyze with AI" to activate TensorFlow metrics.</p>
                </div>
              )}
              
              {!scanning && scanResult && (
                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <div className="result-header">
                    <div>
                      <h4 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{scanResult.display_name}</h4>
                      <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Confidence Score: <b>{scanResult.confidence}%</b></span>
                    </div>
                    <span className="result-tag">{scanResult.category}</span>
                  </div>
                  
                  {/* Detailed Diagnostics Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '2px' }}>Carbon Prevention</span>
                      <span style={{ fontFamily: 'Outfit', fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>+{scanResult.carbon_saved} kg CO₂</span>
                    </div>
                    
                    <div style={{ background: 'rgba(6, 182, 212, 0.05)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '2px' }}>Material Recovery Rate</span>
                      <span style={{ fontFamily: 'Outfit', fontSize: '1.2rem', fontWeight: 700, color: '#06b6d4' }}>{scanResult.recycling_rate}</span>
                    </div>
                  </div>

                  {/* Accordion recommendation system */}
                  <div className="accordion-container">
                    {/* ACCORDION 1 */}
                    <div className="accordion-item">
                      <div 
                        className="accordion-header"
                        onClick={() => setAccordionOpen(prev => ({ ...prev, instructions: !prev.instructions }))}
                      >
                        <span>♻️ Step-by-Step Recycling Guide</span>
                        {accordionOpen.instructions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                      {accordionOpen.instructions && (
                        <div className="accordion-content">
                          <div className="instructions-list">
                            {scanResult.instructions?.map((inst, idx) => (
                              <div key={idx} className="instruction-step">
                                <span className="step-num">{idx + 1}.</span>
                                <span>{inst}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ACCORDION 2 */}
                    <div className="accordion-item">
                      <div 
                        className="accordion-header"
                        onClick={() => setAccordionOpen(prev => ({ ...prev, sdg: !prev.sdg }))}
                      >
                        <span>🎯 United Nations SDG Targets</span>
                        {accordionOpen.sdg ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                      {accordionOpen.sdg && (
                        <div className="accordion-content" style={{ padding: '14px 18px', fontSize: '0.85rem' }}>
                          <p style={{ color: '#fff', fontWeight: 600, marginBottom: '6px' }}>Circular SDG Offsets:</p>
                          <p>{scanResult.sdg_impact}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PAGE 3: AI RAG CHATBOT */}
        {activeTab === 'chatbot' && (
          <div className="chat-container">
            {/* Chats Sidebar */}
            <div className="glass-card chat-sidebar">
              <h3 style={{ fontSize: '1.1rem' }}>Chats Archive</h3>
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
                onClick={() => setChats([])}
              >
                <Plus size={16} /> New Chat
              </button>
              
              <div className="chat-history-list">
                {chatHistoryList.length > 0 ? (
                  chatHistoryList.map((chat) => (
                    <div 
                      key={chat.id} 
                      className="chat-history-item"
                      onClick={() => loadPastChatSession(chat)}
                    >
                      <div className="chat-history-title">{chat.message}</div>
                      <div className="chat-history-time">
                        {new Date(chat.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlignment: 'center', color: '#6b7280', fontSize: '0.75rem', padding: '20px 10px' }}>
                    No historical chats logged.
                  </div>
                )}
              </div>
            </div>

            {/* Chats Display Panel */}
            <div className="glass-card chat-main" style={{ padding: 0 }}>
              <div className="chat-messages">
                {chats.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', padding: '40px', gap: '20px' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '16px', borderRadius: '50%' }}>
                      <MessageSquare size={36} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <h4 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '4px' }}>IBM Granite Sustainability RAG</h4>
                      <p style={{ fontSize: '0.85rem', color: '#9ca3af', maxWidth: '380px' }}>
                        Ask granular circular economy or waste composting questions. Answers are structured dynamically using retrieval context databases.
                      </p>
                    </div>
                    
                    {/* Quick suggestion chips */}
                    <div style={{ width: '100%', maxWidth: '440px', marginTop: '12px' }}>
                      <div className="suggestions-grid">
                        <button className="suggestion-chip" onClick={(e) => handleSendMessage(e, 'How to compost fruit scraps?')}>
                          🍂 How to compost fruit scraps?
                        </button>
                        <button className="suggestion-chip" onClick={(e) => handleSendMessage(e, 'How are plastic resin codes recycled?')}>
                          ♻️ How to recycle plastic resin codes?
                        </button>
                        <button className="suggestion-chip" onClick={(e) => handleSendMessage(e, 'Can aluminum foil be recycled?')}>
                          🥫 Can aluminum foil be recycled?
                        </button>
                        <button className="suggestion-chip" onClick={(e) => handleSendMessage(e, 'Safe electronic e-waste options?')}>
                          🔌 Safe electronic e-waste options?
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  chats.map((chat, idx) => (
                    <div key={idx} className={`message-bubble ${chat.sender}`}>
                      <div className="message-text">
                        {chat.sender === 'assistant' ? (
                          // Parse markdown response paragraphs dynamically
                          chat.message.split('\n\n').map((para, pIdx) => {
                            if (para.startsWith('### ')) {
                              return <h3 key={pIdx} style={{ marginTop: pIdx > 0 ? '16px' : 0 }}>{para.replace('### ', '')}</h3>;
                            } else if (para.startsWith('#### ')) {
                              return <h4 key={pIdx} style={{ marginTop: pIdx > 0 ? '16px' : 0 }}>{para.replace('#### ', '')}</h4>;
                            } else if (para.startsWith('- ') || para.startsWith('* ')) {
                              return (
                                <ul key={pIdx}>
                                  {para.split('\n').map((li, lIdx) => (
                                    <li key={lIdx}>{li.replace(/^[\-\*]\s+/, '')}</li>
                                  ))}
                                </ul>
                              );
                            } else if (/^\d+\.\s+/.test(para)) {
                              return (
                                <ol key={pIdx}>
                                  {para.split('\n').map((li, lIdx) => (
                                    <li key={lIdx}>{li.replace(/^\d+\.\s+/, '')}</li>
                                  ))}
                                </ol>
                              );
                            } else if (para.startsWith('---')) {
                              return <hr key={pIdx} />;
                            }
                            return <p key={pIdx}>{para}</p>;
                          })
                        ) : (
                          <p>{chat.message}</p>
                        )}
                      </div>
                      <span className="message-info">
                        {chat.sender === 'user' ? 'You' : 'Granite RAG Engine'} • {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="message-bubble assistant">
                    <div className="message-text" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Loader2 className="animate-spin" size={16} style={{ color: '#10b981' }} />
                      <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Querying Sustainability Knowledge Base...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Field */}
              <div className="chat-input-area">
                <form className="chat-form" onSubmit={handleSendMessage}>
                  <input 
                    type="text" 
                    className="form-input chat-input" 
                    placeholder="Ask about resin codes, composting guidelines, SDG milestones..." 
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    disabled={chatLoading}
                  />
                  <button type="submit" className="btn btn-primary btn-icon" disabled={chatLoading}>
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 4: WASTE RECYCLING LOGS HISTORY */}
        {activeTab === 'history' && (
          <div className="glass-card-no-hover">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Circular Logs Audit</h3>
              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Showing {logs.length} logged items</span>
            </div>
            
            {logs.length > 0 ? (
              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Category</th>
                      <th>Model Confidence</th>
                      <th>Carbon Offset (CO₂)</th>
                      <th>Logging Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((record) => (
                      <tr key={record.id}>
                        <td>
                          {record.image_path ? (
                            <img 
                              src={`${BACKEND_URL}${record.image_path}`} 
                              alt={record.category} 
                              className="history-thumb" 
                              onError={(e) => {
                                // Simple fallback image if file is not found
                                e.target.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2310b981%22 stroke-width=%221%22><rect width=%2218%22 height=%2218%22 x=%223%22 y=%223%22 rx=%222%22/><path d=%22M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21%22/></svg>';
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: '1.5rem' }}>📦</span>
                          )}
                        </td>
                        <td>
                          <span className="result-tag" style={{ textTransform: 'capitalize' }}>
                            {record.category}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{record.confidence}%</span>
                        </td>
                        <td>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>+{record.carbon_saved?.toFixed(2)} kg</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af' }}>
                            <Calendar size={14} />
                            <span>
                              {new Date(record.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', color: '#6b7280', textAlign: 'center' }}>
                <Trash2 size={48} style={{ marginBottom: '16px' }} />
                <p style={{ fontWeight: 600, color: '#9ca3af' }}>Your waste archive is empty</p>
                <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>Head over to the "Waste Classifier" panel to upload and scan your first item.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Alerts Container */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <ShieldAlert size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
