const { Bot, Keyboard } = require('grammy');
const session = require('./session');
const leadsRepo = require('../leadsRepo');

const MAX_LEN = leadsRepo.MAX_FIELD_LENGTH;

const contactKeyboard = new Keyboard().requestContact('Поделиться номером').resized().oneTime();
const confirmKeyboard = new Keyboard().text('Отправить').text('Заполнить заново').resized().oneTime();
const removeKeyboard = { remove_keyboard: true };

function summarize(draft) {
  return `Проверьте заявку:\n\nИмя: ${draft.name}\nКонтакт: ${draft.contact}\nЗапрос: ${draft.request}\n\nВсё верно?`;
}

function createBot(token) {
  const bot = new Bot(token);

  async function startFlow(ctx) {
    session.setSession(ctx.from.id, 'name', {});
    await ctx.reply('Здравствуйте! Я помогу оформить заявку в агентство.\n\nКак вас зовут?', {
      reply_markup: removeKeyboard,
    });
  }

  bot.command('start', startFlow);

  bot.command('cancel', async (ctx) => {
    session.clearSession(ctx.from.id);
    await ctx.reply('Диалог отменён. Напишите /start, чтобы начать заново.', { reply_markup: removeKeyboard });
  });

  bot.on('message', async (ctx) => {
    const tgUserId = ctx.from.id;
    const current = session.getSession(tgUserId);

    if (!current) {
      await ctx.reply('Не понял сообщение вне сценария. Напишите /start, чтобы оформить заявку.');
      return;
    }

    if (current.step === 'name') {
      const text = (ctx.message.text || '').trim();
      if (!text) {
        await ctx.reply('Имя не должно быть пустым. Как вас зовут?');
        return;
      }
      if (text.length > MAX_LEN) {
        await ctx.reply(`Слишком длинно (максимум ${MAX_LEN} символов). Как вас зовут?`);
        return;
      }
      session.setSession(tgUserId, 'contact', { ...current.draft, name: text });
      await ctx.reply('Приятно познакомиться! Оставьте контакт для связи — можно поделиться номером кнопкой или написать вручную.', {
        reply_markup: contactKeyboard,
      });
      return;
    }

    if (current.step === 'contact') {
      let contact;
      if (ctx.message.contact) {
        const phone = ctx.message.contact.phone_number;
        contact = phone.startsWith('+') ? phone : '+' + phone;
      } else {
        contact = (ctx.message.text || '').trim();
      }
      if (!contact) {
        await ctx.reply('Нужен контакт для связи — номер или любой другой способ с вами связаться.');
        return;
      }
      if (contact.length > MAX_LEN) {
        await ctx.reply(`Слишком длинно (максимум ${MAX_LEN} символов). Укажите контакт ещё раз.`);
        return;
      }
      session.setSession(tgUserId, 'request', { ...current.draft, contact });
      await ctx.reply('Опишите, пожалуйста, что вас интересует.', { reply_markup: removeKeyboard });
      return;
    }

    if (current.step === 'request') {
      const text = (ctx.message.text || '').trim();
      if (!text) {
        await ctx.reply('Запрос не должен быть пустым. Опишите, что вас интересует.');
        return;
      }
      if (text.length > MAX_LEN) {
        await ctx.reply(`Слишком длинно (максимум ${MAX_LEN} символов). Опишите короче.`);
        return;
      }
      const draft = { ...current.draft, request: text };
      session.setSession(tgUserId, 'confirm', draft);
      await ctx.reply(summarize(draft), { reply_markup: confirmKeyboard });
      return;
    }

    if (current.step === 'confirm') {
      const text = (ctx.message.text || '').trim();

      if (text === 'Отправить') {
        const draft = current.draft;
        leadsRepo.createLead({
          name: draft.name,
          contact: draft.contact,
          request: draft.request,
          source: 'bot',
          tgUserId,
          tgUsername: ctx.from.username || null,
        });
        session.clearSession(tgUserId);
        await ctx.reply('Спасибо! Заявка принята, мы скоро свяжемся с вами.', { reply_markup: removeKeyboard });
        return;
      }

      if (text === 'Заполнить заново') {
        session.setSession(tgUserId, 'name', {});
        await ctx.reply('Хорошо, начнём заново. Как вас зовут?', { reply_markup: removeKeyboard });
        return;
      }

      await ctx.reply('Нажмите «Отправить» или «Заполнить заново».', { reply_markup: confirmKeyboard });
    }
  });

  bot.catch((err) => {
    console.error('Bot error for update', err.ctx?.update?.update_id, err.error);
  });

  return bot;
}

module.exports = { createBot };
