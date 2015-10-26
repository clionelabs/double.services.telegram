let setupIndexes = function() {
  TelegramService.Messages._ensureIndex({
    chat_id: 1,
    id: 1
  });

  TelegramService.Chats._ensureIndex({
    id: 1
  });
};

let setupBots = function() {
  TelegramService.Bots.find().observe({
    added: function(bot) {
      bot.setup();
    },

    removed: function(bot) {
      // TODO handle
    }
  });
}

Meteor.startup(function() {
  setupIndexes();

  setupBots();

  TelegramService.Adapter.startup();
});
