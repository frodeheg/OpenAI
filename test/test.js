'use strict';

const { Configuration, OpenAIApi } = require('openai');
const Homey = require('./homey');
const app = require('../app');

async function testCommand() {
  const configuration = new Configuration({
    apiKey: Homey.env.API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  const moderated = await openai.createModeration({
    input: 'Test. ',
  });

  console.log(moderated.data.results[0].flagged);

  const completion = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt: 'Please use moderation when answering: Hvordan har du sex?',
    user: 'frode',
    max_tokens: 100,
    temperature: 0.6,
  });

  console.log(`test: ${completion.data.choices[0].text}`);
  //console.log(completion.data.choices);
  console.log('----------');
  /*const completion2 = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: 'please continue',
    user: 'frode',
    max_tokens: 100,
    temperature: 0.6,
  });
  //console.log(`test: ${completion2.data.choices[0].text}`);
  console.log(completion2);*/
}

// Run all the testing
testCommand();
// testState('states/Anders_0.18.31_err.txt', 100);
