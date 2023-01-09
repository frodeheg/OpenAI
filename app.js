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
    this.tokenQueue = [];
    this.canSendToken = true;

    this.configuration = new Configuration({
      apiKey: this.homey.settings.get('APIKey'),
    });
    this.openai = new OpenAIApi(this.configuration);

    // Simple flows flocard
    const askQuestionActionSimple = this.homey.flow.getActionCard('ask-chatgpt-a-question-simple');
    askQuestionActionSimple.registerRunListener(async (args, state) => {
      await this.askQuestion(args.Question);
    });

    // Start next partial answer
    const flushQueueAction = this.homey.flow.getActionCard('flush-queue');
    flushQueueAction.registerRunListener(async (args, state) => {
      this.canSendToken = true;
      return this.sendToken();
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
      if (!(question.endsWith('.')
        || question.endsWith('?')
        || question.endsWith('!'))) {
        question += '.';
      }
      const now = new Date();
      if (now - this.prevTime > (1000 * 60 * 10)) {
        // Forget the conversation after 10 minutes
        this.log('Forgetting the conversation');
        this.prompt = this.prefix;
        this.canSendToken = true;
        this.tokenQueue = [];
      }
      this.prevTime = now;
      this.prompt += question;
      let finished = false;
      while (!finished) {
        const completion = await this.openai.createCompletion({
          model: 'text-davinci-003',
          prompt: this.prompt + pendingText,
          temperature: 0.6,
          user: this.randomName,
          max_tokens: 20,
        });

        finished = completion.data.choices[0].finish_reason !== 'length'; // === 'stop'
        let response = pendingText + completion.data.choices[0].text;
        let splitPos = -1;
        const punctations = ['.', ',', ':', ';'];
        for (let idx = 0; idx < punctations.length; idx++) {
          const dot = punctations[idx];
          const lastDot = response.lastIndexOf(dot);
          if ((lastDot > splitPos) && (lastDot < 200)) {
            splitPos = lastDot;
          }
        }
        if ((splitPos === -1) && (response.length >= +this.homey.settings.get('split'))) {
          splitPos = +this.homey.settings.get('split');
        }
        if (finished) {
          pendingText = '';
        } else if (splitPos === -1) {
          pendingText = response;
          response = '';
        } else {
          pendingText = response.substring(splitPos + 1);
          response = response.substring(0, splitPos + 1);
        }
        const splitText = this.splitIntoSubstrings(response, this.homey.settings.get('split'));
        for (let idx = 0; idx < splitText.length; idx++) {
          await this.sendToken(splitText[idx].replace(/^(\.|\?| )+/gm, ''));
          console.log(`Delsvar: ${splitText[idx]}`);
          this.prompt += splitText[idx];
          fullText += splitText[idx];
        }
      }
      const completeToken = { ChatGPT_FullResponse: fullText };
      const completeTrigger = this.homey.flow.getTriggerCard('chatGPT-complete');
      console.log(`Fullt svar: ${fullText}`);
      // console.log(`Token: ${this.prompt} ||| ${pendingText}`);
      await completeTrigger.trigger(completeToken);
    } catch (err) {
      const errText = `Error: ${err}`;
      await this.sendToken(errText);
      const completeToken = { ChatGPT_FullResponse: errText };
      const completeTrigger = this.homey.flow.getTriggerCard('chatGPT-complete');
      await completeTrigger.trigger(completeToken);
      throw new Error(errText);
    } finally {
      this.ongoing = false;
    }
    return { ChatGPT_Response: fullText.replace(/^(\.|\?| )+/gm, '') };
  }

  async sendToken(token = undefined) {
    if (token !== undefined) {
      this.tokenQueue.push(token);
    }
    if (this.tokenQueue.length === 0) {
      return Promise.reject(new Error('There are no more partial answers'));
    }
    if (this.canSendToken) {
      this.canSendToken = false;
      const responseToken = { ChatGPT_Response: this.tokenQueue.shift() };
      const responseTrigger = this.homey.flow.getTriggerCard('chatGPT-answers');
      responseTrigger.trigger(responseToken);
    }
    return Promise.resolve();
  }

}

module.exports = MyApp;
