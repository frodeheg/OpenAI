'use strict';

const Homey = require('homey');
const { Configuration, OpenAIApi } = require('openai');

class MyApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('MyApp has been initialized');
    this.randomName = this.homey.settings.get('UserID');
    if (this.randomName === null) {
      console.log('First time running so creating unique UserID');
      this.randomName = `${Math.random()}-${Math.random()}-${Math.random()}-${Math.random()}`;
      this.homey.settings.set('UserID', this.randomName);
    }

    this.prefix = this.homey.settings.get('prefix');
    if (this.prefix === null) {
      console.log('First time running so setting default prefix');
      this.prefix = this.homey.__('settings.defaultPrefix');
      this.homey.settings.set('prefix', this.prefix);
    }

    this.homey.settings.on('set', (setting) => {
      if (setting === 'APIKey') {
        this.configuration = new Configuration({
          apiKey: this.homey.settings.get('APIKey'),
        });
      }
    });

    this.configuration = new Configuration({
      apiKey: this.homey.settings.get('APIKey'),
    });
    this.openai = new OpenAIApi(this.configuration);

    // Advanced flow flowcard
    const askQuestionAction = this.homey.flow.getActionCard('ask-chatgpt-a-question');
    askQuestionAction.registerRunListener(async (args, state) => {
      const completion = await this.openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `${this.prefix}${args.Question}`,
        temperature: 0.6,
        user: this.randomName,
        max_tokens: 2048,
      });

      const response = completion.data.choices[0].text;
      const filteredResponse = response.replace(/(\r\n|\n|\r)/gm, '');
      const responseToken = { ChatGPT_Response: filteredResponse };
      const responseTrigger = this.homey.flow.getTriggerCard('chatGPT-answers');
      await responseTrigger.trigger(responseToken);
      return responseToken;
    });

    // Simple flows flocard
    const askQuestionActionSimple = this.homey.flow.getActionCard('ask-chatgpt-a-question-simple');
    askQuestionActionSimple.registerRunListener(async (args, state) => {
      const completion = await this.openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `${this.prefix}${args.Question}`,
        temperature: 0.6,
        user: this.randomName,
        max_tokens: 2048,
      });

      const response = completion.data.choices[0].text;
      const filteredResponse = response.replace(/(\r\n|\n|\r)/gm, '');

      const responseTrigger = this.homey.flow.getTriggerCard('chatGPT-answers');
      const responseToken = { ChatGPT_Response: filteredResponse };
      await responseTrigger.trigger(responseToken);
    });
  }

}

module.exports = MyApp;
