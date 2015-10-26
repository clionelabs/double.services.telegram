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
TelegramService.Messages.handleNew = function(message, telegramId, updateId) {
  let newMessage = _.omit(message, 'chat');

  if (updateId) {
    _.extend(newMessage, {
      update_id: updateId
    });
  }
  _.extend(newMessage, {
    chat_id: message.chat.id
  });

  let selector = {id: message.chat.id};
  let chatContent = _.extend({}, message.chat, {telegramId: telegramId});
  TelegramService.Chats.upsert(selector, {
    $set: chatContent,
  });
  TelegramService.Chats.update(selector, {
    $max: {'lastMessageTS': message.date}
  });

  TelegramService.Messages.insert(newMessage);
}
