/**
 * Webhook endpoint, expected to be triggered by telegram server when receiving new messages
 */
Router.route('webhook', {
  path: '/webhook/:_id',

  where: 'server',

  action: function() {
    let id = this.params._id;

    // log
    TelegramService.WebhookTriggers.insert({
      botId: id,
      requestBody: this.request.body,
      createdAt: moment().valueOf
    });

    let bot = TelegramService.Bots.findOne(id);
    bot.handleWebhookTrigger(this.request.body);
    this.response.end();
  }
});
