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
TelegramService.Messages.handleNew = function(message, updateId) {
  let newMessage = _.omit(message, 'chat');

  if (updateId) {
    _.extend(newMessage, {
      update_id: updateId
    });
  }
  _.extend(newMessage, {
    chat_id: message.chat.id
  });

  TelegramService.Chats.upsert({id: message.chat.id}, {
    $set: message.chat
  });

  TelegramService.Messages.insert(newMessage);
}
