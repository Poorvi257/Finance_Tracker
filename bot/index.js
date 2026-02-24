const { Telegraf } = require('telegraf');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const cron = require('node-cron');

// --- CONFIGURATION ---
const TIMEZONE_OFFSET = 8; // UTC+8 (Singapore)

// --- SETUP ---
const app = express();
app.use(cors());
app.use(express.json());

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// --- HELPERS ---

const getLocalNow = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * TIMEZONE_OFFSET));
};

const getMonthSheetName = () => {
  const now = getLocalNow();
  return `${now.toLocaleString('default', { month: 'long' })}_${now.getFullYear()}`;
};

const getTodayDate = () => {
  const now = getLocalNow();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`; 
};

const isValidDateInCurrentMonth = (d, m, y) => {
  const dateObj = new Date(y, m - 1, d);
  return dateObj.getFullYear() === y && dateObj.getMonth() === m - 1 && dateObj.getDate() === d;
};

async function getOrCreateSheet(title) {
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await doc.addSheet({ title, headerValues: ['Date', 'Item', 'Amount', 'Category', 'Type'] });
    await sheet.loadCells('F1:G1');
    sheet.getCellByA1('F1').value = 'TOTAL SPENT:'; 
    sheet.getCellByA1('G1').formula = '=SUM(C:C)';   
    await sheet.saveUpdatedCells();
  }
  return sheet;
}

async function getBudgetSheet() {
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle['Budget_Config'];
  if (!sheet) {
    sheet = await doc.addSheet({ title: 'Budget_Config', headerValues: ['Name', 'Start_Date', 'End_Date', 'Principal', 'Fixed_Spent', 'Variable_Spent', 'Status'] });
  }
  return sheet;
}

// --- CORE LOGIC ENGINE ---
async function calculateBudgetStats() {
  const budgetSheet = await getBudgetSheet();
  const budgetRows = await budgetSheet.getRows();
  
  if (budgetRows.length === 0) return null;

  const row = budgetRows[0];
  const principal = parseFloat(row.get('Principal'));
  const fixedSpent = parseFloat(row.get('Fixed_Spent')) || 0;
  const varSpent = parseFloat(row.get('Variable_Spent')) || 0;
  const startDateStr = row.get('Start_Date');
  const endDateStr = row.get('End_Date');

  // 1. Date Math
  const [d1, m1, y1] = startDateStr.split('-').map(Number);
  const [d2, m2, y2] = endDateStr.split('-').map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  const now = getLocalNow();
  
  // FIX: Set the end time to the very end of the final day (23:59:59)
  const inclusiveEnd = new Date(y2, m2 - 1, d2, 23, 59, 59, 999);
  const diffTime = inclusiveEnd - now;
  
  const daysLeft = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1);
  const totalDuration = Math.ceil((inclusiveEnd - start) / (1000 * 60 * 60 * 24));
  
  // 2. Fetch all daily spends
  const monthSheetName = getMonthSheetName();
  const monthSheet = doc.sheetsByTitle[monthSheetName];
  const dailyMap = {};
  let spentToday = 0;
  const todayStr = getTodayDate();

  if (monthSheet) {
      const rows = await monthSheet.getRows();
      rows.forEach(r => {
          const date = r.get('Date');
          const amt = parseFloat(r.get('Amount')) || 0;
          const type = r.get('Type');
          // We only count Variable spending against the daily limit
          if (type === 'Variable' || !type) {
              dailyMap[date] = (dailyMap[date] || 0) + amt;
          }
      });
      spentToday = dailyMap[todayStr] || 0;
  }

  // 3. Simulate the Budget Day-by-Day (Piggy Bank Logic)
  const disposableTotal = principal - fixedSpent;
  let currentDailyLimit = disposableTotal / totalDuration; 
  let piggyBank = 0;
  let currentDaysRemaining = totalDuration;

  const checkDate = new Date(start);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  // Loop from the start date up to yesterday
  while (checkDate <= yesterday) {
      const d = String(checkDate.getDate()).padStart(2, '0');
      const m = String(checkDate.getMonth() + 1).padStart(2, '0');
      const y = checkDate.getFullYear();
      const dateKey = `${d}/${m}/${y}`;

      const spentThatDay = dailyMap[dateKey] || 0;
      currentDaysRemaining--; // One less day remaining for the rest of the period

      // Reward: Underspending
      if (spentThatDay < currentDailyLimit) {
          piggyBank += (currentDailyLimit - spentThatDay);
          // Notice: currentDailyLimit stays exactly the same!
      } 
      // Punishment: Overspending
      else if (spentThatDay > currentDailyLimit) {
          const overspend = spentThatDay - currentDailyLimit;
          // Distribute the overspend across the remaining days to lower the limit
          if (currentDaysRemaining > 0) {
              currentDailyLimit -= (overspend / currentDaysRemaining);
          }
          // Notice: piggyBank is untouched!
      }

      checkDate.setDate(checkDate.getDate() + 1);
  }

  // 4. Finalizing Today's Limits
  // Prevent the daily limit from dropping below zero if horribly overspent
  const realDailyLimit = Math.max(0, currentDailyLimit);
  const leftToday = realDailyLimit - spentToday;

  return {
      row,
      principal,
      fixedSpent,
      varSpent,
      daysLeft,
      piggyBank,
      realDailyLimit,
      spentToday,
      leftToday
  };
}
// --- API ENDPOINTS ---

app.get('/api/data', async (req, res) => {
  try {
    const monthTitle = req.query.month || getMonthSheetName();
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[monthTitle];
    if (!sheet) return res.json({ month: monthTitle, data: [], total: 0 });

    const rows = await sheet.getRows();
    let total = 0;
    const cleanRows = rows.map(r => {
      const amt = Number(r.get('Amount')) || 0;
      total += amt;
      return {
        date: r.get('Date'),
        item: r.get('Item'),
        amount: amt,
        category: r.get('Category'),
        type: r.get('Type') || 'Variable'
      };
    });
    
    let sheetTotal = total;
    try {
      await sheet.loadCells('G1:G1');
      const val = sheet.getCellByA1('G1').value;
      if (typeof val === 'number') sheetTotal = val;
    } catch (e) {}

    res.json({ month: monthTitle, data: cleanRows, total: sheetTotal });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/status', async (req, res) => {
  try {
      const stats = await calculateBudgetStats();
      if (!stats) return res.json({ active: false });

      res.json({
          active: true,
          principal: stats.principal,
          fixedSpent: stats.fixedSpent,
          varSpent: stats.varSpent,
          daysLeft: stats.daysLeft,
          limits: {
              daily: stats.realDailyLimit,
              spentToday: stats.spentToday,
              leftToday: stats.leftToday,
              safetyBuffer: stats.piggyBank,
              isWarning: stats.leftToday < 0
          }
      });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/months', async (req, res) => {
  try {
    await doc.loadInfo();
    const titles = Object.keys(doc.sheetsByTitle).filter(t => t !== 'Budget_Config');
    res.json(titles);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- EXTERNAL CRON TRIGGER FOR GREETING ---
app.get('/api/cron/greet', (req, res) => {
  // Security check: Only allow requests with the correct secret password
  const secret = req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    return res.status(500).json({ error: "No TELEGRAM_CHAT_ID configured." });
  }

  const greetings = [
    "☀️ Good morning baby. I hope you slept well muaahhh. 💋",
    "🥱 Wake up baby. I need my favorite human. 🧸",
    "🥰 Hi shona. I just know you look adorable right now. ✨",
    "🌅 Good morning. I hope today surprises you in a nice way. 🎁",
    "😜 Wake up gandi bacchi. Try not to miss me so much. 💖",
    "🌞 Morning my baby. Smile a little extra today. 😊",
    "💭 Hi. Did you dream about me? 🌙",
    "🌼 Good morning choti choti. Be your amazing self today. 💫",
    "🌻 Wake up. I better get at least one smile from you today. 😄",
    "🎀 Hi my beautiful baby girl. I will hug you super soon okay? 🤗",
    "☕ Good morning. I hope your coffee behaves today. 🪄",
    "🐣 Wake up baby. Don’t forget you’re cute for no reason. 🥺",
    "👋 Hi choti bacchi. I’m already missing you a bit. ❤️",
    "🌤️ Good morning. Go do your thing. I’ll admire from here. 👀",
    "📱 Wake up shona. I expect updates. 💌",
    "🤭 Morning. Try not to look too good today. 💅",
    "🌷 Hi my baby. Someone thinks you’re very special. 💝",
    "☀️ Good morning gandi bacchi. Stay adorable, that’s your only task. 🐰",
    "🦋 Wake up. I hope something random makes you think of me. 💭",
    "🐒 Hi shoni. Just checking if my person is awake yet. 💕",
    "🌅 Good morning choti choti. Missing you and Teh. ☕️",
    "🌻 Wake up baby. I like starting my day thinking about you. 🥰",
    "🌟 Morning my beautiful baby girl. Go shine quietly. 🤫",
    "💕 Hi mou mou. You better have a good day ;* 😘",
    "🎈 Good morning Bub. Have an amazing day, cheering you always. 🎉"
  ];
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  // Send the message proactively
  bot.telegram.sendMessage(chatId, `🌅 *${randomGreeting}*`, { parse_mode: 'Markdown' })
    .then(() => res.status(200).json({ success: true, message: "Greeting sent!" }))
    .catch(err => {
      console.error("Failed to send morning message:", err);
      res.status(500).json({ error: "Failed to send Telegram message" });
    });
});

// --- COMMANDS & LOGGING ---

bot.start((ctx) => ctx.reply('💰 *FinancePulse V7 Ready (Clean Mode)*\n\n/budget Name Start End Amount\n/show - Full Dashboard\n/resync - Fix totals\n/report - Last 10 txns', { parse_mode: 'Markdown' }));

bot.command('clearbudget', async (ctx) => {
  try {
    const sheet = await getBudgetSheet();
    await sheet.clearRows(); 
    ctx.reply('🗑️ *Budgets Cleared.*', { parse_mode: 'Markdown' });
  } catch (e) { ctx.reply('❌ Failed.'); }
});

bot.command('budget', async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 5) return ctx.reply('⚠️ Usage: /budget Name DD-MM-YYYY DD-MM-YYYY Amount');
  const name = parts[1];
  const startStr = parts[2];
  const endStr = parts[3];
  const amount = parseFloat(parts[4]);
  if (isNaN(amount)) return ctx.reply('⚠️ Amount must be a number.');

  const [d1, m1, y1] = startStr.split('-').map(Number);
  const [d2, m2, y2] = endStr.split('-').map(Number);
  
  if (!isValidDateInCurrentMonth(d1, m1, y1)) return ctx.reply(`❌ Invalid Start Date: ${startStr}`);
  if (!isValidDateInCurrentMonth(d2, m2, y2)) return ctx.reply(`❌ Invalid End Date: ${endStr}`);
  
  const startDate = new Date(y1, m1 - 1, d1);
  const endDate = new Date(y2, m2 - 1, d2);
  if (startDate > endDate) return ctx.reply('❌ Start date must be before End date.');

  try {
    const sheet = await getBudgetSheet();
    await sheet.clearRows(); 
    await sheet.addRow({ Name: name, Start_Date: startStr, End_Date: endStr, Principal: amount, Fixed_Spent: 0, Variable_Spent: 0, Status: 'Active' });
    
    const inclusiveEnd = new Date(y2, m2 - 1, d2, 23, 59, 59);
    const diffTime = inclusiveEnd - startDate;
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const daily = amount / totalDays;
    
    ctx.reply(`✅ *Budget Set: ${name}*\n💰 Principal: $${amount}\n📅 Duration: ${totalDays} days\n🛡️ *Initial Ceiling:* $${daily.toFixed(2)}`, { parse_mode: 'Markdown' });
  } catch (e) { console.error(e); ctx.reply('❌ System Error.'); }
});

bot.command(['help', 'commands'], (ctx) => {
  const helpMsg = `*⚡ Available Commands:*
/show - 📊 View your budget dashboard
/report - 📜 See your last 10 transactions
/resync - 🔄 Fix math if you manually edited the sheet
/budget - 💰 Set a new budget (Format: \`/budget Name DD-MM-YYYY DD-MM-YYYY Amount\`)
/clearbudget - 🗑️ Clear the active budget
/help - ℹ️ Show this menu`;

  ctx.reply(helpMsg, { parse_mode: 'Markdown' });
});

