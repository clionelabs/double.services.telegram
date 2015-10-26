TelegramService.Adapter = {

  startup() {
    let self = this;
    console.log("[TelegramService.Adapter] startup");
    self._updateAllChats();
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
    let chat = TelegramService.Chats.findOne({id: dChannel.extra.chat_id});
    let bot = TelegramService.Bots.findOne({telegramId: chat.telegramId});
    let content = self._encodeMessage(dMessage.content);
    let result = bot.sendMessage({
      chat_id: chat.id,
      text: content
    });
    if (result) {
      D.Messages.remove({_id: dMessage._id});
    }
  },

  _startObserveNew() {
    let self = this;
    TelegramService.Chats.find().observe({
      adapter: self,
      changed(newChat, oldChat) {
        this.adapter._updateChat(newChat);
      }
    });
  },

  _updateAllChats() {
    let self = this;
    TelegramService.Chats.find().forEach(function(chat) {
      self._updateChat(chat);
    });
  },

  _dChannelSelector(chat) {
    return {category: D.Channels.Categories.TELEGRAM, identifier: chat.id};
  },

  _upsertDChannel(chat) {
    let self = this;
    let dChannelSelector = self._dChannelSelector(chat);
    let options = {
      $set: {
        'category': D.Channels.Categories.TELEGRAM,
        'identifier': chat.id,
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

    TelegramService.Messages.find({date: {$gt: dChannel.extra.lastMessageTS}}).forEach(function(message) {
      self._insertMessage(message, dChannel._id);
    });
  }
}
