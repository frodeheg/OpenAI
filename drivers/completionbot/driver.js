'use strict';

const { Driver, Device } = require('homey');
const { OpenAIApi } = require('openai');
const { v4: uuidv4 } = require('uuid');

/**
 * This is the driver for completion bot devices that communicate with
 * OpenAI APIs to add LLM driven text completion.
 */
class CompletionBotDriver extends Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.homey.flow.getActionCard('prompt')
      .registerRunListener(async (args, state) => {
        const { prompt, device } = args;
        return this.requestCompletion(device, prompt);
      });

    this.log('CompletionBotDriver has been initialized');
  }

  /**
   * Generates a unique ID for each completionBot device.
   */
  _generateUniqueId() {
    return uuidv4();
  }

  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return list containing a completionBot device ready for pairing.
   * There can be any number of completionBot devices added to Homey.
   * Each device will have an id based on the conversation id for the chat.
   */
  async onPairListDevices() {
    return [
      {
        name: 'CompletionBot',
        data: {
          id: this._generateUniqueId(),
        },
      },
    ];
  }

 /**
   * Send a prompt for a text completion from OpenAI APIs.
   * @param {Device} completionBot 
   * @param {string} prompt 
   * @returns {{ completion: string }} The completion to the text in a completion token.
   */
  async requestCompletion(completionBot, prompt) {
    let settings = completionBot.getSettings();

    // handle timeout according to settings
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), settings.timeout)
    );

    let x =  await Promise.race([
      this.sendCompletionRequest(prompt, settings),
      timeoutPromise
    ]);

    return x;
  }

  /**
   * Send completion request to OpenAI APIs.
   * @param {string} prompt 
   * @param {*} settings 
   * @returns {{ completion: string }} The completion to the text in a completion token.
   */
  async sendCompletionRequest(prompt, settings) {
    try {
      let response = await this.getOpenAI().completions.create({
        model: settings.model,
        prompt: prompt,
        temperature: +settings.temperature,
        max_tokens: +settings.max_tokens,
      });

      let finish_reason = response.choices[0].finish_reason;
      if (finish_reason === 'stop') {
        let text = response.choices[0].text;
        return { completion: text };
      }
      else if (finish_reason === 'length') {
        throw new Error('OpenAI API returned incomplete model output due to max_tokens parameter or token limit');
      }
      else if (finish_reason === 'content_filter') {
        throw new Error('OpenAI API returned incomplete model output due to a flag from content filters');
      }
      else {
        // Note: finish_reason === null is a valid case when doing streaming.
        throw new Error('OpenAI API returned incomplete model output due to unknown reason');
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * @returns {OpenAIApi} The OpenAI API instance.
   */
  getOpenAI() {
    return this.homey.app.openai;
  }
}

module.exports = CompletionBotDriver;
