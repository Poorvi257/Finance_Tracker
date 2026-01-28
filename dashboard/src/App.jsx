import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

function App() {
  const [data, setData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const url = `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&gid=${import.meta.env.VITE_GOOGLE_GID}`;
      const res = await axios.get(url);
      const json = JSON.parse(res.data.substr(47).slice(0, -2));
      
      const rows = json.table.rows.map(r => ({
        item: r.c[1]?.v,
        amount: r.c[2]?.v,
        category: r.c[3]?.v || 'Other',
      }));

      // Consolidate data by Category
      const totals = rows.reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
        return acc;
      }, {});

      const formattedCategoryData = Object.keys(totals).map(key => ({
        name: key,
        value: totals[key]
      }));

      setData(rows);
      setCategoryData(formattedCategoryData);
    };
    fetchData();
  }, []);

  return (
    <div style={{ padding: '40px', backgroundColor: '#f5f7fb', minHeight: '100vh' }}>
      <h1>📈 Financial Overview</h1>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Category Distribution */}
        <div style={{ flex: '1', minWidth: '300px', background: '#fff', padding: '20px', borderRadius: '12px' }}>
          <h3>Spending by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Item Breakdown */}
        <div style={{ flex: '1', minWidth: '300px', background: '#fff', padding: '20px', borderRadius: '12px' }}>
          <h3>Individual Items</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <XAxis dataKey="item" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="amount" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
export default App;