bot.command('resync', async (ctx) => {
  try {
    const monthSheetName = getMonthSheetName();
    await doc.loadInfo();
    const monthSheet = doc.sheetsByTitle[monthSheetName];
    if (!monthSheet) return ctx.reply('⚠️ No data found for this month.');
    const rows = await monthSheet.getRows();
    let fixedTotal = 0; let varTotal = 0;
    rows.forEach(row => {
        const amt = parseFloat(row.get('Amount')) || 0;
        const type = row.get('Type');
        if (type === 'Fixed') fixedTotal += amt; else varTotal += amt;
    });
    const budgetSheet = await getBudgetSheet();
    const budgetRows = await budgetSheet.getRows();
    if (budgetRows.length === 0) return ctx.reply('⚠️ No active budget config found.');
    const row = budgetRows[0];
    row.set('Fixed_Spent', fixedTotal); row.set('Variable_Spent', varTotal);
    await row.save();
    ctx.reply(`🔄 *Resync Complete*\nFixed: $${fixedTotal}\nVariable: $${varTotal}`, { parse_mode: 'Markdown' });
  } catch (e) { console.error(e); ctx.reply('❌ Resync failed.'); }
});

bot.command('show', async (ctx) => {
    try {
        const stats = await calculateBudgetStats();
        if (!stats) return ctx.reply('⚠️ No active budget found.');

        const leftAfter = stats.leftToday;
        const emoji = leftAfter < 0 ? "🚨" : "✅";

        ctx.reply(`📊 *Budget Dashboard*\n\n📅 *Today's Status:*\n• Limit:  $${stats.realDailyLimit.toFixed(2)}\n• Spent:  $${stats.spentToday.toFixed(2)}\n• Left:   *${emoji} $${leftAfter.toFixed(2)}*\n\n🐷 *Piggy Bank:* $${stats.piggyBank.toFixed(2)}\n\n📉 *Overall Progress:*\n• Total Budget: $${stats.principal}\n• Remaining:    $${(stats.principal - stats.fixedSpent - stats.varSpent).toFixed(2)}\n• Days Left:    ${stats.daysLeft}`, { parse_mode: 'Markdown' });
    } catch (e) { console.error(e); ctx.reply('❌ Error fetching status.'); }
});

