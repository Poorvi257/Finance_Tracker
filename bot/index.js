const { Telegraf } = require('telegraf');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const http = require('http');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Auth for Google Sheets
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

bot.start((ctx) => ctx.reply('💰 Finance Tracker Active! Send: "Coffee 5"'));


// 1. DELETE THE LAST ITEM
bot.command('delete', async (ctx) => {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    if (rows.length === 0) {
      return ctx.reply('⚠️ The sheet is already empty!');
    }

    // Get the very last row
    const lastRow = rows[rows.length - 1];
    const details = `${lastRow.get('Item')} ($${lastRow.get('Amount')})`;
    
    await lastRow.delete();
    ctx.reply(`🗑️ Successfully deleted the last entry: ${details}`);
  } catch (e) {
    console.error(e);
    ctx.reply('❌ Failed to delete the last item.');
  }
});

// 2. EDIT THE LAST ITEM
// Usage: /edit NewItem NewAmount NewCategory
bot.command('edit', async (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1); // Remove the "/edit" part
  const newItem = parts[0];
  const newAmount = parseFloat(parts[1]);
  const newCategory = parts[2] ? parts[2].charAt(0).toUpperCase() + parts[2].slice(1).toLowerCase() : 'Other';

  if (!newItem || isNaN(newAmount)) {
    return ctx.reply('⚠️ Use: /edit Item Amount Category\nExample: /edit Sushi 25 Food');
  }

  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    if (rows.length === 0) {
      return ctx.reply('⚠️ No items found to edit!');
    }

    const lastRow = rows[rows.length - 1];
    const oldDetails = `${lastRow.get('Item')} ($${lastRow.get('Amount')})`;

    // Update the row values
    lastRow.set('Item', newItem);
    lastRow.set('Amount', newAmount);
    lastRow.set('Category', newCategory);
    lastRow.set('Date', new Date().toLocaleDateString()); // Optional: update date to 'now'

    await lastRow.save();
    ctx.reply(`✏️ Updated last entry!\nFrom: ${oldDetails}\nTo: ${newItem} ($${newAmount}) in ${newCategory}`);
  } catch (e) {
    console.error(e);
    ctx.reply('❌ Failed to edit the last item.');
  }
});

bot.command('show', async (ctx) => {
  const parts = ctx.message.text.split(' ');
  
  // Validate input: /show 20-01-2026 28-01-2026
  if (parts.length < 3) {
    return ctx.reply('⚠️ Usage: /show DD-MM-YYYY DD-MM-YYYY\nExample: /show 01-01-2026 31-01-2026');
  }

  const startStr = parts[1];
  const endStr = parts[2];

  // Helper to parse the user's DD-MM-YYYY input into a JS Date
  const parseInput = (str) => {
    const [d, m, y] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const startDate = parseInput(startStr);
  const endDate = parseInput(endStr);
  endDate.setHours(23, 59, 59, 999); // Ensure it includes the whole end day

  if (isNaN(startDate) || isNaN(endDate)) {
    return ctx.reply('⚠️ Invalid format. Please use DD-MM-YYYY.');
  }

  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    // Filter rows based on the range
    const filtered = rows.filter(row => {
      // row.get('Date') will return the string saved by .toLocaleDateString()
      const rowDate = new Date(row.get('Date'));
      return rowDate >= startDate && rowDate <= endDate;
    });

    if (filtered.length === 0) {
      return ctx.reply(`📭 No items found between ${startStr} and ${endStr}.`);
    }

    // Build the report string
    let report = `📊 *Transactions: ${startStr} to ${endStr}*\n\n`;
    let total = 0;

    filtered.forEach(row => {
      const amount = parseFloat(row.get('Amount'));
      // Format each line: Date | Item: $Amount (Category)
      report += `📅 ${row.get('Date')} | *${row.get('Item')}*: $${amount} _(${row.get('Category')})_\n`;
      total += amount;
    });

    report += `\n💰 *Range Total: $${total.toFixed(2)}*`;

    ctx.replyWithMarkdown(report);
  } catch (e) {
    console.error(e);
    ctx.reply('❌ Error generating report. Ensure your sheet has Date, Item, Amount, and Category headers.');
  }
});

bot.on('text', async (ctx) => {
  const parts = ctx.message.text.split(' ');
  const item = parts[0];
  const amount = parseFloat(parts[1]);
  const category = parts[2] ? parts[2].charAt(0).toUpperCase() + parts[2].slice(1).toLowerCase() : 'Other';

  if (!item || isNaN(amount)) {
    return ctx.reply('⚠️ Use format: Item Amount (e.g., Pizza 12.50)');
  }

  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      Date: new Date().toISOString().split('T')[0],
      Item: item,
      Amount: amount,
      Category: category
    });
    ctx.reply(`✅ Logged in ${category}: ${item} ($${amount})`);
  } catch (e) {
    console.error(e);
    ctx.reply('❌ Failed to save.');
  }
});

bot.launch();
console.log("Bot is running...");

// This creates a simple server to satisfy Render's health check
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is alive and running!\n');
});

// Render provides a PORT environment variable automatically
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});