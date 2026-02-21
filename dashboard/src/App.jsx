import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, CartesianGrid, PieChart, Pie, Cell 
} from 'recharts';
import { motion } from 'framer-motion';
import { 
  Wallet, BarChart3, List, TrendingUp, ShoppingBag, 
  Hash, Calendar, ShieldCheck, AlertTriangle, PiggyBank,
  Activity, ChevronLeft, ChevronRight
} from 'lucide-react';

// --- CONFIGURATION ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const ROWS_PER_PAGE = 10;

// --- HELPERS ---
const getDynamicColor = (index, total) => {
  const h = (index * (360 / Math.max(total, 1))) % 360;
  return `hsl(${h}, 70%, 60%)`;
};

const parseDate = (dateStr) => {
  if (!dateStr) return new Date();
  const [d, m, y] = dateStr.split('/').map(Number);
  return new Date(y, m - 1, d);
};

// --- SUB-COMPONENTS ---

const StatCard = ({ icon: Icon, label, value, color }) => (
  <motion.div 
    whileHover={{ y: -5 }} 
    className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col justify-between h-full"
    style={{ borderColor: color ? `${color}44` : '#334155' }}
  >
    <div className="flex justify-between items-start mb-2">
      <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">{label}</p>
      <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
        <Icon size={20} color={color} />
      </div>
    </div>
    <h2 className="text-2xl lg:text-3xl font-extrabold text-white truncate">{value}</h2>
  </motion.div>
);

