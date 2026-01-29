import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, PieChart as PieIcon, BarChart3, List, TrendingUp, ShoppingBag, Hash, Calendar } from 'lucide-react';

// --- CONFIGURATION ---
const API_BASE_URL = import.meta.env.RENDER_API_BASE_URL || "http://localhost:3000";

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

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [timeFilter, setTimeFilter] = useState('all');
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.toLocaleString('default', { month: 'long' })}_${now.getFullYear()}`;
  });

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dataRes, monthsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/data?month=${currentMonth}`),
          axios.get(`${API_BASE_URL}/api/months`)
        ]);

        setData(dataRes.data.data || []);
        setAvailableMonths(monthsRes.data || []);
      } catch (err) {
        console.error("Error fetching data:", err);
      }
      setLoading(false);
    };
    fetchData();
  }, [currentMonth]);

  // --- FILTER LOGIC ---
  const filteredRows = useMemo(() => {
    const now = new Date();
    return data.filter(row => {
      const rowDate = new Date(row.date);
      if (isNaN(rowDate)) return true;

      switch(timeFilter) {
        case 'daily':
          return rowDate.toDateString() === now.toDateString();
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

  // --- DYNAMIC STATS ---
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
        
        {/* HEADER */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={headerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <Wallet size={40} color="#38bdf8" />
              <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0 }}>FinancePulse</h1>
            </div>

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
        </motion.header>

        {/* TIME FILTERS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          {['daily', 'weekly', 'all'].map(f => (
            <button 
              key={f}
              onClick={() => setTimeFilter(f)}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: timeFilter === f ? '#38bdf8' : '#1e293b',
                color: '#fff',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontWeight: 'bold',
                transition: '0.2s'
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
          {/* BAR CHART */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={cardStyle}>
            <div style={cardHeader}><BarChart3 size={18} /> Spending Trends</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filteredRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="item" stroke="#94a3b8" tick={{fontSize: 12}} />
                <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                {/* UNIFIED TOOLTIP STYLE - WHITE TEXT */}
                <Tooltip 
                  cursor={{fill: '#334155', opacity: 0.4}}
                  contentStyle={tooltipContainerStyle}
                  itemStyle={{ color: '#ffffff', fontWeight: 'bold' }} // White text for values
                  labelStyle={{ color: '#cbd5e1' }} // Light gray for labels
                />
                <Bar dataKey="amount" fill="#38bdf8" radius={[4, 4, 0, 0]} animationDuration={800}>
                  {filteredRows.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getDynamicColor(index, filteredRows.length)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* PIE CHART */}
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
                {/* UNIFIED TOOLTIP STYLE - WHITE TEXT */}
                <Tooltip 
                  contentStyle={tooltipContainerStyle} 
                  itemStyle={{ color: '#ffffff' }} // White text for values
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* TABLE SECTION */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ ...cardStyle, marginTop: '2rem' }}>
          <div style={cardHeader}><List size={18} /> Detailed Log ({timeFilter})</div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
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
                  {filteredRows.slice().reverse().map((row, i) => (
                    <motion.tr 
                      key={i} 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      style={{ borderBottom: '1px solid #1e293b' }}
                    >
                      <td style={{ padding: '12px' }}>{row.date}</td>
                      <td style={{ padding: '12px' }}>{row.item}</td>
                      <td style={{ padding: '12px', color: '#38bdf8' }}>{row.category}</td>
                      <td style={{ padding: '12px'}}>${row.amount}</td>
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

// --- UPDATED TOOLTIP STYLE OBJECT ---
const tooltipContainerStyle = {
  backgroundColor: '#0f172a', // Dark background
  border: '1px solid #38bdf8', // Blue Border
  borderRadius: '8px', 
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
  padding: '10px',
  color: '#ffffff' // Ensure container defaults to white too
};

export default App;