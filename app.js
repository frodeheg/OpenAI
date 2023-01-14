'use strict';

const Homey = require('homey');
const { Configuration, OpenAIApi } = require('openai');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STATUS_WAIT_RESPONE = 'Waiting for ChatGPT';
const STATUS_WAIT_QUEUE = 'Queued output not requested';
const STATUS_IDLE = 'Idle';
class MyApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.__status = STATUS_IDLE;
    this.__input = '';
    this.__output = '';
    this.log('MyApp has been initialized');
    this.randomName = this.homey.settings.get('UserID');
    if (this.randomName === null) {
      this.log('First time running so creating unique UserID');
      this.randomName = `${Math.random()}-${Math.random()}-${Math.random()}-${Math.random()}`;
      this.homey.settings.set('UserID', this.randomName);
    }

    this.engine = this.homey.settings.get('engine');
    if (this.engine === null) {
      this.log('First time running so setting default engine');
      this.engine = 'text-davinci-003';
      this.homey.settings.set('engine', this.engine);
    }

    this.maxWait = this.homey.settings.get('maxWait');
    if (this.maxWait === null) {
      this.log('First time running so setting default maxWait');
      this.maxWait = 60 * 5;
      this.homey.settings.set('maxWait', this.maxWait);
    }

    this.maxLength = this.homey.settings.get('maxLength');
    if (this.maxLength === null) {
      this.log('First time running so setting default maxLength');
      this.maxLength = 4000;
      this.homey.settings.set('maxLength', this.maxLength);
    }

    this.temperature = this.homey.settings.get('temperature');
    if (this.temperature === null) {
      this.log('First time running so setting default temperature');
      this.temperature = 0.6;
      this.homey.settings.set('temperature', this.temperature);
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
      this.engine = this.homey.settings.get('engine');
      this.maxWait = this.homey.settings.get('maxWait');
      this.maxLength = this.homey.settings.get('maxLength');
      this.temperature = this.homey.settings.get('temperature');
      this.prefix = this.homey.settings.get('prefix');
      this.split = this.homey.settings.get('split');
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

    // Simple flows flowcard
    const askQuestionActionSimple = this.homey.flow.getActionCard('ask-chatgpt-a-question-simple');
    askQuestionActionSimple.registerRunListener(async (args, state) => {
      await this.askQuestion(args.Question);
    });

    // Advanced flow flowcard
    const askQuestionActionAdvanced = this.homey.flow.getActionCard('ask-chatgpt-a-question-advanced');
    askQuestionActionAdvanced.registerRunListener(async (args, state) => this.askQuestion(args.Question));

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
    let lengthExceeded = false;
    let timeExceeded = false;
    try {
      if (!(question.endsWith('.')
        || question.endsWith('?')
        || question.endsWith('!'))) {
        question += '.';
      }
      let now = new Date();
      if (now - this.prevTime > (1000 * 60 * 10)) {
        // Forget the conversation after 10 minutes
        this.log('Forgetting the conversation');
        this.prompt = this.prefix;
        this.canSendToken = true;
        this.tokenQueue = [];
      }
      this.prevTime = now;
      this.prompt += question;
      if (this.prompt.length > this.maxLength) {
        this.log(`Forgetting what was before ${this.maxLength} characters ago`);
        this.prompt = this.prompt.substr(-(this.maxLength - pendingText.length));
      }
      let finished = false;
      const startTime = new Date(now.getTime() - 1000 * 2);
      let nRequests = 1;
      while (!finished) {
        this.__input = this.prompt + pendingText;
        this.__status = STATUS_WAIT_RESPONE;
        const completion = await this.openai.createCompletion({
          model: this.engine,
          prompt: this.__input,
          temperature: +this.temperature,
          user: this.randomName,
          max_tokens: 40,
        });

        now = new Date();
        const lapsedTime = (now - this.prevTime) / 1000;
        this.__output = completion.data.choices[0].text;
        const newText = this.__output.replace(/[\r\n]/gm, '');
        let response = pendingText + newText;
        lengthExceeded = (fullText.length + response.length) > this.maxLength;
        if (lengthExceeded) response += '. Aborted, length exceeded.';
        timeExceeded = lapsedTime > this.maxWait;
        if (timeExceeded) response += '. Aborted, time exceeded.';
        finished = (completion.data.choices[0].finish_reason !== 'length') // === 'stop'
          || lengthExceeded
          || timeExceeded;
        let splitPos = -1;
        const punctations = ['.', ',', ':', ';'];
        for (let idx = 0; idx < punctations.length; idx++) {
          const dot = punctations[idx];
          const lastDot = response.lastIndexOf(dot);
          if ((lastDot > splitPos) && (lastDot < this.split)) {
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
          this.log(`Partial answer: ${splitText[idx]}`);
          this.prompt += splitText[idx];
          fullText += splitText[idx];
        }
        // Make sure we don't ask more than once per second:
        if (!finished) {
          nRequests++;
          const timeDiff = (now - startTime) / 1000;
          const rate = nRequests / timeDiff;
          if (rate > 0.6) {
            this.log('Query rate exceeded, waiting 1.5 secconds');
            await sleep(1500);
          }
        }
      }
      const completeToken = { ChatGPT_FullResponse: fullText };
      const completeTrigger = this.homey.flow.getTriggerCard('chatGPT-complete');
      this.log(`Full answer: ${fullText}`);
      // this.log(`Token: ${this.prompt} ||| ${pendingText}`);
      await completeTrigger.trigger(completeToken);
      if (timeExceeded) throw new Error('Time limit exceeded');
      if (lengthExceeded) throw new Error('Response length exceeded');
    } catch (err) {
      const errText = `${err}`;
      this.__output = errText;
      this.log('Query resulted in error:');
      this.log(`  engine:      ${this.engine}`);
      this.log(`  temperature: ${this.temperature}`);
      this.log(`  user:        ${this.randomName}`);
      this.log(`  prompt: ${this.prompt + pendingText}`);
      this.log('Error text:');
      this.log(`  ${err}`);
      await this.sendToken(errText);
      const completeToken = { ChatGPT_FullResponse: errText };
      const completeTrigger = this.homey.flow.getTriggerCard('chatGPT-complete');
      await completeTrigger.trigger(completeToken);
      throw new Error(errText);
    } finally {
      this.ongoing = false;
    }
    return { ChatGPT_FullResponse: fullText };
  }

  async sendToken(token = undefined) {
    if (token !== undefined) {
      this.__status = STATUS_WAIT_QUEUE;
      this.tokenQueue.push(token);
    }
    if (this.tokenQueue.length === 0) {
      this.__status = STATUS_IDLE;
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
