/* eslint-disable comma-dangle */

'use strict';

module.exports = {
  async updateLog({ homey, query }) {
    homey.api.realtime('logStatus', homey.app.__status);
    homey.api.realtime('logIn', homey.app.__input);
    homey.api.realtime('logOut', homey.app.__output);

    const { tokenQueue } = homey.app;
    let queueText = '';
    for (let i = 0; i < tokenQueue.length; i++) {
      queueText += `${i}: ${tokenQueue[i]}`;
    }
    homey.api.realtime('logQueue', queueText);
  }
};
