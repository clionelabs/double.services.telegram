/**
 * Telegram Messages
 *
 * @property {String} chat_id Link to TelegramService.Chats
 * ...... other properties refer to Telegram Message Object
 */
TelegramService.Messages = new Meteor.Collection("d-services-telegram-messages");

/**
 * Breakdown the Telegram Message object and store it with our own data structure
 * @param Optional {String} updateId Only exists for incoming message, from webhook
 */
TelegramService.Messages.handleNew = function(message, botId, updateId) {
  let chatIdentifier = TelegramService.Chats.identifier(botId, message.chat.id);
  let chatSelector = {identifier: chatIdentifier};
  let chatContent = _.extend({}, message.chat, {
    identifier: chatIdentifier,
    botId: botId
  });

  TelegramService.Chats.upsert(chatSelector, {
    $set: chatContent,
  });
  TelegramService.Chats.update(chatSelector, {
    $max: {'lastMessageTS': message.date}
  });

  let newMessage = _.omit(message, 'chat');
  if (updateId) {
    _.extend(newMessage, {
      update_id: updateId
    });
  }
  _.extend(newMessage, {
    chatIdentifier: chatIdentifier,
    botId: botId,
    chatId: message.chat.id
  });

  TelegramService.Messages.insert(newMessage);
}
