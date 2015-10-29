/**
 * Telegram Chats
 *
 * Properties refer to telegram Chat object
 */
TelegramService.Chats = new Meteor.Collection("d-services-telegram-chats", {
  transform: (doc) => {
    return _.extend(doc, TelegramService.Chat);
  }
});

// Chat is unique with a combination of chatId and telegramId (i.e. telegramId is botId or userId of the account)
TelegramService.Chats.identifier = function(botId, chatId) {
  return `${botId}-${chatId}`;
}

TelegramService.Chat = {
  findMessages(selector={}) {
    let finalSelector = _.extend({}, {
      chatIdentifier: this.identifier
    }, selector);
    return TelegramService.Messages.find(finalSelector);
  }
}
