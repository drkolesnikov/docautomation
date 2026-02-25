import { Bot, InputFile } from 'grammy';
import type { InlineKeyboardMarkup } from 'grammy/types';
import type Database from 'better-sqlite3';
import { isSubscribed, getSubscription } from './db.js';
import { getDocType, setDocType } from './session.js';
import { generateDocument } from './generation.js';
import {
  sendSubscribeInvoice,
  handlePreCheckout,
  handleSuccessfulPayment,
} from './payments.js';
import { DOC_TYPE_CONFIG } from '../../src/prompts/index.js';
import type { DocTypeKey } from '../../src/prompts/index.js';

const DOC_TYPE_KEYS: DocTypeKey[] = ['pervichniy', 'povtorniy', 'vk', 'msek'];

function docTypeKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      DOC_TYPE_KEYS.map((key) => ({
        text: DOC_TYPE_CONFIG[key].label,
        callback_data: `doctype:${key}`,
      })),
    ],
  };
}

function formatExpiryDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function registerHandlers(bot: Bot, db: Database.Database): void {
  const adminId = process.env.ADMIN_USER_ID
    ? parseInt(process.env.ADMIN_USER_ID, 10)
    : null;

  // ─── /start ───────────────────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    await ctx.reply(
      'Добро пожаловать в ПНД.doc!\n\n' +
        'Отправляйте свободные заметки о пациентах — бот сформирует структурированный клинический документ.\n\n' +
        'Выберите тип документа:',
      { reply_markup: docTypeKeyboard() }
    );
  });

  // ─── /help ────────────────────────────────────────────────────────────────
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Доступные команды:\n\n' +
        '/start — начать работу\n' +
        '/doctype — выбрать тип документа\n' +
        '/subscribe — оформить подписку\n' +
        '/status — проверить статус подписки\n' +
        '/help — эта справка\n\n' +
        'После выбора типа документа просто отправьте заметки о пациенте — бот сгенерирует готовый документ.'
    );
  });

  // ─── /doctype ─────────────────────────────────────────────────────────────
  bot.command('doctype', async (ctx) => {
    await ctx.reply('Выберите тип документа:', {
      reply_markup: docTypeKeyboard(),
    });
  });

  // ─── /subscribe ───────────────────────────────────────────────────────────
  bot.command('subscribe', async (ctx) => {
    await sendSubscribeInvoice(ctx);
  });

  // ─── /status ──────────────────────────────────────────────────────────────
  bot.command('status', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const row = getSubscription(db, userId);
    const nowSec = Math.floor(Date.now() / 1000);

    if (!row || row.paid_until <= nowSec) {
      await ctx.reply(
        '❌ Подписка не активна.\n\nИспользуйте /subscribe для оформления.'
      );
    } else {
      await ctx.reply(
        `✅ Подписка активна до ${formatExpiryDate(row.paid_until)}.`
      );
    }
  });

  // ─── Inline keyboard: doc type selection ──────────────────────────────────
  bot.callbackQuery(/^doctype:(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return await ctx.answerCallbackQuery();

    const key = ctx.match[1] as DocTypeKey;
    if (!DOC_TYPE_KEYS.includes(key)) return await ctx.answerCallbackQuery();

    setDocType(userId, key);
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `Выбран тип: ${DOC_TYPE_CONFIG[key].label}.\n\nОтправьте заметки о пациенте.`
    );
  });

  // ─── Telegram Stars payment handlers ─────────────────────────────────────
  bot.on('pre_checkout_query', async (ctx) => {
    await handlePreCheckout(ctx);
  });

  bot.on('message:successful_payment', async (ctx) => {
    await handleSuccessfulPayment(ctx, db);
  });

  // ─── Main message handler ─────────────────────────────────────────────────
  bot.on('message:text', async (ctx) => {
    // Ignore commands — they're handled above
    if (ctx.message.text.startsWith('/')) return;

    const userId = ctx.from?.id;
    if (!userId) return;

    const isAdmin = adminId !== null && userId === adminId;

    if (!isAdmin && !isSubscribed(db, userId)) {
      await ctx.reply(
        '❌ Для использования бота необходима активная подписка.\n\n' +
          'Используйте /subscribe для оформления.'
      );
      return;
    }

    const docType = getDocType(userId);
    const inputText = ctx.message.text;

    // Send initial "generating" message
    const statusMsg = await ctx.reply('Генерирую документ... ⌛');
    const chatId = ctx.chat.id;
    const msgId = statusMsg.message_id;

    let lastEdited = '';
    let lastEditTime = Date.now();
    const EDIT_INTERVAL_MS = 2000;
    const SAFE_CHAR_LIMIT = 3900; // leave headroom below Telegram's 4096 limit

    // Periodic edit interval — updates message with streamed content
    const editInterval = setInterval(async () => {
      if (!lastEdited) return;
      const now = Date.now();
      if (now - lastEditTime < EDIT_INTERVAL_MS) return;
      lastEditTime = now;

      const preview =
        lastEdited.length > SAFE_CHAR_LIMIT
          ? lastEdited.slice(0, SAFE_CHAR_LIMIT) + '\n\n...'
          : lastEdited;

      try {
        await bot.api.editMessageText(chatId, msgId, preview);
      } catch {
        // Ignore edit errors (e.g. message not modified)
      }
    }, 500);

    const abortController = new AbortController();

    try {
      const result = await generateDocument(
        docType,
        inputText,
        (accumulated) => {
          lastEdited = accumulated;
        },
        abortController.signal
      );

      clearInterval(editInterval);

      const finalText = result.truncated
        ? result.text +
          '\n\n⚠️ Документ может быть неполным (превышен лимит токенов).'
        : result.text;

      if (finalText.length > 4000) {
        // Send as file
        await bot.api.deleteMessage(chatId, msgId).catch(() => undefined);

        const filename = `${DOC_TYPE_CONFIG[docType].label.replace(/\s+/g, '_')}.txt`;
        const fileBuffer = Buffer.from(finalText, 'utf-8');
        await ctx.replyWithDocument(new InputFile(fileBuffer, filename), {
          caption: `📄 ${DOC_TYPE_CONFIG[docType].label}`,
        });
      } else {
        await bot.api
          .editMessageText(chatId, msgId, finalText)
          .catch(async () => {
            await ctx.reply(finalText);
          });
      }

      // Show doc type switcher after generation
      await ctx.reply('Сменить тип документа:', {
        reply_markup: docTypeKeyboard(),
      });
    } catch (err) {
      clearInterval(editInterval);
      abortController.abort();

      const errorText =
        err instanceof Error && err.name === 'AbortError'
          ? 'Генерация отменена.'
          : '❌ Произошла ошибка при генерации документа. Попробуйте ещё раз.';

      await bot.api
        .editMessageText(chatId, msgId, errorText)
        .catch(() => ctx.reply(errorText));
    }
  });
}
