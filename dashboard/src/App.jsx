import React, { useEffect, useState } from 'react';
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
  const [categoryData, setCategoryData] = useState([]);
  const [loading, setLoading] = useState(true);

  const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
  const GID = import.meta.env.VITE_GOOGLE_GID || "0";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;
        const res = await axios.get(url);
        const json = JSON.parse(res.data.substr(47).slice(0, -2));
        const rows = json.table.rows.map(r => ({
          date: r.c[0]?.f || r.c[0]?.v || 'N/A',
          item: r.c[1]?.v || 'Unknown',
          amount: r.c[2]?.v || 0,
          category: r.c[3]?.v || 'Other',
        }));

        const totals = rows.reduce((acc, curr) => {
          acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
          return acc;
        }, {});

        setCategoryData(Object.keys(totals).map(key => ({ name: key, value: totals[key] })));
        setData(rows);
        setLoading(false);
      } catch (err) {
        console.error("Fetch Error:", err);
        setLoading(false);
      }
    };
    fetchData();
  }, [SHEET_ID, GID]);

  const totalSpent = data.reduce((sum, item) => sum + item.amount, 0);
  const topCategory = categoryData.length > 0 
    ? [...categoryData].sort((a, b) => b.value - a.value)[0].name 
    : 'N/A';

  if (loading) return <div style={loaderStyle}>Loading FinancePulse...</div>;

  return (
    <div style={containerStyle}>
      <div style={innerWrapper}>
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Wallet size={40} color="#38bdf8" />
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0 }}>FinancePulse</h1>
          </div>
        </motion.header>

        <div style={statsGrid}>
          <StatCard icon={TrendingUp} label="Total Spent" value={`$${totalSpent}`} color="#10b981" />
          <StatCard icon={ShoppingBag} label="Top Category" value={topCategory} color="#38bdf8" />
          <StatCard icon={Hash} label="Entries" value={data.length} color="#f59e0b" />
        </div>

        <div style={chartsGrid}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={cardStyle}>
            <div style={cardHeader}><BarChart3 size={18} /> Spending Trends</div>
            <div style={{ height: '350px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="item" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip 
                    cursor={{fill: '#1e293b'}} 
                    contentStyle={tooltipStyle} 
                    itemStyle={{ color: '#38bdf8' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="amount" radius={[5, 5, 0, 0]}>
                    {data.map((entry, index) => <Cell key={index} fill={getDynamicColor(index, data.length)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} style={cardStyle}>
            <div style={cardHeader}><PieIcon size={18} /> Category Split</div>
            <div style={{ height: '350px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={1} stroke="none">
                    {categoryData.map((entry, index) => <Cell key={index} fill={getDynamicColor(index, categoryData.length)} />)}
                  </Pie>
                  <Tooltip 
                    contentStyle={tooltipStyle} 
                    itemStyle={{ color: '#38bdf8' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ ...cardStyle, marginTop: '2rem' }}>
          <div style={cardHeader}><List size={18} /> Recent History</div>
          <div style={{ overflowX: 'auto' }}>
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
                {data.slice().reverse().map((row, i) => (
                  <tr key={i} style={tableRow}>
                    <td style={tableCell}>{row.date}</td>
                    <td style={tableCell}>{row.item}</td>
                    <td style={{ ...tableCell, color: '#38bdf8' }}>{row.category}</td>
                    <td style={{ ...tableCell, fontWeight: 'bold', color: '#fff' }}>${row.amount}</td>
                  </tr>
                ))}
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
const statCardStyle = { background: '#1e293b', padding: '20px', borderRadius: '16px', border: '1px solid #334155' };
const statLabel = { color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', margin: '0 0 5px 0' };
const statValue = { fontSize: '1.8rem', fontWeight: '800', margin: 0 };
const loaderStyle = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: '#38bdf8' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const tableHeaderRow = { textAlign: 'left', color: '#64748b', fontSize: '0.8rem', borderBottom: '1px solid #334155' };
const tableRow = { borderBottom: '1px solid #1e293b' };
const tableCell = { padding: '15px 10px' };

// THE FIX: Explicitly clear and visible tooltip text
const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #38bdf8',
  borderRadius: '12px',
  color: '#f8fafc',
  padding: '12px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
  fontSize: '14px'
};

export default App;