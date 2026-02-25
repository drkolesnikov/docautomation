import type { Context } from 'grammy';
import type Database from 'better-sqlite3';
import { extendSubscription } from './db.js';

function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export async function sendSubscribeInvoice(ctx: Context): Promise<void> {
  const priceStars = parseInt(process.env.SUBSCRIPTION_PRICE_STARS ?? '100', 10);
  const days = parseInt(process.env.SUBSCRIPTION_DAYS ?? '30', 10);

  await ctx.replyWithInvoice(
    'Подписка на ПНД.doc бот',
    `${days} дней доступа к автоматизации клинической документации. ` +
      'Отправляйте заметки — получайте готовые структурированные документы.',
    'subscription_30d',
    'XTR',
    [{ label: `${days} дней`, amount: priceStars }]
  );
}

export async function handlePreCheckout(ctx: Context): Promise<void> {
  await ctx.answerPreCheckoutQuery(true);
}

export async function handleSuccessfulPayment(
  ctx: Context,
  db: Database.Database
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const username = ctx.from?.username ?? null;
  const stars = ctx.message?.successful_payment?.total_amount ?? 0;
  const days = parseInt(process.env.SUBSCRIPTION_DAYS ?? '30', 10);

  const newExpiry = extendSubscription(db, userId, username, days, stars);

  await ctx.reply(
    `✅ Подписка активна до ${formatDate(newExpiry)}.\n\n` +
      'Теперь вы можете отправлять заметки о пациентах и получать структурированные документы. ' +
      'Используйте /doctype для выбора типа документа.'
  );
}
