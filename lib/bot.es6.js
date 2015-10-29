/**
 * Telegram Bot
 *
 * token is input through web interface, and then the remaining properties will be
 * automatically populated by calling the getMe() api method of telegram
 *
 * @property {String} token
 * @property {String} telegramId
 * @property {String} telegramUsername
 */
TelegramService.Bots = new Meteor.Collection("d-services-telegram-bots", {
  transform: (doc) => {
    return _.extend(doc, TelegramService.Bot);
  }
});

let telegramAPI = Meteor.npmRequire("telegram-bot-api");

TelegramService.Bot = {
  _apiInstance: null,

  /**
   * Get the api instance
   */
  _api() {
    let self = this;
    if (!self._apiInstance) {
      self._apiInstance = new telegramAPI({
        token: this.token
      });
    }
    return self._apiInstance;
  },

  /**
   * Call telegram api, and log the request/response
   */
  _apiCall(method, params) {
    let self = this;
    let api = self._api();
    let apiRequest = {
      method: method,
      params: params
    };

    let apiResult;
    let apiError;
    let ret;
    try {
      let wrappedCall = Meteor.wrapAsync(api[method], self);
      if (params) {
        apiResult = wrappedCall(params);
      } else {
        apiResult = wrappedCall();
      }
      ret = {ok: true, result: apiResult};
    } catch (ex) {
      console.error("[TelegramService.Bots] _apiCall error: ", JSON.stringify(ex));
      apiError = ex;
      ret =  {ok: false}
    }
    TelegramService.Requests.insert({
      botId: self._id,
      request: apiRequest,
      result: apiResult,
      error: apiError,
      createdAt: moment().valueOf()
    });
    return ret;
  },

  /**
   * Update meta data of bot, e.g. username, id
   */
  updateMeta() {
    let self = this;
    let ret = self._apiCall('getMe', null);
    if (ret.ok) {
      let data = ret.result;
      TelegramService.Bots.update(self._id, {$set: {
        telegramId: data.id,
        telegramUsername: data.username
      }});
    }
  },

  /**
   * Set webhook of receiving new messages
   *
   * @return {Boolean} successful or not
   */
  setWebhook() {
    let self = this;
    let url = Router.routes.webhook.url({_id: self._id});
    let ret = self._apiCall('setWebhook', {url: url});
    return ret.ok;
  },

  /**
   * Handle telegram webhook trigger
   * @param {Object} requestBody Request.body of the webhook request
   */
  handleWebhookTrigger(requestBody) {
    let self = this;
    let updateId = requestBody.update_id;
    let message = requestBody.message;
    TelegramService.Messages.handleNew(message, self.telegramId, updateId);
  },

  /**
   * Send message to telegram server
   *
   * @param {Object} params api parameters
   * @return {Boolean} successful or not
   */
  sendMessage(params) {
    let self = this;
    let ret = self._apiCall('sendMessage', params);
    if (ret.ok) {
      let result = ret.result;
      let message = result; // result of sendMessage api call is a Message object
      TelegramService.Messages.handleNew(message, self.telegramId);
    }
    return ret.ok;
  },

  /**
   * Setup the telegram bot
   *   1) update meta data, e.g. botId and username from telegram
   *   2) setup webhook
   */
  setup() {
    console.log("[TelgramService.Bots] setup: ", this._id);
    this.updateMeta();
    this.setWebhook();
  }
}
