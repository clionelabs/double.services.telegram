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

TelegramService.Bot = {
  API_BASE_URL: 'https://api.telegram.org/bot',
  FILE_BASE_URL: 'https://api.telegram.org/file/bot',

  /**
   * Call telegram api, and log the request/response
   */
  _apiCall(method, params) {
    let self = this;
    let requestURL = self.API_BASE_URL + self.token + '/' + method;

    let apiRequest = {
      method: method,
      params: params
    }
    let apiResult;
    let apiError;
    let ret;
    try {
      apiResult = HTTP.get(requestURL, {params: params});
      ret = apiResult.data;
    } catch (ex) {
      console.error("[TelegramService.Bots] _apiCall error: ", JSON.stringify(ex));
      apiError = ex;
      ret = {ok: false};
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
   * Get download url for a telegram file
   *
   * @param {String} fileId
   */
  getFileDownloadLink(fileId) {
    let self = this;
    let params = {
      file_id: fileId
    };
    let ret = self._apiCall('getFile', params);
    if (ret.ok) {
      let path = ret.result.file_path;
      let fullPath = self.FILE_BASE_URL + self.token + '/' + path;
      return fullPath;
    } else {
      return null;
    }
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
