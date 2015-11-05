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
    // encode emoji symbol to unicode
    let encodedText = text.replace(/:(.*?):/g, function(match, p1) {
      let ret = match;
      if (emojiOneSupportedList[p1]) {
        let unicode = emojiOneSupportedList[p1]['unicode'];
        let converted = String.fromCodePoint('0x' + unicode);
        ret = converted;
      }
      console.log("[encodeText]: ", p1, ret);
      return ret;
    });
    return encodedText;
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
        'extra.last_name': chat.last_name,
        'extra.title': chat.title
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

  _fileLink(botId, fileId) {
    let link = Router.routes.file.url({botId: botId, fileId: fileId});
    return link;
  },

  _decodeText(message) {
    // Ref: Telegram message format: https://core.telegram.org/bots/api#message
    if (message.audio) {
      let fileId = message.audio.file_id;
      let link = this._fileLink(message.botId, fileId);
      return `[Audio] ${link}`;

    } else if (message.document) {
      let fileId = message.document.file_id;
      let fileName = message.document.file_name;
      let link = this._fileLink(message.botId, fileId);
      return `[Document] ${fileName} - ${link}`;

    } else if (message.photo) {
      // message.photo is an array of photos, with different resolutions
      // here, we just return the link for the highest resolution one
      let lastPhoto = _.last(message.photo);
      let fileId = lastPhoto.file_id;
      let link = this._fileLink(message.botId, fileId);
      return `[Photo] ${link}`;

    } else if (message.sticker) {
      let fileId = message.sticker.file_id;
      let link = this._fileLink(message.botId, fileId);
      return `[Sticker] ${link}`;

    } else if (message.video) {
      let fileId = message.video.file_id;
      let link = this._fileLink(message.botId, fileId);
      return `[Video] ${link}`;

    } else if (message.voice) {
      let fileId = message.voice.file_id;
      let link = this._fileLink(message.botId, fileId);
      return `[Voice] ${link}`;

    } else if (message.contact) {
      let content = JSON.stringify(message.contact); // TODO: format this better
      return `[Contact] ${content}`;

    } else if (message.location) {
      let content = JSON.stringify(message.location); // TODO: format this better
      return `[Location] ${content}`;

    } else if (message.new_chat_participant) {
      let content = JSON.stringify(message.new_chat_participant); // TODO: format this better
      return `[New Participant] ${content}`;

    } else if (message.left_chat_participant) {
      let content = JSON.stringify(message.left_chat_participant); // TODO: format this better
      return `[Participant Left] ${content}`;

    } else if (message.new_chat_title) {
      let content = message.new_chat_title;
      return `[New Chat Title] ${content}`;

    } else if (message.new_chat_photo) {
      let lastPhoto = _.last(message.new_chat_photo);
      let fileId = lastPhoto.file_id;
      let link = this._fileLink(message.botId, fileId);
      return `[New Chat Photo] ${link}`;

    } else if (message.delete_chat_photo) {
      return '[Delete Chat Photo]';

    } else if (message.group_chat_created) {
      return '[Group Chat Created]';

    } else if (message.text) { // text message
      return message.text;
    } else {
      let content = JSON.stringify(message);
      return `[Unhandled Message Type] ${content}`;
    }
  },

  _insertMessage(message, dChannelId) {
    console.log("[TelegramService.Adapater] insertMessage: ", JSON.stringify(message));
    let self = this;

    let autoReplyContent = D.Configs.get(D.Configs.Keys.AUTO_RESPONSE_MESSAGE);
    let userName = message.from.first_name;
    let inOut = !!message.update_id? D.Messages.InOut.IN: D.Messages.InOut.OUT; // IN message is from webhook, trigger, so will have an update_id
    let isAutoReply = message.text === autoReplyContent;
    let timestamp = message.date * 1000; // convert to ms
    let decodedText = self._decodeText(message);

    let options = {
      channelId: dChannelId,
      content: decodedText,
      inOut: inOut,
      isAutoReply: isAutoReply,
      userName: userName,
      timestamp: timestamp,
      extra: {
        message_id: message.message_id // telegram specific message_id
      }
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
      $max: {
        'extra.lastMessageTS': timestamp
      }
    }
    D.Channels.update(dChannelId, channelOptions);
  },

  _updateChat(chat) {
    let self = this;
    console.log("[TelegramService.Adapter] updating chat: ", JSON.stringify(chat));

    let dChannel = self._upsertDChannel(chat);
    let afterDate = dChannel.extra.lastMessageTS / 1000;

    // Note: incoming messages could share the same date, e.g. when users send multiple photos at the same time
    // so we have to select messages with $gte, and do a secondary check on the message_id
    chat.findMessages({date: {$gte: afterDate}}).forEach(function(message) {
      let existed = !!D.Messages.findOne({
        timestamp: dChannel.extra.lastMessageTS,
        'extra.message_id': message.message_id
      });
      if (!existed) {
        self._insertMessage(message, dChannel._id);
      }
    });
  }
}
