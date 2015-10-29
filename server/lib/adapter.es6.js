/**
 * This class relay TelegramService.Messages to D.Channels and D.Messages, and vice versa
 */
TelegramService.Adapter = {

  /**
   * upon startup, it will
   *   1) update all existing chats
   *   2) observe new outing message from dashboard to send to telegram
   *   3) observe new incoming message from telgram (via TelegramService.Messages)
   */
  startup() {
    let self = this;
    console.log("[TelegramService.Adapter] startup");
    self._startObserveNew();
    self._observeOutingMessages();
  },

  _observeOutingMessages() {
    let self = this;
    D.Messages.find({inOut: D.Messages.InOut.OUTING}, {sort: {timestamp: 1}}).observe({
      adapter: self,
      added: function(message) {
        this.adapter._handleOutingMessage(message);
      }
    });
  },

  _encodeMessage(text) {
    // TODO: encode text. e.g. emoji
    return text;
  },

  _handleOutingMessage(dMessage) {
    console.log("[TelegramServie.Adapter] handleOutingMessage: ", JSON.stringify(dMessage));
    let self = this;
    let dChannel = D.Channels.findOne(dMessage.channelId);
    if (dChannel.category !== D.Channels.Categories.TELEGRAM) {
      return;
    }
    let chat = TelegramService.Chats.findOne({identifier: dChannel.identifier});
    let bot = TelegramService.Bots.findOne({telegramId: chat.botId});
    let content = self._encodeMessage(dMessage.content);
    let result = bot.sendMessage({
      chat_id: chat.id,
      text: content
    });
    if (result) {
      D.Messages.remove({_id: dMessage._id});
    }
  },

  /**
   * Whenever new messages come in, TelegramService.Chat will get updated.
   * We observe the change on TelegramService.Chat, and then do an update
   * to sync D.Messages/Channels from TelegramService.Messages/Chats
   */
  _startObserveNew() {
    let self = this;
    TelegramService.Chats.find().observe({
      adapter: self,

      added(chat) {
        this.adapter._updateChat(chat);
      },

      changed(newChat, oldChat) {
        this.adapter._updateChat(newChat);
      }
    });
  },

  _dChannelSelector(chat) {
    return {category: D.Channels.Categories.TELEGRAM, identifier: chat.identifier};
  },

  _upsertDChannel(chat) {
    let self = this;
    let dChannelSelector = self._dChannelSelector(chat);
    let options = {
      $set: {
        'category': D.Channels.Categories.TELEGRAM,
        'identifier': chat.identifier,
        'extra.chat_id': chat.id,
        'extra.type': chat.type,
        'extra.first_name': chat.first_name,
        'extra.last_name': chat.last_name
      },
      $setOnInsert: {
        'extra.lastMessageTS': 0
      }
    }
    D.Channels.upsert(dChannelSelector, options);
    return self._dChannel(chat);
  },

  _dChannel(chat) {
    let channelSelector = this._dChannelSelector(chat);
    return D.Channels.findOne(channelSelector);
  },

  _decodeText(message) {
    // TODO: format the message, if necessary
    return message.text;
  },

  _insertMessage(message, dChannelId) {
    console.log("[TelegramService.Adapater] insertMessage: ", JSON.stringify(message));
    let self = this;

    let autoReplyContent = D.Configs.get(D.Configs.Keys.AUTO_RESPONSE_MESSAGE);
    let userName = message.from.first_name;
    let inOut = !!message.update_id? D.Messages.InOut.IN: D.Messages.InOut.OUT; // IN message is from webhook, trigger, so will have an update_id
    let isAutoReply = message.text === autoReplyContent;
    let timestamp = message.date;
    let decodedText = self._decodeText(message);

    let options = {
      channelId: dChannelId,
      content: decodedText,
      inOut: inOut,
      isAutoReply: isAutoReply,
      userName: userName,
      timestamp: timestamp
    }
    D.Messages.insert(options);

    let channelOptions = {
      $set: {
        lastMessage: {
          inOut: inOut,
          isAutoReply: isAutoReply,
          timestamp: timestamp
        }
      },
      $max: {'extra.lastMessageTS': timestamp}
    }
    D.Channels.update(dChannelId, channelOptions);
  },

  _updateChat(chat) {
    let self = this;
    console.log("[TelegramService.Adapter] updating chat: ", JSON.stringify(chat));

    let dChannel = self._upsertDChannel(chat);
    chat.findMessages({date: {$gt: dChannel.extra.lastMessageTS}}).forEach(function(message) {
      self._insertMessage(message, dChannel._id);
    });
  }
}