bot.command('report', async (ctx) => {
    try {
        const monthSheetName = getMonthSheetName();
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[monthSheetName];
        if (!sheet) return ctx.reply('⚠️ No transactions yet.');
        const rows = await sheet.getRows();
        const last10 = rows.slice(-10); 
        if (last10.length === 0) return ctx.reply('⚠️ No transactions found.');
        let msg = `📜 *Last ${last10.length} Transactions:*\n\n`;
        last10.forEach(r => {
            const date = r.get('Date');
            const item = r.get('Item');
            const amt = r.get('Amount');
            const type = r.get('Type') === 'Fixed' ? '📌' : '';
            msg += `${date}: ${item} - $${amt} ${type}\n`;
        });
        ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (e) { console.error(e); ctx.reply('❌ Error generating report.'); }
});

bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  const parts = ctx.message.text.trim().split(/\s+/);
  
  let type = 'Variable';
  if (parts.length > 2 && parts[parts.length - 1].toLowerCase() === 'fixed') {
    type = 'Fixed'; parts.pop(); 
  }
  const item = parts[0];
  const amount = parseFloat(parts[1]);
  const categoryRaw = parts.slice(2).join(' '); 
  const category = categoryRaw ? categoryRaw.charAt(0).toUpperCase() + categoryRaw.slice(1).toLowerCase() : 'Other';

  if (!item || isNaN(amount)) return ctx.reply('⚠️ Format: Item Amount Category [fixed]');

  try {
    const sheetName = getMonthSheetName();
    let sheet = await getOrCreateSheet(sheetName);
    const todayFormatted = getTodayDate(); 
    try { await sheet.addRow({ Date: todayFormatted, Item: item, Amount: amount, Category: category, Type: type }); } 
    catch (e) { await doc.loadInfo(); sheet = await getOrCreateSheet(sheetName); await sheet.addRow({ Date: todayFormatted, Item: item, Amount: amount, Category: category, Type: type }); }

    let budgetMsg = "";
    try {
        const budgetSheet = await getBudgetSheet();
        const budgetRows = await budgetSheet.getRows();
        if (budgetRows.length > 0) {
            const row = budgetRows[0];
            let fixedSpent = parseFloat(row.get('Fixed_Spent')) || 0;
            let varSpent = parseFloat(row.get('Variable_Spent')) || 0; 
            
            if (type === 'Fixed') { fixedSpent += amount; row.set('Fixed_Spent', fixedSpent); } 
            else { varSpent += amount; row.set('Variable_Spent', varSpent); }
            await row.save(); 
            
            const stats = await calculateBudgetStats();
            if (stats) {
                if (type === 'Fixed') {
                    budgetMsg = `\n\n📉 *Fixed Cost Added*`;
                } else {
                    const leftAfter = stats.leftToday;
                    const emoji = leftAfter < 0 ? "🚨" : "✅";
                    // REVERTED FORMAT AS REQUESTED
                    budgetMsg = `\n\n${emoji} *Status:*\nLimit:   $${stats.realDailyLimit.toFixed(2)}\nSpent:   $${stats.spentToday.toFixed(2)}\nLeft:    $${leftAfter.toFixed(2)}`;
                }
            }
        }
    } catch (e) { console.error("Budget calc error", e); }
    ctx.reply(`✅ Logged: ${item} ($${amount})${budgetMsg}`, { parse_mode: 'Markdown' });
  } catch (e) { console.error(e); ctx.reply('❌ Error saving data.'); }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

bot.launch().catch(err => console.error("Bot launch error:", err));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));