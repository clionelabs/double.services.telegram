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
      createdAt: moment().valueOf
    });

    let bot = TelegramService.Bots.findOne(botId);
    bot.handleWebhookTrigger(this.request.body);
    this.response.end();
  }
});
