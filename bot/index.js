const { Telegraf } = require('telegraf');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
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

bot.on('text', async (ctx) => {
  const parts = ctx.message.text.split(' ');
  const item = parts[0];
  const amount = parseFloat(parts[1]);

  if (!item || isNaN(amount)) {
    return ctx.reply('⚠️ Use format: Item Amount (e.g., Pizza 12.50)');
  }

  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      Date: new Date().toISOString().split('T')[0],
      Item: item,
      Amount: amount
    });
    ctx.reply(`✅ Logged: ${item} - $${amount}`);
  } catch (e) {
    console.error("FULL ERROR LOG:", e);
    ctx.reply('❌ Error writing to sheet. Check permissions!');
  }
});

bot.launch();
console.log("Bot is running...");