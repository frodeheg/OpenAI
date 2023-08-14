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

  prompt += 'Alle spørsmål må besvares på en hyggelig og moderert måte. Er du en robot?';

  let finished = false;
  let i = 0;
  while (!finished) {
    let completion;
    try {

      /* completion = await openai.createCompletion({
        model: 'gpt-3.5-turbo',
        prompt,
        user: 'frode',
        max_tokens: 40,
        temperature: 0.6,
      }); */
      completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{role: "user", content: "Hello!"}]
      });
      console.log(`Iteration: ${i} : ${JSON.stringify(completion.data)}`);
    } catch (err) {
      console.log(`ERROR: ${err.response.data.error.message}`);
      throw new Error(err.response.data.error.message);
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
    temperature: 0,
  });
  //console.log(`test: ${completion2.data.choices[0].text}`);
  console.log(completion2);*/
}

async function testChat() {
  const app = new ChatGPT();
  const configuration = new Configuration({
    apiKey: Homey.env.API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  let finished = false;
  let iter = 0;
  // const userQuestion = "Please turn on the lights on the device listed on http://www.dinside.no";
  // const userQuestion = "Hva er temperaturen i varmtvannstanken?";
  const userQuestion = "Turn on the lights in the kitchen";
  const deviceList = '[\n'
  + ' {\n'
  + '  "deviceId": "ABF332DD3-BAACE3E4E-111111",\n'
  + '  "deviceName": "Light 1",\n'
  + '  "zone": "Living room"\n'
  + ' },\n'
  + ' {\n'
  + '  "deviceId": "ABF332DD3-BAACE3E4E-222222",\n'
  + '  "deviceName": "Light 2",\n'
  + '  "zone": "Living room"\n'
  + ' },\n'
  + ' {\n'
  + '  "deviceId": "aaaaaaaaaaa-abbbbb",\n'
  + '  "deviceName": "Light 1",\n'
  + '  "zone": "Kitchen"\n'
  + ' }\n'
  + ']';
  /*const question = 'Below you will be provided with a json structure containing a user message, device list and classification rules.\n'
  + '{\n'
  + ` "message": "${userQuestion}"\n`
  + ` "deviceList": ${deviceList},\n`
  + ' "rules": [\n'
  + '  { "id": 1, "description": "Changes the value of a writeable capability for a device. The deviceId must be inserted in parameter1, the capabilityId in parameter2 and the new value in parameter3" },'
  + '  { "id": 2, "description": "Look up the web page inserted in parameter1 before any further classification can be performed" },'
  + '  { "id": 0, "description": "The message did not fit any of the other rules" }'
  + ' ]\n'
  + '}\n'
  + 'Please analyze the user message and classify it according to the rules. The complete answer must be returned as JSON as follows without any explanations:\n'
  + '{\n'
  + ' "actions": [insert one or more actions here],\n'
  + ' "message": "insert a message you would like to communicate back to the user. It must be in the same language as the user message in the earlier json structure"\n'
  + '}\n'
  + 'An action is defined as follows:\n'
  + '{\n'
  + '  "action_id": "insert id from the rule set here",\n'
  + '  "parameter1": "insert parameter relevant to the action, if applicable",\n'
  + '  "parameter2": "insert parameter relevant to the action, if applicable",\n'
  + '  "parameter3": "insert parameter relevant to the action, if applicable",\n'
  + ' }\n'; */

  // ===== Step 1) Determine what is needed
  /*const question = `Below is a json structure containing a user message and a list of additional information which is available:\n`
  + '{\n'
  + ` "message": "${userQuestion}"\n`
  + ' "info": {\n'
  + '    "devices": "A list of devices",\n'
  + '    "zone": "A list describing which zone the devices belong to",\n'
  + '    "capabilities": "A list describing which capabilities every device have. A capability can be read or written"\n'
  + ' }\n'
  + '}\n'
  + 'Please analyze the user message and return a JSON string setting all of the info parameters to true or false depending on whether the information within those lists are required to take action on the user message. Nothing else than the JSON string should be returned.\n';*/
  // ===== Step 2) Determine the device(s) in question
  const question = `Below is a json structure containing a user message and a list of devices:\n`
  + '{\n'
  + ` "message": "${userQuestion}",\n`
  + ` "devices": ${deviceList}\n`
  + '}\n'
  + 'Please analyze the user message and return a JSON array that lists the deviceId\'s for the devices that are affected by the user message without any further explanations.\n';
  const messages = [];
  messages.push({ role: 'user', content: question });
  console.log(messages);

  /*const answer1 = "{\n   \"actions\":[\n      {\n         \"action_id\":5,\n         \"parameter1\":\"http://www.dinside.no\",\n         \"message\":\"Please wait while we look up the web page to correctly classify your message\"\n      }\n   ]\n}";
  messages.push({ role: 'assistant', content: answer1 });
  const answer2 = 'Please update the json structure based on the text from the web page. The web page said: <HTML><BODY><table>'
  + '<tr><th>Device></th><th>deviceId</th></tr>'
  + '<tr><td>Light top floor</td><td>ABF332DD3-BAACE3E4E-AAC568</td></tr>'
  + '<tr><td>Light living room</td><td>FFFF22222-FFF21111-223333</td></tr>'
  + '</table></BODY></HTML>\n';
  messages.push({ role: 'user', content: answer2 });*/

  /*const answer1 = "{\n \"actions\": [\n   {\n     \"action_id\": 1,\n     \"parameter1\": \"living room\",\n     \"parameter2\": null,\n     \"message\": \"Turning on lights in the living room\"\n   }\n ]\n}";
  messages.push({ role: 'assistant', content: answer1 });
  const answer2 = 'Please update the json structure with correct deviceId\'s picked from the following array:\n'
  + '[\n'
  + ' {\n'
  + '  "deviceId": "ABF332DD3-BAACE3E4E-111111",\n'
  + '  "deviceName": "Light 1",\n'
  + '  "zone": "Living room"\n'
  + ' },\n'
  + ' {\n'
  + '  "deviceId": "ABF332DD3-BAACE3E4E-222222",\n'
  + '  "deviceName": "Light 2",\n'
  + '  "zone": "Living room"\n'
  + ' },\n'
  + ' {\n'
  + '  "deviceId": "aaaaaaaaaaa-abbbbb",\n'
  + '  "deviceName": "Light 1",\n'
  + '  "zone": "Kitchen"\n'
  + ' }\n'
  + ']\n';
  messages.push({ role: 'user', content: answer2 });*/
  while (!finished) {
    let completion;
    try {
      completion = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 200,
      });
      // console.log(`Iteration: ${iter} : ${JSON.stringify(completion.data)}`);
    } catch (err) {
      console.log(`ERROR: ${err.response.data.error.message}`);
      throw new Error(err.response.data.error.message);
    }
    await sleep(1500);

    finished = completion.data.choices[0].finish_reason !== 'length'; // === 'stop'
    const textToSplit = completion.data.choices[0].message;
    messages.push(textToSplit);
    console.log(`Answer ${iter}: ${JSON.stringify(textToSplit)}`);
    /*const splitText = app.splitIntoSubstrings(textToSplit, 200);
    for (let i = 0; i < splitText.length; i++) {
      console.log(`Answer: '${splitText[i]}'`);
      prompt += splitText[i];
    }*/
    iter++;
  }
  console.log('All done...');
}

// Run all the testing
//testCommand();
testChat();
// testState('states/Anders_0.18.31_err.txt', 100);
