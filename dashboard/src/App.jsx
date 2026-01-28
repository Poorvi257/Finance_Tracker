import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function App() {
  const [data, setData] = useState([]);
  const SHEET_ID = "1xqiJYHkZL3u0nmzHKKr6YvvSlLtq2Y0r8AfKyhqSpQQ";
  const GID = "0"; // Usually 0 for the first sheet

  useEffect(() => {
    const fetchData = async () => {
      // Fetching the sheet as CSV
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;
      const res = await axios.get(url);
      const json = JSON.parse(res.data.substr(47).slice(0, -2));
      const rows = json.table.rows.map(r => ({
        date: r.c[0]?.v,
        item: r.c[1]?.v,
        amount: r.c[2]?.v,
      }));
      setData(rows);
    };
    fetchData();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>📊 Spending Dashboard</h1>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="item" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="amount" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export default App;