const BudgetProgressBar = ({ label, spent, total, bgClass }) => {
  const percentage = Math.min((spent / total) * 100, 100);
  return (
    <div>
      <div className="flex justify-between mb-2 text-sm font-medium">
        <span className="text-slate-300">{label}</span>
        <span className="text-white">${spent.toFixed(2)}</span>
      </div>
      <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${bgClass}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const BudgetGauge = ({ limit, spent, left, isWarning }) => {
  const gaugeData = useMemo(() => {
    if (left < 0) return [{ name: 'Overspent', value: 1, color: '#ef4444' }, { name: 'Left', value: 0, color: '#334155' }];
    return [
      { name: 'Spent', value: Math.min(spent, limit), color: isWarning ? '#ef4444' : '#3b82f6' },
      { name: 'Left', value: Math.max(0, left), color: '#334155' }
    ];
  }, [limit, spent, left, isWarning]);

  return (
    <div className="relative h-64 w-full flex justify-center items-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={gaugeData} cx="50%" cy="100%"
            startAngle={180} endAngle={0}
            innerRadius="75%" outerRadius="100%"
            paddingAngle={2} dataKey="value" stroke="none"
          >
            {gaugeData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute bottom-8 text-center w-full px-4">
        <div className="text-xs text-slate-400 uppercase font-bold mb-1">Available Today</div>
        <div className={`text-4xl lg:text-5xl font-extrabold ${left < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
          ${left.toFixed(2)}
        </div>
        <div className="text-sm text-slate-400 mt-2">
          Spent: <span className="text-white font-bold">${spent.toFixed(2)}</span> / ${limit.toFixed(2)}
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

function App() {
  const [data, setData] = useState([]);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [timeFilter, setTimeFilter] = useState('all');
  const [mode, setMode] = useState('TRACKER'); 
  const [currentPage, setCurrentPage] = useState(1);
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.toLocaleString('default', { month: 'long' })}_${now.getFullYear()}`;
  });

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [timeFilter]);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dataRes, monthsRes, statusRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/data?month=${currentMonth}`),
          axios.get(`${API_BASE_URL}/api/months`),
          axios.get(`${API_BASE_URL}/api/status`)
        ]);
        
        if (mounted) {
          setData(dataRes.data.data || []);
          setAvailableMonths(monthsRes.data || []);
          setBudget(statusRes.data);
          setCurrentPage(1);
        }
      } catch (err) { console.error("Error fetching data:", err); }
      if (mounted) setLoading(false);
    };
    fetchData();
    return () => { mounted = false; };
  }, [currentMonth]);

  const filteredRows = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0);
    return data.filter(row => {
      const rowDate = parseDate(row.date); rowDate.setHours(0,0,0,0);
      switch(timeFilter) {
        case 'daily': return rowDate.getTime() === now.getTime();
        case 'weekly':
          const start = new Date(now); start.setDate(now.getDate() - now.getDay());
          return rowDate >= start;
        default: return true;
      }
    });
  }, [data, timeFilter]);

  const { categoryData, topCategory, filteredTotal } = useMemo(() => {
    const total = filteredRows.reduce((sum, r) => sum + r.amount, 0);
    const totals = filteredRows.reduce((acc, curr) => { 
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount; 
      return acc; 
    }, {});
    
    const catArray = Object.keys(totals)
      .map((key) => ({ name: key, value: totals[key] }))
      .sort((a, b) => b.value - a.value);

    const top = catArray.length > 0 ? catArray[0].name : 'N/A';
    return { categoryData: catArray, topCategory: top, filteredTotal: total };
  }, [filteredRows]);

  const dailyTrendData = useMemo(() => {
    const days = {};
    filteredRows.forEach(row => {
        if (row.type === 'Fixed') return;
        const dateKey = row.date.substring(0, 5); 
        days[dateKey] = (days[dateKey] || 0) + row.amount;
    });

    return Object.keys(days)
        .map(dateStr => ({ 
            name: dateStr, 
            value: days[dateStr].toFixed(2),
            fullDate: parseDate(`${dateStr}/${new Date().getFullYear()}`) 
        }))
        .sort((a, b) => a.fullDate - b.fullDate);
  }, [filteredRows]);

  // Use the filtered results for the log table and reverse chronological order
  const reversedFilteredData = useMemo(() => [...filteredRows].reverse(), [filteredRows]);

  // Pagination Logic
  const totalPages = Math.ceil(reversedFilteredData.length / ROWS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return reversedFilteredData.slice(start, start + ROWS_PER_PAGE);
  }, [reversedFilteredData, currentPage]);

  if (loading) return (
    <div className="h-screen w-full flex justify-center items-center bg-slate-900 text-sky-400 font-bold text-xl animate-pulse">
      ⚡ Syncing FinancePulse...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 font-sans p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
        >
            <div className="flex items-center gap-4">
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <Wallet size={32} className="text-sky-400" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">FinancePulse</h1>
                {budget?.active && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs text-emerald-500 font-bold tracking-widest uppercase">Budget Active</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
              {budget?.active && (
                <div className="bg-slate-800 p-1 rounded-xl flex border border-slate-700 w-full md:w-auto">
                  {['TRACKER', 'COMMANDER'].map(m => (
                    <button 
                      key={m}
                      className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                        mode === m ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                      }`}
                      onClick={() => setMode(m)}
                    >
                      {m === 'TRACKER' ? 'Tracker' : 'Budget'}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-700 w-full md:w-auto max-w-[200px] md:max-w-none">
                <Calendar size={18} className="text-slate-400 shrink-0" />
                <select 
                  value={currentMonth} 
                  onChange={(e) => setCurrentMonth(e.target.value)}
                  className="bg-transparent text-white border-none outline-none cursor-pointer font-bold text-sm w-full md:w-auto appearance-none truncate"
                >
                  {!availableMonths.includes(currentMonth) && <option className="bg-slate-800" value={currentMonth}>{currentMonth.replace('_', ' ')}</option>}
                  {availableMonths.map(m => (
                    <option key={m} className="bg-slate-800" value={m}>{m.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
        </motion.header>

        {/* TRACKER VIEW */}
        {mode === 'TRACKER' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {['daily', 'weekly', 'all'].map(f => (
                <button 
                  key={f}
                  onClick={() => setTimeFilter(f)}
                  className={`px-5 py-2 rounded-full text-sm font-bold capitalize transition-all whitespace-nowrap border ${
                    timeFilter === f 
                    ? 'bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-500/20' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'Entire Month' : f}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <StatCard icon={TrendingUp} label="Total Spend" value={`$${filteredTotal.toLocaleString()}`} color="#10b981" />
              <StatCard icon={ShoppingBag} label="Top Category" value={topCategory} color="#38bdf8" />
              <StatCard icon={Hash} label="Transactions" value={filteredRows.length} color="#f59e0b" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 mb-6 text-slate-400 font-bold uppercase text-xs tracking-wider">
                  <BarChart3 size={16} /> Spending by Category
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        interval={0} 
                        angle={-45} 
                        textAnchor="end"
                        tick={{fontSize: 11}} 
                        dx={-5}  // Pulls text slightly left so the end aligns with the tick
                        dy={10}  // Pushes text down away from the axis line
                        height={70} // Gives the tilted text plenty of room
                      />
                      <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                      <Tooltip 
                        cursor={{fill: '#334155', opacity: 0.4}}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#38bdf8', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#ffffff', fontWeight: 'bold' }} 
                      />
                      <Bar dataKey="value" fill="#38bdf8" radius={[4, 4, 0, 0]}>
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getDynamicColor(index, categoryData.length)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 mb-6 text-slate-400 font-bold uppercase text-xs tracking-wider">
                   <Activity size={16} /> Daily Activity
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTrendData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} dy={10} />
                      <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#10b981', borderRadius: '8px', color: '#fff' }} 
                        itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* COMMANDER VIEW */}
        {mode === 'COMMANDER' && budget && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className={`bg-slate-800 rounded-2xl p-6 border shadow-sm text-center relative ${budget.limits.leftToday < 0 ? 'border-red-500/50' : 'border-emerald-500/50'}`}>
               <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Daily Cap</span>
                  <span className="text-white font-mono font-bold bg-slate-700/50 px-2 py-1 rounded text-sm">${budget.limits.daily.toFixed(2)}</span>
               </div>
               <BudgetGauge limit={budget.limits.daily} spent={budget.limits.spentToday} left={budget.limits.leftToday} isWarning={budget.limits.isWarning} />
               {budget.limits.isWarning && (
                 <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl inline-flex items-center gap-3 text-sm font-semibold max-w-md mx-auto">
                    <AlertTriangle size={18} /> <span>Overspending Detected: Limit reduced.</span>
                 </div>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <StatCard icon={Calendar} label="Days Remaining" value={`${budget.daysLeft} Days`} color="#8b5cf6" />
              <StatCard icon={PiggyBank} label="Piggy Bank (Saved)" value={`$${Math.max(0, budget.limits.safetyBuffer).toFixed(2)}`} color="#f59e0b" />
              <StatCard icon={ShieldCheck} label="Real Remaining" value={`$${(budget.principal - budget.fixedSpent - budget.varSpent).toFixed(2)}`} color="#38bdf8" />
            </div>

            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-sm">
               <div className="flex items-center gap-2 mb-6 text-slate-400 font-bold uppercase text-xs tracking-wider">Budget Breakdown</div>
               <div className="space-y-6">
                 <BudgetProgressBar label="Fixed Costs (Rent/Bills)" spent={budget.fixedSpent} total={budget.principal} bgClass="bg-blue-500" />
                 <BudgetProgressBar label="Variable Spend (Fun)" spent={budget.varSpent} total={budget.principal} bgClass="bg-emerald-500" />
               </div>
            </div>
          </motion.div>
        )}

        {/* DATA TABLE */}
        {mode === 'TRACKER' && <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="bg-slate-800 rounded-2xl border border-slate-700 shadow-sm overflow-hidden"
        >
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <List size={18} className="text-slate-400" />
              <span className="text-slate-400 font-bold uppercase text-xs tracking-wider">
                Detailed Log {timeFilter !== 'all' && `(${timeFilter})`}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Page {currentPage} of {totalPages || 1}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-slate-900/50">
                <tr className="text-slate-400 text-xs uppercase font-bold tracking-wider">
                  <th className="p-4 pl-6">Date</th>
                  <th className="p-4">Item</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 pr-6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {paginatedData.length > 0 ? (
                  paginatedData.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                      <td className="p-4 pl-6 text-sm text-slate-400 font-mono">{row.date}</td>
                      <td className="p-4 font-medium text-slate-200">{row.item}</td>
                      <td className="p-4">
                        <span className="bg-sky-500/10 text-sky-400 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide">
                          {row.category}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <span className={`font-bold font-mono ${row.type === 'Fixed' ? 'text-purple-400' : 'text-slate-50'}`}>
                          ${row.amount.toFixed(2)}
                        </span>
                        {row.type === 'Fixed' && <span className="ml-2 text-[10px] text-purple-400/70 uppercase">Fixed</span>}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="p-12 text-center text-slate-500 font-medium italic">
                      No logs found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {reversedFilteredData.length > 0 && (
            <div className="p-4 bg-slate-900/30 border-t border-slate-700 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Showing <span className="text-white">{(currentPage - 1) * ROWS_PER_PAGE + 1}</span> to <span className="text-white">{Math.min(currentPage * ROWS_PER_PAGE, reversedFilteredData.length)}</span> of <span className="text-white">{reversedFilteredData.length}</span>
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      }
      </div>
    </div>
  );
}

export default App;