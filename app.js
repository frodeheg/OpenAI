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
      this.log('First time running so creating unique UserID');
      this.randomName = `${Math.random()}-${Math.random()}-${Math.random()}-${Math.random()}`;
      this.homey.settings.set('UserID', this.randomName);
    }

    this.prefix = this.homey.settings.get('prefix');
    if (this.prefix === null) {
      this.log('First time running so setting default prefix');
      this.prefix = this.homey.__('settings.defaultPrefix');
      this.homey.settings.set('prefix', this.prefix);
    }

    this.split = this.homey.settings.get('split');
    if (this.split === null) {
      this.log('First time running so setting default split');
      this.split = 200;
      this.homey.settings.set('split', this.split);
    }

    this.homey.settings.on('set', (setting) => {
      if (setting === 'APIKey') {
        this.configuration = new Configuration({
          apiKey: this.homey.settings.get('APIKey'),
        });
      }
    });

    this.prompt = this.prefix;
    this.ongoing = false;
    this.prevTime = new Date();

    this.configuration = new Configuration({
      apiKey: this.homey.settings.get('APIKey'),
    });
    this.openai = new OpenAIApi(this.configuration);

    // Simple flows flocard
    const askQuestionActionSimple = this.homey.flow.getActionCard('ask-chatgpt-a-question-simple');
    askQuestionActionSimple.registerRunListener(async (args, state) => {
      await this.askQuestion(args.Question);
    });
  }

  splitIntoSubstrings(str, maxLength) {
    const substrings = [];
    while (str.length > 0) {
      let substr = str.substring(0, maxLength);
      const lastSpaceIndex = (str.length <= maxLength) ? maxLength
        : substr.lastIndexOf(' ') + 1;
      if (lastSpaceIndex !== -1) {
        // If there is a space within the first maxLength characters, split the string at that space
        substr = substr.substring(0, lastSpaceIndex);
      }
      str = str.substring(substr.length);

      substr = substr.replace(/(\r\n|\n|\r)/gm, ' ');
      substrings.push(substr);
    }
    return substrings;
  }

  async askQuestion(question) {
    if (this.ongoing) {
      throw new Error('Still working on previous request');
    }
    this.ongoing = true;
    let fullText = '';
    let pendingText = '';
    try {
      const now = new Date();
      if (now - this.prevTime > (1000 * 60 * 10)) {
        // Forget the conversation after 10 minutes
        this.log('Forgetting the conversation');
        this.prompt = this.prefix;
      }
      this.prevTime = now;
      this.prompt += question;
      let finished = false;
      while (!finished) {
        const completion = await this.openai.createCompletion({
          model: 'text-davinci-003',
          prompt: this.prompt,
          temperature: 0.6,
          user: this.randomName,
          max_tokens: 10,
        });

        finished = completion.data.choices[0].finish_reason !== 'length'; // === 'stop'
        let response = pendingText + completion.data.choices[0].text;
        const lastSpace = response.lastIndexOf(' ');
        if (finished || (lastSpace === -1)) {
          pendingText = '';
        } else {
          pendingText = response.substring(lastSpace);
          response = response.substring(0, lastSpace);
        }
        const splitText = this.splitIntoSubstrings(response, this.homey.settings.get('split'));
        for (let idx = 0; idx < splitText.length; idx++) {
          const responseToken = { ChatGPT_Response: splitText[idx] };
          const responseTrigger = this.homey.flow.getTriggerCard('chatGPT-answers');
          await responseTrigger.trigger(responseToken);
          this.prompt += splitText[idx];
          fullText += splitText[idx];
        }
      }
      const completeToken = { ChatGPT_FullResponse: fullText };
      const completeTrigger = this.homey.flow.getTriggerCard('chatGPT-complete');
      await completeTrigger.trigger(completeToken);
    } catch (err) {
      throw new Error(`Error: ${err}`);
    } finally {
      this.ongoing = false;
    }
    return { ChatGPT_Response: fullText };
  }

}

module.exports = MyApp;
