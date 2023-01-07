'use strict';

const { Configuration, OpenAIApi } = require('openai');
const Homey = require('./homey');
const ChatGPT = require('../app');

async function testCommand() {
  const app = new ChatGPT();
  const configuration = new Configuration({
    apiKey: Homey.env.API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  /* const moderated = await openai.createModeration({
    input: 'Test. ',
  });

  console.log(moderated.data.results[0].flagged); */

  let prompt = '';

  prompt += 'Svar på følgende spørsmål på en hyggelig og moderert måte: Fortell en vits.';

  let finished = false;
  while (!finished) {
    const completion = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt,
      user: 'frode',
      max_tokens: 10,
      temperature: 0.6,
    });

    finished = completion.data.choices[0].finish_reason !== 'length'; // === 'stop'
    const textToSplit = completion.data.choices[0].text;
    const splitText = app.splitIntoSubstrings(textToSplit, 200);
    for (let i = 0; i < splitText.length; i++) {
      console.log(`Answer: '${splitText[i]}'`);
      prompt += splitText[i];
    }
  }

  console.log(prompt);
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
