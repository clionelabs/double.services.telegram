let setupIndexes = function() {
  TelegramService.Messages._ensureIndex({
    chatIdentifier: 1
  });

  TelegramService.Chats._ensureIndex({
    identifier: 1
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
