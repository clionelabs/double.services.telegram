/**
 * Webhook endpoint, expected to be triggered by telegram server when receiving new messages
 */
Router.route('webhook', {
  path: '/webhook/:_id',

  where: 'server',

  action: function() {
    let botId = this.params._id;

    // log
    TelegramService.WebhookTriggers.insert({
      botId: botId,
      requestBody: this.request.body,
      createdAt: moment().valueOf()
    });

    let bot = TelegramService.Bots.findOne(botId);
    bot.handleWebhookTrigger(this.request.body);
    this.response.end();
  }
});

Router.route('file', {
  path: '/file/:botId/:fileId',

  where: 'server',

  action: function() {
    let botId = parseInt(this.params.botId);
    let fileId = this.params.fileId;

    let bot = TelegramService.Bots.findOne({telegramId: botId});
    let link = bot.getFileDownloadLink(fileId);

    // redirect to external download link
    this.response.writeHead(302, {
      'Location': link
    });
    this.response.end();
  }
});
