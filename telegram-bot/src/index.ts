import 'dotenv/config';
import { Bot } from 'grammy';
import { initDb } from './db.js';
import { registerHandlers } from './bot.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set in the environment.');
  process.exit(1);
}

if (!process.env.DEEPSEEK_API_KEY) {
  console.error('Error: DEEPSEEK_API_KEY is not set in the environment.');
  process.exit(1);
}

const dbPath = process.env.DB_PATH ?? './subscriptions.db';
const db = initDb(dbPath);

const bot = new Bot(token);
registerHandlers(bot, db);

console.log('Starting ПНД.doc Telegram bot...');
bot.start({
  onStart: (info) => {
    console.log(`Bot @${info.username} is running.`);
  },
});
