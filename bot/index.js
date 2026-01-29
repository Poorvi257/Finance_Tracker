const { Telegraf } = require('telegraf');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// --- 1. SETUP EXPRESS SERVER & CORS ---
const app = express();

// Allow all origins for now to prevent CORS blocking during testing
app.use(cors({ origin: true, credentials: true })); 
app.use(express.json());

// --- 2. SETUP GOOGLE SHEETS & BOT ---
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// --- 3. HELPER FUNCTIONS ---

// Generates "January_2026" based on current date
const getMonthSheetName = () => {
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  return `${month}_${now.getFullYear()}`;
};

// Finds the sheet or creates it if it's missing
async function getOrCreateSheet(title) {
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle[title];

  if (!sheet) {
    console.log(`Sheet "${title}" not found. Creating it...`);
    sheet = await doc.addSheet({ 
      title, 
      headerValues: ['Date', 'Item', 'Amount', 'Category'] 
    });
    
    // Add the Total Formula to cell G1
    await sheet.loadCells('G1:G1');
    const cell = sheet.getCellByA1('G1');
    cell.formula = '=SUM(C:C)'; // Sums the Amount column
    await sheet.saveUpdatedCells();
  }
  return sheet;
}

// --- 4. API ENDPOINTS (For the Dashboard later) ---

// GET /api/data?month=January_2026
app.get('/api/data', async (req, res) => {
  try {
    // Use the requested month OR the current month
    const monthTitle = req.query.month || getMonthSheetName();
    await doc.loadInfo();
    
    const sheet = doc.sheetsByTitle[monthTitle];
    if (!sheet) {
      return res.json({ month: monthTitle, data: [], total: 0 });
    }

    const rows = await sheet.getRows();
    const cleanRows = rows.map(r => ({
      date: r.get('Date'),
      item: r.get('Item'),
      amount: Number(r.get('Amount')) || 0,
      category: r.get('Category')
    }));

    // Fetch total from G1
    await sheet.loadCells('G1:G1');
    const total = sheet.getCellByA1('G1').value || 0;

    res.json({ month: monthTitle, data: cleanRows, total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/months (Returns list of all available tabs)
app.get('/api/months', async (req, res) => {
  try {
    await doc.loadInfo();
    // Return all sheet titles (you might want to filter out non-month sheets later)
    const titles = Object.keys(doc.sheetsByTitle);
    res.json(titles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 5. TELEGRAM COMMANDS ---

bot.start((ctx) => ctx.reply('💰 FinancePulse Active! I will create monthly sheets automatically.'));

bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return; // Ignore commands

  const parts = ctx.message.text.split(' ');
  const item = parts[0];
  const amount = parseFloat(parts[1]);
  const category = parts[2] ? parts[2].charAt(0).toUpperCase() + parts[2].slice(1).toLowerCase() : 'Other';

  if (!item || isNaN(amount)) return ctx.reply('⚠️ Format: Item Amount Category');

  try {
    const sheetName = getMonthSheetName();
    const sheet = await getOrCreateSheet(sheetName);

    await sheet.addRow({
      Date: new Date().toLocaleDateString(),
      Item: item,
      Amount: amount,
      Category: category
    });

    ctx.reply(`✅ Saved to *${sheetName}*: ${item} ($${amount})`);
  } catch (e) {
    console.error(e);
    ctx.reply('❌ Error saving data.');
  }
});

// --- 6. START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Stop previous bot instance if running locally (avoids 409 conflict)
bot.launch().catch(err => console.error("Bot launch error:", err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));