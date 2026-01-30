import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid, Sector 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, PieChart as PieIcon, BarChart3, List, TrendingUp, ShoppingBag, Hash, Calendar, ShieldCheck, AlertTriangle } from 'lucide-react';

// --- CONFIGURATION ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// --- HELPER FUNCTIONS ---
const getDynamicColor = (index, total) => {
  const h = (index * (360 / Math.max(total, 1))) % 360;
  return `hsl(${h}, 70%, 60%)`;
};

// --- COMPONENTS ---
const StatCard = ({ icon: Icon, label, value, color }) => (
  <motion.div whileHover={{ y: -5 }} style={statCardStyle}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
      <div>
        <p style={statLabel}>{label}</p>
        <h2 style={statValue}>{value}</h2>
      </div>
      <div style={{ padding: '0.5rem', backgroundColor: `${color}22`, borderRadius: '8px' }}>
        <Icon size={24} color={color} />
      </div>
    </div>
  </motion.div>
);

// Gauge Component for Commander View
const BudgetGauge = ({ limit, spent, left, isWarning }) => {
  // Data for the half-pie chart
  const gaugeData = [
    { name: 'Spent', value: Math.min(spent, limit), color: isWarning ? '#ef4444' : '#3b82f6' },
    { name: 'Left', value: Math.max(0, left), color: '#334155' }
  ];
  
  // If overspent, make it full red
  if (left < 0) {
    gaugeData[0] = { name: 'Overspent', value: 1, color: '#ef4444' };
    gaugeData[1] = { name: 'Left', value: 0, color: '#334155' };
  }

  return (
    <div style={{ position: 'relative', height: '250px', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={gaugeData}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={100}
            outerRadius={140}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {gaugeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center Text Overlay */}
      <div style={{ position: 'absolute', bottom: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase' }}>Available Today</div>
        <div style={{ fontSize: '3.5rem', fontWeight: '800', color: left < 0 ? '#ef4444' : '#10b981' }}>
          ${left.toFixed(2)}
        </div>
        <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
          Spent: <b>${spent.toFixed(2)}</b> / ${limit.toFixed(2)}
        </div>
      </div>
    </div>
  );
};

function App() {
  const [data, setData] = useState([]);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [timeFilter, setTimeFilter] = useState('all');
  const [mode, setMode] = useState('TRACKER'); // 'TRACKER' or 'COMMANDER'
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.toLocaleString('default', { month: 'long' })}_${now.getFullYear()}`;
  });

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dataRes, monthsRes, statusRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/data?month=${currentMonth}`),
          axios.get(`${API_BASE_URL}/api/months`),
          axios.get(`${API_BASE_URL}/api/status`)
        ]);

        setData(dataRes.data.data || []);
        setAvailableMonths(monthsRes.data || []);
        setBudget(statusRes.data);

        // Auto-switch to Commander if active and first load
        if (statusRes.data.active) {
            // Optional: You can setMode('COMMANDER') here if you want it default
        } else {
            setMode('TRACKER');
        }

      } catch (err) {
        console.error("Error fetching data:", err);
      }
      setLoading(false);
    };
    fetchData();
  }, [currentMonth]);

  // --- FILTER LOGIC (For Tracker View) ---
  const filteredRows = useMemo(() => {
    const now = new Date();
    return data.filter(row => {
      const rowDate = new Date(row.date);
      if (isNaN(rowDate)) return true;

      switch(timeFilter) {
        case 'daily':
          // Fix timezone parsing issue by comparing locale strings
          return rowDate.toLocaleDateString() === now.toLocaleDateString();
        case 'weekly':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0,0,0,0);
          return rowDate >= startOfWeek;
        default: 
          return true;
      }
    });
  }, [data, timeFilter]);

  // --- DYNAMIC STATS (For Tracker View) ---
  const { categoryData, topCategory, filteredTotal } = useMemo(() => {
    const total = filteredRows.reduce((sum, r) => sum + r.amount, 0);

    const totals = filteredRows.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});
    
    const catArray = Object.keys(totals).map((key) => ({
      name: key,
      value: totals[key]
    }));

    const top = catArray.length > 0 
      ? [...catArray].sort((a, b) => b.value - a.value)[0].name 
      : 'N/A';

    return { categoryData: catArray, topCategory: top, filteredTotal: total };
  }, [filteredRows]);

  if (loading) return <div style={loaderStyle}>⚡ Syncing FinancePulse...</div>;

  return (
    <div style={containerStyle}>
      <div style={innerWrapper}>
        
        {/* HEADER & CONTROLS */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={headerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <Wallet size={40} color="#38bdf8" />
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, lineHeight: 1 }}>FinancePulse</h1>
                {budget?.active && <span style={{fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold'}}>● BUDGET ACTIVE</span>}
              </div>
            </div>

            {/* Controls Right Side */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              
              {/* MODE TOGGLE */}
              {budget?.active && (
                <div style={toggleContainerStyle}>
                  <button 
                    style={mode === 'TRACKER' ? activeToggleStyle : toggleStyle}
                    onClick={() => setMode('TRACKER')}
                  >
                    Tracker
                  </button>
                  <button 
                    style={mode === 'COMMANDER' ? activeToggleStyle : toggleStyle}
                    onClick={() => setMode('COMMANDER')}
                  >
                    Budget tracker
                  </button>
                </div>
              )}

              {/* MONTH SELECTOR */}
              <div style={dropdownWrapperStyle}>
                <Calendar size={18} color="#94a3b8" />
                <select 
                  value={currentMonth} 
                  onChange={(e) => setCurrentMonth(e.target.value)}
                  style={selectStyle}
                >
                  {!availableMonths.includes(currentMonth) && <option value={currentMonth}>{currentMonth.replace('_', ' ')}</option>}
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </motion.header>

        {/* =====================================================================================
            VIEW 1: TRACKER MODE (Charts & Graphs) 
           ===================================================================================== */}
        {mode === 'TRACKER' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* TIME FILTERS */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
              {['daily', 'weekly', 'all'].map(f => (
                <button 
                  key={f}
                  onClick={() => setTimeFilter(f)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: timeFilter === f ? '#38bdf8' : '#1e293b',
                    color: '#fff',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    fontWeight: 'bold',
                    transition: '0.2s',
                    fontSize: '0.9rem'
                  }}
                >
                  {f === 'all' ? 'Entire Month' : f}
                </button>
              ))}
            </div>

            {/* STATS RIBBON */}
            <div style={statsGrid}>
              <StatCard icon={TrendingUp} label={`${timeFilter === 'all' ? 'Month' : timeFilter} Total`} value={`$${filteredTotal.toLocaleString()}`} color="#10b981" />
              <StatCard icon={ShoppingBag} label="Top Category" value={topCategory} color="#38bdf8" />
              <StatCard icon={Hash} label="Transactions" value={filteredRows.length} color="#f59e0b" />
            </div>

            {/* CHARTS */}
            <div style={chartsGrid}>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={cardStyle}>
                <div style={cardHeader}><BarChart3 size={18} /> Spending Trends</div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="item" stroke="#94a3b8" tick={{fontSize: 12}} />
                    <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                    <Tooltip 
                      cursor={{fill: '#334155', opacity: 0.4}}
                      contentStyle={tooltipContainerStyle}
                      itemStyle={{ color: '#ffffff', fontWeight: 'bold' }} 
                      labelStyle={{ color: '#cbd5e1' }}
                    />
                    <Bar dataKey="amount" fill="#38bdf8" radius={[4, 4, 0, 0]} animationDuration={800}>
                      {filteredRows.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getDynamicColor(index, filteredRows.length)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={cardStyle}>
                <div style={cardHeader}><PieIcon size={18} /> Category Split</div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie 
                      data={categoryData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" cy="50%" 
                      innerRadius={60} 
                      outerRadius={80} 
                      paddingAngle={2}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getDynamicColor(index, categoryData.length)} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipContainerStyle} itemStyle={{ color: '#ffffff' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* =====================================================================================
            VIEW 2: COMMANDER MODE (Budget Dashboard) 
           ===================================================================================== */}
        {mode === 'COMMANDER' && budget && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            
            {/* HERO GAUGE */}
            <div style={{...cardStyle, textAlign: 'center', marginBottom: '20px', border: budget.limits.leftToday < 0 ? '1px solid #ef4444' : '1px solid #10b981'}}>
               <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                  <span style={statLabel}>DAILY CAP</span>
                  <span style={{color: '#94a3b8', fontWeight: 'bold'}}>${budget.limits.daily.toFixed(2)}</span>
               </div>
               
               <BudgetGauge 
                  limit={budget.limits.daily} 
                  spent={budget.limits.spentToday} 
                  left={budget.limits.leftToday}
                  isWarning={budget.limits.isWarning}
               />

               {budget.limits.isWarning && (
                 <div style={{ marginTop: '0px', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '10px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} /> Debt Detected: Limit Reduced to recover.
                 </div>
               )}
            </div>

            {/* INFO GRID */}
            <div style={statsGrid}>
              <StatCard icon={Calendar} label="Days Remaining" value={`${budget.daysLeft} Days`} color="#8b5cf6" />
              {/* UPDATED MIDDLE CARD: SAFETY BUFFER */}
              <StatCard
                icon={budget.limits.safetyBuffer >= 0 ? ShieldCheck : AlertTriangle}
                label={budget.limits.safetyBuffer >= 0 ? "Safety Buffer" : "Daily Deficit"}
                value={`${budget.limits.safetyBuffer >= 0 ? '+' : ''}$${budget.limits.safetyBuffer.toFixed(2)}/day`}
                color={budget.limits.safetyBuffer >= 0 ? "#10b981" : "#ef4444"}
              />              <StatCard icon={ShieldCheck} label="Real Remaining" value={`$${(budget.principal - budget.fixedSpent - budget.varSpent).toFixed(2)}`} color="#10b981" />
            </div>

            {/* BREAKDOWN BARS */}
            <div style={cardStyle}>
               <div style={cardHeader}>Budget Breakdown</div>
               
               {/* Principal Bar */}
               <div style={{marginBottom: '15px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem'}}>
                    <span>Fixed Costs (Rent/Bills)</span>
                    <span>${budget.fixedSpent.toFixed(2)}</span>
                  </div>
                  <div style={{width: '100%', height: '8px', background: '#334155', borderRadius: '4px'}}>
                    <div style={{width: `${Math.min((budget.fixedSpent/budget.principal)*100, 100)}%`, height: '100%', background: '#3b82f6', borderRadius: '4px'}}></div>
                  </div>
               </div>

               {/* Variable Bar */}
               <div>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem'}}>
                    <span>Variable Spend (Fun)</span>
                    <span>${budget.varSpent.toFixed(2)}</span>
                  </div>
                  <div style={{width: '100%', height: '8px', background: '#334155', borderRadius: '4px'}}>
                    <div style={{width: `${Math.min((budget.varSpent/budget.principal)*100, 100)}%`, height: '100%', background: '#10b981', borderRadius: '4px'}}></div>
                  </div>
               </div>
            </div>

          </motion.div>
        )}


        {/* =====================================================================================
            SHARED: TABLE SECTION 
           ===================================================================================== */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ ...cardStyle, marginTop: '2rem' }}>
          <div style={cardHeader}><List size={18} /> Detailed Log</div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Item</th>
                  <th style={{ padding: '12px' }}>Category</th>
                  <th style={{ padding: '12px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {data.slice().reverse().map((row, i) => ( // Use 'data' here to show all, regardless of tracker filter
                    <motion.tr 
                      key={i} 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      style={{ borderBottom: '1px solid #1e293b' }}
                    >
                      <td style={{ padding: '12px', fontSize: '0.9rem', color: '#cbd5e1' }}>{row.date}</td>
                      <td style={{ padding: '12px', fontWeight: '500' }}>{row.item}</td>
                      <td style={{ padding: '12px', color: '#38bdf8', fontSize: '0.9rem' }}>{row.category}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>
                        <span style={{ 
                          color: row.type === 'Fixed' ? '#8b5cf6' : '#f8fafc',
                          background: row.type === 'Fixed' ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          ${row.amount}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

// --- STYLES ---
const containerStyle = { backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', width: '100vw', margin: 0, padding: '40px 0', boxSizing: 'border-box' };
const innerWrapper = { maxWidth: '1400px', margin: '0 auto', padding: '0 20px' };
const headerStyle = { marginBottom: '40px' };
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' };
const chartsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px' };
const cardStyle = { background: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' };
const cardHeader = { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: '#94a3b8', fontWeight: '600' };
const statCardStyle = { background: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155' };
const statLabel = { color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', margin: '0 0 5px 0' };
const statValue = { fontSize: '2rem', fontWeight: '800', margin: 0 };
const loaderStyle = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: '#38bdf8' };
const dropdownWrapperStyle = { display: 'flex', alignItems: 'center', gap: '10px', background: '#1e293b', padding: '8px 15px', borderRadius: '12px', border: '1px solid #334155' };
const selectStyle = { background: 'transparent', color: '#fff', border: 'none', outline: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' };
const tooltipContainerStyle = { backgroundColor: '#0f172a', border: '1px solid #38bdf8', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', padding: '10px', color: '#ffffff' };

// Toggle Button Styles
const toggleContainerStyle = { background: '#1e293b', padding: '4px', borderRadius: '12px', display: 'flex', border: '1px solid #334155' };
const toggleStyle = { background: 'transparent', border: 'none', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: '0.2s' };
const activeToggleStyle = { ...toggleStyle, background: '#38bdf8', color: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };

export default App;