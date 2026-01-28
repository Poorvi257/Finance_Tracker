import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, PieChart as PieIcon, BarChart3, List, TrendingUp, ShoppingBag, Hash } from 'lucide-react';

const getDynamicColor = (index, total) => {
  const h = (index * (360 / Math.max(total, 1))) % 360;
  return `hsl(${h}, 70%, 60%)`;
};

// Reusable Stat Card Component
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
  const [timeFilter, setTimeFilter] = useState('all');

  const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
  const GID = import.meta.env.VITE_GOOGLE_GID || "0";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;
        const res = await axios.get(url);
        const json = JSON.parse(res.data.substr(47).slice(0, -2));
        const rawRows = json.table.rows.slice(1);
    
        const rows = rawRows.map(r => ({
          date: r.c[0]?.f || r.c[0]?.v || 'N/A',
          item: r.c[1]?.v || 'Unknown',
          amount: Number(r.c[2]?.v) || 0,
          category: r.c[3]?.v || 'Other',
        }));
    
        setData(rows);
        setLoading(false);
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
        setLoading(false);
      }
    };
    fetchData();
  }, [SHEET_ID, GID]);

  // 1. FILTER LOGIC
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
          startOfWeek.setHours(0, 0, 0, 0);
          return rowDate >= startOfWeek;
        case 'monthly':
          return rowDate.getMonth() === now.getMonth() && 
                 rowDate.getFullYear() === now.getFullYear();
        case 'yearly':
          return rowDate.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    });
  }, [data, timeFilter]);

  // 2. RECALCULATE STATS BASED ON FILTERED ROWS
  const { filteredCategoryData, filteredTotal, topCategory } = useMemo(() => {
    const totals = filteredRows.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});

    const catData = Object.keys(totals).map(key => ({
      name: key,
      value: totals[key]
    }));

    const total = filteredRows.reduce((sum, row) => sum + row.amount, 0);
    const topCat = catData.length > 0 
      ? [...catData].sort((a, b) => b.value - a.value)[0].name 
      : 'N/A';

    return { filteredCategoryData: catData, filteredTotal: total, topCategory: topCat };
  }, [filteredRows]);

  if (loading) return (
    <div style={loaderStyle}>
      <motion.h2 animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
        Syncing with Ledger...
      </motion.h2>
    </div>
  );

  return (
    <div style={containerStyle}>
      <div style={innerWrapper}>
        
        {/* HEADER */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Wallet size={40} color="#38bdf8" />
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0, letterSpacing: '-1px' }}>FinancePulse</h1>
          </div>
        </motion.header>

        {/* TIME FILTERS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          {['daily', 'weekly', 'monthly', 'yearly', 'all'].map(f => (
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
              {f}
            </button>
          ))}
        </div>

        {/* STATS RIBBON (Now Dynamic) */}
        <div style={statsGrid}>
          <StatCard icon={TrendingUp} label={`${timeFilter} Total`} value={`$${filteredTotal.toLocaleString()}`} color="#10b981" />
          <StatCard icon={ShoppingBag} label="Top Category" value={topCategory} color="#38bdf8" />
          <StatCard icon={Hash} label="Filtered Logs" value={filteredRows.length} color="#f59e0b" />
        </div>

        {/* CHARTS SECTION (Now using filtered data) */}
        <div style={chartsGrid}>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={cardStyle}>
            <div style={cardHeader}><BarChart3 size={18} /> {timeFilter.toUpperCase()} Trends</div>
            <div style={{ height: '350px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="item" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: '#1e293b'}} 
                    contentStyle={tooltipStyle} 
                    itemStyle={{ color: '#38bdf8' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="amount" radius={[5, 5, 0, 0]} animationDuration={800}>
                    {filteredRows.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getDynamicColor(index, filteredRows.length)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} style={cardStyle}>
            <div style={cardHeader}><PieIcon size={18} /> Category Split</div>
            <div style={{ height: '350px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={filteredCategoryData} 
                    dataKey="value" 
                    nameKey="name"
                    cx="50%" cy="50%" 
                    innerRadius={75} 
                    outerRadius={115} 
                    paddingAngle={1} 
                    stroke="none"
                  >
                    {filteredCategoryData.map((entry, index) => (
                      <Cell key={`cell-pie-${index}`} fill={getDynamicColor(index, filteredCategoryData.length)} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#38bdf8' }} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* TABLE SECTION (Now using filtered data) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ ...cardStyle, marginTop: '2rem' }}>
          <div style={cardHeader}><List size={18} /> History ({timeFilter})</div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={tableHeaderRow}>
                  <th style={tableCell}>Date</th>
                  <th style={tableCell}>Item</th>
                  <th style={tableCell}>Category</th>
                  <th style={tableCell}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredRows.slice().reverse().map((row, i) => (
                    <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={tableRow}>
                      <td style={tableCell}>{row.date}</td>
                      <td style={tableCell}>{row.item}</td>
                      <td style={{ ...tableCell, color: '#38bdf8' }}>{row.category}</td>
                      <td style={{ ...tableCell, fontWeight: 'bold', color: '#fff' }}>${row.amount}</td>
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

// STYLES 
const containerStyle = { backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', width: '100vw', margin: 0, padding: '40px 0', boxSizing: 'border-box', overflowX: 'hidden' };
const innerWrapper = { maxWidth: '1400px', margin: '0 auto', padding: '0 20px', width: '100%', boxSizing: 'border-box' };
const headerStyle = { marginBottom: '40px' };
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' };
const chartsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px' };
const cardStyle = { background: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' };
const cardHeader = { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: '#94a3b8', fontWeight: '600' };
const statCardStyle = { background: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155' };
const statLabel = { color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', margin: '0 0 5px 0', letterSpacing: '0.5px' };
const statValue = { fontSize: '2rem', fontWeight: '800', margin: 0 };
const loaderStyle = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: '#38bdf8' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const tableHeaderRow = { textAlign: 'left', color: '#64748b', fontSize: '0.8rem', borderBottom: '1px solid #334155', textTransform: 'uppercase' };
const tableRow = { borderBottom: '1px solid #1e293b' };
const tableCell = { padding: '16px 10px' };
const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #38bdf8', borderRadius: '12px', color: '#f8fafc', padding: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)', fontSize: '14px' };

export default App;