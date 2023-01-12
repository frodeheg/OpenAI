'use strict';

const { Configuration, OpenAIApi } = require('openai');
const Homey = require('./homey');
const ChatGPT = require('../app');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  prompt += 'Alle spørsmål må besvares på en hyggelig og moderert måte.';

  let finished = false;
  let i = 0;
  while (!finished) {
    let completion;
    try {
      completion = await openai.createCompletion({
        model: 'text-ada-001',
        prompt,
        user: 'frode',
        max_tokens: 40,
        temperature: 0.6,
      });
      console.log(`Iteration: ${i} : ${JSON.stringify(completion.data)}`);
    } catch (err) {
      console.log('ERROR');
      console.log(err);
    }
    await sleep(1500);

    finished = false;// completion.data.choices[0].finish_reason !== 'length'; // === 'stop'
    const textToSplit = completion.data.choices[0].text;
    const splitText = app.splitIntoSubstrings(textToSplit, 200);
    for (let i = 0; i < splitText.length; i++) {
      console.log(`Answer: '${splitText[i]}'`);
      prompt += splitText[i];
    }
    i++;
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
