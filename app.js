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
    this.log(`IP: ${this.randomName}`);

    this.configuration = new Configuration({
      apiKey: Homey.env.API_KEY,
    });
    this.openai = new OpenAIApi(this.configuration);

    const askQuestionAction = this.homey.flow.getActionCard('ask-chatgpt-a-question');
    askQuestionAction.registerRunListener(async (args, state) => {
      const completion = await this.openai.createCompletion({
        model: 'text-davinci-003',
        prompt: `Please use moderation when answering: ${args.Question}`,
        temperature: 0.6,
        user: this.randomName,
        max_tokens: 2000,
      });

      const response = completion.data.choices[0].text;
      const filteredResponse = response.replace(/(\r\n|\n|\r)/gm, '');

      return {
        ChatGPT_Response: filteredResponse,
      };
    });
  }

}

module.exports = MyApp;
