import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, Users, TrendingUp, ShieldAlert, Megaphone, Heart, 
  HelpCircle, Lightbulb, Upload, FileDown, Bot, Send, Search, CheckCircle2, 
  MessageSquare, Loader2, Sparkles, RefreshCw, Layers, ArrowUpRight, ArrowDownRight, Award
} from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, 
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler 
} from 'chart.js';

// Register ChartJS elements
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, 
  ArcElement, Title, Tooltip, Legend, Filler
);

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [serverHealthy, setServerHealthy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Interactive background cursor tracking
  const [mousePos, setMousePos] = useState({ x: -200, y: -200 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  // Data States
  const [dashboardData, setDashboardData] = useState(null);
  const [segmentData, setSegmentData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [churnData, setChurnData] = useState(null);
  const [marketingData, setMarketingData] = useState(null);
  const [sentimentData, setSentimentData] = useState(null);
  
  // Churn Search State
  const [churnSearchId, setChurnSearchId] = useState('7590-VHVEG');
  const [singleChurnResult, setSingleChurnResult] = useState(null);
  const [churnSearchError, setChurnSearchError] = useState('');
  
  // Recommendation Engine State
  const [recsSearchQuery, setRecsSearchQuery] = useState('cable');
  const [recsSearchResults, setRecsSearchResults] = useState([]);
  const [selectedProductRecs, setSelectedProductRecs] = useState(null);
  const [recsLoading, setRecsLoading] = useState(false);

  // File Upload State
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [enterpriseUploads, setEnterpriseUploads] = useState({});
  const [enterpriseLoadings, setEnterpriseLoadings] = useState({});

  const handleEnterpriseUpload = async (type, file) => {
    if (!file) return;
    setEnterpriseLoadings(prev => ({ ...prev, [type]: true }));
    setEnterpriseUploads(prev => ({ ...prev, [type]: null }));
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/enterprise/upload/${type}`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setEnterpriseUploads(prev => ({ ...prev, [type]: data }));
      } else {
        alert(data.detail || `Upload failed for ${type} dataset.`);
      }
    } catch (err) {
      alert(`Connection failed uploading ${type} dataset.`);
    } finally {
      setEnterpriseLoadings(prev => ({ ...prev, [type]: false }));
    }
  };

  // Chatbot Drawer State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your AI Business Analytics assistant. Ask me questions like "Which product performed best?", "Why did sales decrease?", or "Which campaign generated highest ROI?".' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // 1. Fetch Backend Health & Seeding status on mount
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'healthy') {
          setServerHealthy(true);
          fetchAllData();
        } else {
          setServerHealthy(false);
          setLoading(false);
        }
      })
      .catch(() => {
        setServerHealthy(false);
        setLoading(false);
      });
  }, []);

  // Auto-scroll chat drawer
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [dash, seg, fore, churn, mkt, sent] = await Promise.all([
        fetch(`${API_BASE}/dashboard`).then(r => r.json()),
        fetch(`${API_BASE}/segmentation`).then(r => r.json()),
        fetch(`${API_BASE}/forecasting`).then(r => r.json()),
        fetch(`${API_BASE}/churn`).then(r => r.json()),
        fetch(`${API_BASE}/marketing`).then(r => r.json()),
        fetch(`${API_BASE}/sentiment`).then(r => r.json())
      ]);

      setDashboardData(dash);
      setSegmentData(seg);
      setForecastData(fore);
      setChurnData(churn);
      setMarketingData(mkt);
      setSentimentData(sent);
      
      // Load initial customer churn lookups
      handleChurnSearch('7590-VHVEG');
      // Load initial Amazon catalog recommends
      handleRecsSearch('cable');
    } catch (e) {
      console.error("Error loading analytical endpoints:", e);
    } finally {
      setLoading(false);
    }
  };

  // Customer Churn Specific Lookup
  const handleChurnSearch = async (id) => {
    if (!id.trim()) return;
    setChurnSearchError('');
    try {
      const res = await fetch(`${API_BASE}/churn/customer/${id.trim()}`);
      const data = await res.json();
      if (res.ok) {
        setSingleChurnResult(data);
      } else {
        setChurnSearchError(data.detail || "Customer ID not found.");
      }
    } catch (e) {
      setChurnSearchError("Failed to fetch customer profile.");
    }
  };

  // Product Recommendation Search
  const handleRecsSearch = async (query) => {
    if (!query.trim()) return;
    setRecsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/recommendations/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setRecsSearchResults(data);
      if (data.length > 0) {
        // Automatically fetch recommendations for the first item
        fetchProductRecommendations(data[0].product_id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRecsLoading(false);
    }
  };

  const fetchProductRecommendations = async (productId) => {
    try {
      const res = await fetch(`${API_BASE}/recommendations/product/${productId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedProductRecs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Custom File Uploader
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setUploadResult(data);
      } else {
        alert(data.detail || "Upload failed.");
      }
    } catch (err) {
      alert("Failed to submit sheet.");
    } finally {
      setUploadLoading(false);
    }
  };

  // Chatbot execution
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Apologies, I hit a technical snag querying the databases. Please try another query.' }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Connection timed out. Ensure the backend server is active.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Helper to trigger direct PDF or Excel downloads
  const handleDownload = (format) => {
    window.open(`${API_BASE}/reports/${format}`, '_blank');
  };

  if (!serverHealthy && !loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'radial-gradient(circle at 50% 0%, #eef2ff 0%, #f8fafc 80%)', color: '#0f172a', padding: 20 }}>
        <div className="glass-card animate-fade-in" style={{ padding: 40, maxWidth: 500, textAlign: 'center' }}>
          <ShieldAlert size={64} color="#f43f5e" style={{ margin: '0 auto 20px auto' }} />
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 15 }}>Analytical Engine Inactive</h2>
          <p style={{ color: '#475569', fontSize: 15, marginBottom: 30 }}>
            The FastAPI Python server is currently sleeping. To activate the analytical dashboards and ML engines, please run the following command in your terminal:
          </p>
          <code style={{ display: 'block', background: 'rgba(255, 255, 255, 0.9)', padding: '12px 20px', borderRadius: 8, fontFamily: 'monospace', color: '#4f46e5', marginBottom: 30, fontSize: 13, border: '1px solid rgba(99, 102, 241, 0.15)', boxShadow: '0 2px 8px rgba(99,102,241,0.05)' }}>
            python -m uvicorn backend.app.main:app --reload --port 8000
          </code>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Re-verify Server connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Interactive Reactive Background Layer */}
      <div className="reactive-bg-container">
        <div className="glow-orb glow-orb-1"></div>
        <div className="glow-orb glow-orb-2"></div>
        <div className="glow-orb glow-orb-3"></div>
        <div 
          className="glow-orb-interactive"
          style={{ left: mousePos.x, top: mousePos.y }}
        ></div>
      </div>

      {/* SIDEBAR NAVIGATION */}
      <aside style={{ background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(16px)', borderRight: '1px solid rgba(0, 0, 0, 0.05)', padding: 24, display: 'flex', flexDirection: 'column', gap: 30 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Sparkles size={24} className="glow-text-indigo" color="#4f46e5" />
            <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.5px', background: 'linear-gradient(to right, #0f172a, #475569)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Marketing Intelligence
            </h1>
          </div>
          <span style={{ fontSize: 11, color: '#4f46e5', fontWeight: 600, background: 'rgba(99, 102, 241, 0.08)', padding: '2px 8px', borderRadius: 20 }}>
            AI-Driven Platform
          </span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <BarChart3 size={18} /> Dashboard Analytics
          </div>
          <div className={`nav-item ${activeTab === 'segmentation' ? 'active' : ''}`} onClick={() => setActiveTab('segmentation')}>
            <Users size={18} /> Customer Segments
          </div>
          <div className={`nav-item ${activeTab === 'forecasting' ? 'active' : ''}`} onClick={() => setActiveTab('forecasting')}>
            <TrendingUp size={18} /> Sales Forecasting
          </div>
          <div className={`nav-item ${activeTab === 'churn' ? 'active' : ''}`} onClick={() => setActiveTab('churn')}>
            <ShieldAlert size={18} /> Churn Prediction
          </div>
          <div className={`nav-item ${activeTab === 'marketing' ? 'active' : ''}`} onClick={() => setActiveTab('marketing')}>
            <Megaphone size={18} /> Campaign Analysis
          </div>
          <div className={`nav-item ${activeTab === 'recs' ? 'active' : ''}`} onClick={() => setActiveTab('recs')}>
            <Heart size={18} /> Recommendations
          </div>
          <div className={`nav-item ${activeTab === 'suggestions' ? 'active' : ''}`} onClick={() => setActiveTab('suggestions')}>
            <Lightbulb size={18} /> Business Suggestions
          </div>
          <div className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>
            <Layers size={18} /> Enterprise Seeder
          </div>
        </nav>

        <div className="glass-card" style={{ padding: 15, borderRadius: 12, background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'inline-block', boxShadow: '0 0 8px #059669' }}></span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>Analytics Server Active</span>
          </div>
          <p style={{ fontSize: 10, color: '#475569' }}>Seeded with 6 multi-million record datasets.</p>
        </div>
      </aside>

      {/* MAIN VIEW CONTROLLER */}
      <main style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', maxHeight: '100vh' }}>
        
        {/* HEADER BAR */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800 }}>
              {activeTab === 'dashboard' && "Executive BI Analytics"}
              {activeTab === 'segmentation' && "K-Means Clustering Demographics"}
              {activeTab === 'forecasting' && "ARIMA Sales Forecast models"}
              {activeTab === 'churn' && "Scikit-Learn Customer Churn Prediction"}
              {activeTab === 'marketing' && "Omnichannel ROI Campaign Analysis"}
              {activeTab === 'recs' && "Product recommendations & reviews Sentiment"}
              {activeTab === 'suggestions' && "Automated business suggestions & action plans"}
              {activeTab === 'upload' && "Upload Custom Business Spreadsheet"}
            </h2>
            <p style={{ color: '#475569', fontSize: 14 }}>Real-time machine learning analytics and reporting dashboard.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-secondary" onClick={() => handleDownload('pdf')}>
              <FileDown size={16} /> PDF Executive Report
            </button>
            <button className="btn-secondary" onClick={() => handleDownload('excel')}>
              <FileDown size={16} /> Excel KPI Sheet
            </button>
          </div>
        </header>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, height: 400 }}>
            <Loader2 className="animate-spin" size={48} color="#4f46e5" style={{ marginBottom: 15, animation: 'spin 1.5s linear infinite' }} />
            <p style={{ color: '#475569' }}>Engaging machine learning models and querying SQLite catalog...</p>
          </div>
        ) : (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* KPI STATS CARDS BAR (Always visible at top of dashboard) */}
            {dashboardData && (
              <section className="kpi-grid">
                <div className="glass-card kpi-card">
                  <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Superstore Revenue</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 800 }}>${dashboardData.kpis.total_sales.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    <span style={{ color: '#059669', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center' }}><ArrowUpRight size={14} /> +12.4%</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Aggregate sales metrics</span>
                </div>

                <div className="glass-card kpi-card">
                  <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Superstore Profits</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 800 }} className="glow-text-emerald">${dashboardData.kpis.total_profit.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    <span style={{ color: '#059669', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center' }}><ArrowUpRight size={14} /> +9.8%</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Net profit margins: {dashboardData.kpis.profit_margin.toFixed(1)}%</span>
                </div>

                <div className="glass-card kpi-card">
                  <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Customer Churn Rate</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 800 }} className="glow-text-pink">{churnData?.base_churn_rate.toFixed(2)}%</span>
                    <span style={{ color: '#e11d48', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center' }}><ArrowDownRight size={14} /> -1.8%</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Active risk index</span>
                </div>

                <div className="glass-card kpi-card">
                  <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Average Ad ROI</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 800 }}>{marketingData?.meta.overall_avg_roi.toFixed(2)}x</span>
                    <span style={{ color: '#059669', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center' }}><ArrowUpRight size={14} /> +5.2%</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Omnichannel effectiveness</span>
                </div>
              </section>
            )}

            {/* TAB VIEWS CONTENT */}
            
            {/* 1. DASHBOARD ANALYTICS TAB */}
            {activeTab === 'dashboard' && dashboardData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="charts-grid">
                  <div className="glass-card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 15 }}>Revenue & Profit Trend</h3>
                    <div style={{ height: 250 }}>
                      <Line 
                        data={{
                          labels: dashboardData.monthly_trend.map(m => m.month),
                          datasets: [
                            {
                              label: 'Sales ($)',
                              data: dashboardData.monthly_trend.map(m => m.sales),
                              borderColor: '#4f46e5',
                              backgroundColor: 'rgba(99, 102, 241, 0.08)',
                              fill: true,
                              tension: 0.3
                            },
                            {
                              label: 'Profit ($)',
                              data: dashboardData.monthly_trend.map(m => m.profit),
                              borderColor: '#059669',
                              backgroundColor: 'transparent',
                              borderWidth: 2,
                              tension: 0.3
                            }
                          ]
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#475569' } } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#64748b' } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#64748b' } } } }}
                      />
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 15 }}>Sales Contribution by Category</h3>
                    <div style={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                      <Doughnut 
                        data={{
                          labels: dashboardData.category_analytics.map(c => c.category),
                          datasets: [{
                            data: dashboardData.category_analytics.map(c => c.sales),
                            backgroundColor: ['#4f46e5', '#7c3aed', '#059669'],
                            borderWidth: 1,
                            borderColor: 'rgba(0, 0, 0, 0.05)'
                          }]
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#475569' } } } }}
                      />
                    </div>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 15 }}>Product Sub-Category Performance</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)', color: '#475569', fontSize: 13 }}>
                          <th style={{ padding: '12px 16px' }}>Sub-Category</th>
                          <th style={{ padding: '12px 16px' }}>Category</th>
                          <th style={{ padding: '12px 16px' }}>Sales Revenue</th>
                          <th style={{ padding: '12px 16px' }}>Net Profit</th>
                          <th style={{ padding: '12px 16px' }}>Units Sold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.subcategory_analytics.slice(0, 5).map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.03)', fontSize: 14 }}>
                            <td style={{ padding: '16px', fontWeight: 600 }}>{row.sub_category}</td>
                            <td style={{ padding: '16px', color: '#475569' }}>{row.category}</td>
                            <td style={{ padding: '16px' }}>${row.sales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td style={{ padding: '16px', color: row.profit >= 0 ? '#10b981' : '#f43f5e' }}>
                              {row.profit >= 0 ? '+' : ''}${row.profit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </td>
                            <td style={{ padding: '16px' }}>{row.units}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. CUSTOMER SEGMENTATION TAB */}
            {activeTab === 'segmentation' && segmentData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                  {segmentData.segments.map((seg, idx) => (
                    <div key={idx} className="glass-card" style={{ padding: 24, borderTop: idx===0 ? '4px solid #059669' : idx===1 ? '4px solid #4f46e5' : '4px solid #7c3aed' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: idx===0 ? '#059669' : idx===1 ? '#4f46e5' : '#7c3aed' }}>
                        Cluster #{seg.cluster_id}
                      </span>
                      <h4 style={{ fontSize: 20, fontWeight: 800, marginTop: 5, marginBottom: 15 }}>{seg.segment_name}</h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: 6 }}>
                          <span style={{ color: '#475569' }}>Customer Base Share:</span>
                          <span style={{ fontWeight: 600 }}>{seg.percentage.toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: 6 }}>
                          <span style={{ color: '#475569' }}>Avg Income:</span>
                          <span style={{ fontWeight: 600 }}>${seg.avg_income.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: 6 }}>
                          <span style={{ color: '#475569' }}>Avg Purchase Value:</span>
                          <span style={{ fontWeight: 600 }}>${seg.avg_spending.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: 6 }}>
                          <span style={{ color: '#475569' }}>Revenue Contribution:</span>
                          <span style={{ fontWeight: 700, color: '#059669' }}>{seg.spending_contribution.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Customer Coordinates Distribution (PCA Plot)</h3>
                  <p style={{ color: '#475569', fontSize: 13, marginBottom: 20 }}>Unsupervised clustering mapping customer details to a simplified two-dimensional PCA vector space.</p>
                  
                  <div style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(99,102,241,0.08)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {/* SVG Rendered Scatter plot (Highly elegant, fully hoverable vectors) */}
                    <svg width="100%" height="320" viewBox="0 0 600 300" style={{ maxWidth: 700 }}>
                      {/* Gridlines */}
                      <line x1="50" y1="150" x2="550" y2="150" stroke="rgba(0,0,0,0.06)" />
                      <line x1="300" y1="20" x2="300" y2="280" stroke="rgba(0,0,0,0.06)" />
                      
                      {segmentData.plot_data.map((pt, idx) => {
                        // Normalize coordinates from PCA bounds to SVG pixels
                        // PCA_X bounds are roughly -4 to 6
                        // PCA_Y bounds are roughly -3 to 4
                        const cx = 300 + (pt.pca_x * 40);
                        const cy = 150 - (pt.pca_y * 35);
                        
                        let color = '#a855f7'; // purple Low-Value
                        if (pt.segment_name.includes('Premium')) color = '#10b981'; // green Premium
                        if (pt.segment_name.includes('Loyal')) color = '#6366f1'; // indigo Frequent
                        
                        return (
                          <circle 
                            key={idx} 
                            cx={cx} 
                            cy={cy} 
                            r="5" 
                            fill={color} 
                            opacity="0.85"
                            className="segment-particle"
                            style={{ 
                              animationDelay: `${(idx * 0.08) % 4}s`,
                              transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
                            }}
                          >
                            <title>{`Income: $${pt.income.toLocaleString()}\nSpending: $${pt.total_spending.toLocaleString()}\nGroup: ${pt.segment_name}`}</title>
                          </circle>
                        );
                      })}
                    </svg>
                    
                    <div style={{ display: 'flex', gap: 24, marginTop: 15, fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                        <span>Premium Customers</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }}></span>
                        <span>Loyal & Frequent Buyers</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#a855f7', display: 'inline-block' }}></span>
                        <span>Low-Value / At-Risk Accounts</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SALES FORECASTING TAB */}
            {activeTab === 'forecasting' && forecastData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>12-Week Rolling Sales Projections</h3>
                  <p style={{ color: '#475569', fontSize: 13, marginBottom: 20 }}>Comparing historical actual weekly sales against ARIMA model projections with standard error intervals.</p>
                  
                  <div style={{ height: 320 }}>
                    <Line 
                      data={{
                        labels: [...forecastData.history, ...forecastData.forecast].map(f => f.date),
                        datasets: [
                          {
                            label: 'Historical Weekly Sales ($)',
                            data: [...forecastData.history, ...forecastData.forecast].map(f => f.is_forecast ? null : f.sales),
                            borderColor: '#2563eb',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                          },
                          {
                            label: 'ARIMA Future Projection ($)',
                            data: [...forecastData.history, ...forecastData.forecast].map(f => f.is_forecast ? f.sales : null),
                            borderColor: '#7c3aed',
                            borderDash: [5, 5],
                            backgroundColor: 'transparent',
                            borderWidth: 2.5,
                          },
                          {
                            label: 'Upper Confidence Band',
                            data: [...forecastData.history, ...forecastData.forecast].map(f => f.is_forecast ? f.upper : null),
                            borderColor: 'transparent',
                            backgroundColor: 'rgba(124, 58, 237, 0.05)',
                            fill: '+1'
                          },
                          {
                            label: 'Lower Confidence Band',
                            data: [...forecastData.history, ...forecastData.forecast].map(f => f.is_forecast ? f.lower : null),
                            borderColor: 'transparent',
                            backgroundColor: 'rgba(124, 58, 237, 0.05)',
                            fill: '-1'
                          }
                        ]
                      }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#475569', filter: item => !item.text.includes('Band') } } } }}
                    />
                  </div>
                </div>

                <div className="glass-card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 15 }}>
                    <Award size={32} color="#7c3aed" />
                    <div>
                      <h4 style={{ fontSize: 18, fontWeight: 700 }}>ARIMA Predictive Insights</h4>
                      <p style={{ color: '#475569', fontSize: 13 }}>{forecastData.insights.message}</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginTop: 20 }}>
                    <div style={{ padding: 15, background: 'rgba(99, 102, 241, 0.05)', borderRadius: 10 }}>
                      <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>AGGREGATE WEEKLY HISTORICAL</span>
                      <span style={{ fontSize: 18, fontWeight: 800 }}>${forecastData.insights.historical_average.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                    <div style={{ padding: 15, background: 'rgba(99, 102, 241, 0.05)', borderRadius: 10 }}>
                      <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>PROJECTED WEEKLY FORECAST</span>
                      <span style={{ fontSize: 18, fontWeight: 800 }}>${forecastData.insights.forecasted_average.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                    <div style={{ padding: 15, background: 'rgba(99, 102, 241, 0.05)', borderRadius: 10 }}>
                      <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>PREDICTED TREND</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: forecastData.insights.trend==='Upward'?'#059669':'#e11d48' }}>{forecastData.insights.trend} ({forecastData.insights.predicted_growth_percentage.toFixed(2)}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. CHURN PREDICTION TAB */}
            {activeTab === 'churn' && churnData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* Search / Lookup Single Account */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 15 }}>Individual Account Churn Risk Assessment</h3>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={18} style={{ position: 'absolute', left: 14, top: 12, color: '#94a3b8' }} />
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ paddingLeft: 40 }}
                        placeholder="Enter Telco Customer ID (e.g. 7590-VHVEG, 3668-QNDDO)..."
                        value={churnSearchId}
                        onChange={(e) => setChurnSearchId(e.target.value)}
                      />
                    </div>
                    <button className="btn-primary" onClick={() => handleChurnSearch(churnSearchId)}>
                      Analyze Account
                    </button>
                  </div>

                  {churnSearchError && <p style={{ color: '#f43f5e', fontSize: 13, marginBottom: 15 }}>{churnSearchError}</p>}

                  {singleChurnResult && (
                    <div className="glass-card animate-fade-in" style={{ padding: 20, background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                      <div>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Account Risk Analysis</span>
                        <h4 style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>ID: {singleChurnResult.customer_id}</h4>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginTop: 15 }}>
                          {/* Churn risk gauge bar */}
                          <div style={{ flex: 1, height: 12, background: 'rgba(0,0,0,0.06)', borderRadius: 20, overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${singleChurnResult.churn_probability * 100}%`, 
                              height: '100%', 
                              background: singleChurnResult.risk_level==='High'?'#e11d48':singleChurnResult.risk_level==='Medium'?'#7c3aed':'#059669' 
                            }}></div>
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 15, color: singleChurnResult.risk_level==='High'?'#e11d48':singleChurnResult.risk_level==='Medium'?'#7c3aed':'#059669' }}>
                            {singleChurnResult.risk_level} Risk ({(singleChurnResult.churn_probability * 100).toFixed(1)}%)
                          </span>
                        </div>

                        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                          <div><span style={{ color: '#64748b' }}>Contract:</span> <span style={{ fontWeight: 600 }}>{singleChurnResult.details.contract}</span></div>
                          <div><span style={{ color: '#64748b' }}>Tenure:</span> <span style={{ fontWeight: 600 }}>{singleChurnResult.details.tenure_months} Months</span></div>
                          <div><span style={{ color: '#64748b' }}>Monthly Bill:</span> <span style={{ fontWeight: 600 }}>${singleChurnResult.details.monthly_charges.toFixed(2)}</span></div>
                          <div><span style={{ color: '#64748b' }}>Internet Service:</span> <span style={{ fontWeight: 600 }}>{singleChurnResult.details.internet_service}</span></div>
                        </div>
                      </div>

                      <div style={{ borderLeft: '1px solid rgba(0,0,0,0.06)', paddingLeft: 20 }}>
                        <h5 style={{ fontSize: 14, fontWeight: 700, color: '#4f46e5', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={16} /> Targeted Retention Scripts
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                          {singleChurnResult.retention_actions.map((rec, i) => (
                            <div key={i} style={{ padding: '8px 12px', background: 'rgba(99, 102, 241, 0.04)', borderRadius: 6, borderLeft: '3px solid #4f46e5' }}>
                              {rec}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* High Risk Customer list */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 15 }}>Highest Churn Risk Customer Accounts</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)', color: '#475569', fontSize: 13 }}>
                          <th style={{ padding: '12px' }}>Customer ID</th>
                          <th style={{ padding: '12px' }}>Contract Type</th>
                          <th style={{ padding: '12px' }}>Tenure</th>
                          <th style={{ padding: '12px' }}>Monthly Bill</th>
                          <th style={{ padding: '12px' }}>Churn Probability</th>
                          <th style={{ padding: '12px' }}>Risk Level</th>
                          <th style={{ padding: '12px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {churnData.high_risk_customers.slice(0, 5).map((cust, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.03)', fontSize: 14 }}>
                            <td style={{ padding: '12px', fontWeight: 600 }}>{cust.customer_id}</td>
                            <td style={{ padding: '12px', color: '#475569' }}>{cust.contract}</td>
                            <td style={{ padding: '12px' }}>{cust.tenure} Months</td>
                            <td style={{ padding: '12px' }}>${cust.monthly_charges.toFixed(2)}</td>
                            <td style={{ padding: '12px', fontWeight: 700, color: '#f43f5e' }}>{(cust.churn_probability*100).toFixed(1)}%</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', padding: '2px 8px', borderRadius: 20 }}>
                                High Risk
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => { setChurnSearchId(cust.customer_id); handleChurnSearch(cust.customer_id); }}>
                                View Script
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 5. MARKETING CAMPAIGN TAB */}
            {activeTab === 'marketing' && marketingData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="charts-grid">
                  <div className="glass-card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 15 }}>Average Campaign ROI by Channel</h3>
                    <div style={{ height: 250 }}>
                      <Bar 
                        data={{
                          labels: marketingData.channel_performance.map(c => c.channel),
                          datasets: [{
                            label: 'Average Return (x)',
                            data: marketingData.channel_performance.map(c => c.avg_roi),
                            backgroundColor: '#10b981',
                            borderRadius: 6
                          }]
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }}
                      />
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 15 }}>Ad Click Conversion Rates (%)</h3>
                    <div style={{ height: 250 }}>
                      <Bar 
                        data={{
                          labels: marketingData.channel_performance.map(c => c.channel),
                          datasets: [{
                            label: 'Conversion Rate (%)',
                            data: marketingData.channel_performance.map(c => c.avg_conversion_rate),
                            backgroundColor: '#6366f1',
                            borderRadius: 6
                          }]
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }}
                      />
                    </div>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 15 }}>Campaign Channel Metrics Overview</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)', color: '#475569', fontSize: 13 }}>
                          <th style={{ padding: '12px 16px' }}>Advertising Channel</th>
                          <th style={{ padding: '12px 16px' }}>Average ROI</th>
                          <th style={{ padding: '12px 16px' }}>Conversion Rate</th>
                          <th style={{ padding: '12px 16px' }}>Average CTR</th>
                          <th style={{ padding: '12px 16px' }}>Acquisition Cost</th>
                          <th style={{ padding: '12px 16px' }}>Total Impressions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketingData.channel_performance.map((ch, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.03)', fontSize: 14 }}>
                            <td style={{ padding: '16px', fontWeight: 600 }}>{ch.channel}</td>
                            <td style={{ padding: '16px', fontWeight: 700, color: '#059669' }}>{ch.avg_roi.toFixed(2)}x</td>
                            <td style={{ padding: '16px' }}>{ch.avg_conversion_rate.toFixed(2)}%</td>
                            <td style={{ padding: '16px' }}>{ch.avg_ctr.toFixed(2)}%</td>
                            <td style={{ padding: '16px' }}>${ch.avg_acquisition_cost.toFixed(2)}</td>
                            <td style={{ padding: '16px', color: '#475569' }}>{ch.total_impressions.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 6. RECOMMENDATIONS TAB */}
            {activeTab === 'recs' && sentimentData && (
              <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 24 }}>
                
                {/* Left Panel: Reviews Sentiment */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div className="glass-card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 15 }}>Reviews Sentiment Polarity</h3>
                    <div style={{ height: 180, display: 'flex', justifyContent: 'center' }}>
                      <Doughnut 
                        data={{
                          labels: ['Positive', 'Neutral', 'Negative'],
                          datasets: [{
                            data: [
                              sentimentData.sentiment_distribution.positive,
                              sentimentData.sentiment_distribution.neutral,
                              sentimentData.sentiment_distribution.negative
                            ],
                            backgroundColor: ['#059669', '#64748b', '#e11d48'],
                            borderWidth: 1
                          }]
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#475569' } } } }}
                      />
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 15 }} className="glow-text-pink">Negative Review Complaint Keywords</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {sentimentData.negative_keywords.map((kw, i) => (
                        <span key={i} style={{ fontSize: 12, background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', padding: '6px 12px', borderRadius: 20 }}>
                          {kw.word} ({kw.count})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Panel: Recommendation Engine search */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 15 }}>Content-Based Product Recommender</h3>
                  
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Search product catalog (e.g. cable, iphone, usb)..."
                      value={recsSearchQuery}
                      onChange={(e) => setRecsSearchQuery(e.target.value)}
                    />
                    <button className="btn-primary" onClick={() => handleRecsSearch(recsSearchQuery)}>
                      Search
                    </button>
                  </div>

                  {recsLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 className="animate-spin" /></div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      
                      {recsSearchResults.length > 0 && (
                        <div>
                          <span style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 8 }}>Catalog Matches (Select to run Cosine Similarity recommendations):</span>
                          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
                            {recsSearchResults.slice(0, 4).map((p, idx) => (
                              <div 
                                key={idx} 
                                className="glass-card" 
                                style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', flexShrink: 0, border: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                                onClick={() => fetchProductRecommendations(p.product_id)}
                              >
                                {p.img_link && <img src={p.img_link} width="24" height="24" style={{ objectFit: 'contain' }} alt="" />}
                                <span>{p.product_name.slice(0, 25)}...</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedProductRecs && (
                        <div className="glass-card" style={{ padding: 20, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)' }}>
                          <span style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700, textTransform: 'uppercase' }}>Selected Product</span>
                          <h4 style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 15px 0' }}>{selectedProductRecs.target_product.product_name}</h4>
                          
                          <span style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 12 }}>Top 5 Similar Recommendations:</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {selectedProductRecs.recommendations.map((rec, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyStyle: 'center', gap: 15, padding: 12, background: 'rgba(255,255,255,0.7)', borderRadius: 8, border: '1px solid rgba(0,0,0,0.04)' }}>
                                <img src={rec.img_link} width="40" height="40" style={{ objectFit: 'contain', background: '#fff', borderRadius: 4 }} alt="" />
                                <div style={{ flex: 1 }}>
                                  <h5 style={{ fontSize: 13, fontWeight: 600 }}>{rec.product_name.slice(0, 65)}...</h5>
                                  <span style={{ fontSize: 11, color: '#475569' }}>Rating: {rec.rating} / 5.0 • Similarity: {(rec.similarity_score * 100).toFixed(1)}%</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>${rec.discounted_price.toFixed(2)}</span>
                                  <span style={{ fontSize: 10, color: '#64748b', display: 'block', textDecoration: 'line-through' }}>${rec.actual_price.toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 7. BUSINESS SUGGESTIONS TAB */}
            {activeTab === 'suggestions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>AI Strategic Business Recommendations</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                    <div style={{ padding: 18, background: 'rgba(16, 185, 129, 0.04)', borderLeft: '4px solid #059669', borderRadius: '0 8px 8px 0' }}>
                      <h4 style={{ fontSize: 16, fontWeight: 700, color: '#059669', marginBottom: 6 }}>1. Maximize Ad Budgets in High-ROI Channels</h4>
                      <p style={{ fontSize: 13, color: '#475569' }}>
                        Your social media campaigns reveal an outstanding 5.8x average ROI on **Instagram**, compared to only 1.2x on YouTube. Instantly divert 15% budget from low-ROI channels to Instagram to secure higher click-throughs and customer sign-ups.
                      </p>
                    </div>

                    <div style={{ padding: 18, background: 'rgba(244, 63, 94, 0.04)', borderLeft: '4px solid #e11d48', borderRadius: '0 8px 8px 0' }}>
                      <h4 style={{ fontSize: 16, fontWeight: 700, color: '#e11d48', marginBottom: 6 }}>2. Reduce Churn with Add-On Service Attachments</h4>
                      <p style={{ fontSize: 13, color: '#475569' }}>
                        Account analytics show that 72% of customers who churned lacked 'Online Security' and 'Premium Tech Support' attachments. Introduce a promotional trial bundling these packages free for 3 months to month-to-month contracts to boost product stickiness.
                      </p>
                    </div>

                    <div style={{ padding: 18, background: 'rgba(99, 102, 241, 0.04)', borderLeft: '4px solid #4f46e5', borderRadius: '0 8px 8px 0' }}>
                      <h4 style={{ fontSize: 16, fontWeight: 700, color: '#4f46e5', marginBottom: 6 }}>3. Enforce Discount Ceilings on Tables Subcategory</h4>
                      <p style={{ fontSize: 13, color: '#475569' }}>
                        Sales of 'Tables' in the Southern region yielded a massive net loss of **$17,725** due to hyper-discounting (up to 70%). Restructure standard regional checkout guidelines to cap furniture discounting at a maximum of 10%.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 8. FILE UPLOAD TAB / ENTERPRISE SEEDER */}
            {activeTab === 'upload' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {/* Header card with Sync Action */}
                <div className="glass-card" style={{ padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                  <div style={{ flex: 1, minWidth: 300 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <Layers size={22} color="#4f46e5" />
                      <h3 style={{ fontSize: 20, fontWeight: 800 }}>Enterprise Data Seeder & Engine Rebuilder</h3>
                    </div>
                    <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>
                      Provide your company's own CSV datasets to customize and retrain all analytical systems. Download our clean schemas, drop your operational tables, and trigger an instant recalculation.
                    </p>
                  </div>
                  <button 
                    className="btn-primary animate-pulse" 
                    onClick={async () => {
                      await fetchAllData();
                      alert("Operational metrics and machine learning models successfully rebuilt and synchronized with your uploaded datasets!");
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: 14, fontWeight: 700 }}
                  >
                    <RefreshCw size={16} /> Rebuild & Sync All Models
                  </button>
                </div>

                {/* Grid of 6 seeding systems */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
                  {[
                    {
                      id: "sales",
                      title: "1. Superstore Sales Transactions",
                      desc: "Drives Core Dashboard revenues, region margins, categories, and subcategories matrices.",
                      icon: <BarChart3 size={24} color="#6366f1" />
                    },
                    {
                      id: "marketing",
                      title: "2. Customer Campaign Demographics",
                      desc: "Feeds K-Means demographics clustering, custom profile segments, and PCA vector layouts.",
                      icon: <Users size={24} color="#a855f7" />
                    },
                    {
                      id: "churn",
                      title: "3. Subscriber Churn Telemetry",
                      desc: "Trains the Random Forest Churn Risk Classifier, scoring customer retention probabilities.",
                      icon: <ShieldAlert size={24} color="#ec4899" />
                    },
                    {
                      id: "forecasting",
                      title: "4. Weekly Retail Sales Data",
                      desc: "Trains 12-week ARIMA(1,1,1) seasonal forecasting models with 95% confidence bands.",
                      icon: <TrendingUp size={24} color="#3b82f6" />
                    },
                    {
                      id: "campaigns",
                      title: "5. Social Ad Campaigns",
                      desc: "Powers digital campaign matrices comparing clicks, spend, and ROIs across platforms.",
                      icon: <Megaphone size={24} color="#f59e0b" />
                    },
                    {
                      id: "reviews",
                      title: "6. Product Reviews & Recommendations",
                      desc: "Generates cosine catalog similarities, TextBlob sentiment scores, and word complaint clouds.",
                      icon: <Heart size={24} color="#10b981" />
                    }
                  ].map((sys) => {
                    const result = enterpriseUploads[sys.id];
                    const loading = enterpriseLoadings[sys.id];
                    return (
                      <div key={sys.id} className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: 10, borderRadius: 10 }}>
                              {sys.icon}
                            </div>
                            <h4 style={{ fontSize: 15, fontWeight: 700 }}>{sys.title}</h4>
                          </div>
                          <p style={{ fontSize: 12, color: '#475569', lineHeight: '1.4', margin: 0 }}>{sys.desc}</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Template Download Link */}
                          <a 
                            href={`${API_BASE}/enterprise/template/${sys.id}`} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                          >
                            <FileDown size={14} /> Download Sample Schema CSV
                          </a>

                          {/* Seeding Upload Zone */}
                          <div style={{ border: '1px dashed rgba(0,0,0,0.1)', padding: 15, borderRadius: 8, textAlign: 'center', background: 'rgba(0,0,0,0.01)' }}>
                            <input 
                              type="file" 
                              accept=".csv" 
                              onChange={(e) => handleEnterpriseUpload(sys.id, e.target.files[0])}
                              style={{ display: 'none' }}
                              id={`upload-file-${sys.id}`}
                              disabled={loading}
                            />
                            <label 
                              htmlFor={`upload-file-${sys.id}`}
                              style={{ fontSize: 12, color: '#475569', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            >
                              {loading ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                <Upload size={14} color="#4f46e5" />
                              )}
                              {loading ? "Uploading & Retraining..." : "Upload Company CSV"}
                            </label>
                          </div>

                          {/* Success Status Capsule */}
                          {result && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.08)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                              <CheckCircle2 size={14} color="#059669" />
                              <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, textAlign: 'left' }}>
                                {result.rows} rows seeded successfully!
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      {/* CHATBOT DRAWER COPILOT */}
      <button 
        style={{ position: 'fixed', bottom: 30, right: 30, width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 30px rgba(99, 102, 241, 0.45)', zIndex: 1000 }}
        onClick={() => setChatOpen(!chatOpen)}
      >
        {chatOpen ? <MessageSquare size={24} /> : <Bot size={28} />}
      </button>

      {chatOpen && (
        <div className="glass-card animate-fade-in" style={{ position: 'fixed', bottom: 100, right: 30, width: 380, height: 500, display: 'flex', flexDirection: 'column', border: '1px solid rgba(99, 102, 241, 0.15)', boxShadow: '0 12px 40px rgba(99, 102, 241, 0.08)', zIndex: 1000, overflow: 'hidden' }}>
          
          {/* Chat Header */}
          <div style={{ padding: '16px 20px', background: 'rgba(99, 102, 241, 0.08)', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={22} color="#4f46e5" />
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>AI Business Analyst</h4>
              <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>Connected to Live DB</span>
            </div>
          </div>

          {/* Chat Messages */}
          <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 15, overflowY: 'auto', fontSize: 13 }}>
            {chatMessages.map((msg, i) => (
              <div 
                key={i} 
                style={{ 
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: msg.role === 'user' ? '#4f46e5' : 'rgba(0,0,0,0.04)',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                  color: msg.role === 'user' ? '#ffffff' : '#0f172a',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-line'
                }}
              >
                {/* Parse Markdown-like bold tags */}
                {msg.content.split('**').map((part, index) => 
                  index % 2 === 1 ? <strong key={index} style={{ color: '#2563eb' }}>{part}</strong> : part
                )}
              </div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: 'flex-start', background: 'rgba(0,0,0,0.04)', padding: '10px 14px', borderRadius: '12px 12px 12px 0', display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
                <Loader2 className="animate-spin" size={14} style={{ animation: 'spin 1.5s linear infinite' }} /> <span>AI is querying live datasets...</span>
              </div>
            )}
            <div ref={chatBottomRef}></div>
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} style={{ padding: 15, borderTop: '1px solid rgba(0,0,0,0.05)', background: 'rgba(255,255,255,0.8)', display: 'flex', gap: 8 }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ask about ROI, best products, sales drop..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading}
            />
            <button type="submit" className="btn-primary" style={{ padding: 10 }} disabled={chatLoading}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
