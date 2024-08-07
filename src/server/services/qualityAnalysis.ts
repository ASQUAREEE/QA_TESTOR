import puppeteer from 'puppeteer-core';
import chrome from 'chrome-aws-lambda';
import { OpenAI } from 'openai';
import parseJson, { JSONError } from 'parse-json';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are a QA testing AI assistant. Given a website URL and a specific task, determine the steps for testing the functionality.
Respond with a valid JSON object containing:
1. A 'thought' field with a concise rationale for your decision.
2. An 'action' field with the action to take (NAVIGATE, CLICK, TYPE, WAIT, SCREENSHOT, EXTRACT_LINKS, SUMMARIZE, SCROLL, HIGHLIGHT, or SELECT).
3. A 'params' field with any necessary parameters for the action.

For TYPE and CLICK actions, use specific CSS selectors or XPath. Common selectors:
- Search bar: input[name="search_query"], #search, [aria-label="Search"]
- Search button: button[aria-label="Search"], #search-icon-legacy
- Video: #video-title, .ytd-video-renderer
- Email input: input[type="email"], input[name="email"], #email
- Password input: input[type="password"], input[name="password"], #password
- Submit button: button[type="submit"], input[type="submit"], #submit, .submit-button

Remember to consider different scenarios:
- If logging in, enter email, then password, then submit.
- If searching, enter search term, then click search button or press enter.
- If navigating, use CLICK for menu items or links.
- Use WAIT after actions that might trigger page loads or animations.
- Use SCREENSHOT to capture important states.
- Use EXTRACT_LINKS to gather navigation options.
- Use SCROLL if content might be below the fold.
- Use HIGHLIGHT to visually mark important elements for reporting.
- Use SELECT for dropdown menus.

You will be provided with the current page content. Use this information to make informed decisions about what actions to take next. Look for relevant input fields, buttons, and links that match the current task.

Avoid repeating actions. Progress through tasks logically. After completing all necessary steps, use the SUMMARIZE action to indicate task completion.

Example response:
{
    "thought": "Brief explanation",
    "action": "TYPE",
    "params": { "selector": "input[name='search_query']", "text": "example search" }
}
`;

//@ts-expect-error
async function generateNextStep(page: puppeteer.Page, currentState: string, task: string, completedActions: string[], pageContent: string) {
  try {
    const htmlContent = await page.evaluate(() => document.documentElement.outerHTML);
    const truncatedHtml = htmlContent.slice(0, 10000);

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `
Current state: ${currentState}
Task: ${task}
Completed actions: ${completedActions.join(', ')}
HTML content (truncated):
${truncatedHtml}

Based on the current HTML content and the task at hand, what's the next step? Analyze the HTML structure to identify relevant elements and their attributes. Consider using specific selectors or XPath for actions. Avoid repeating actions and progress logically through the task. Respond with a valid JSON object containing 'thought', 'action', and 'params' fields. Do not use any Markdown formatting in your response.
        ` }
      ],
      max_tokens: 250,
      temperature: 0.7,
    });

    if (!response.choices || response.choices.length === 0 || !response?.choices[0]?.message) {
      throw new Error("Unexpected response structure from OpenAI API");
    }

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI API");
    }

    const cleanedContent = content
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .replace(/\/\/.*$/gm, '');

    return parseJson(cleanedContent);
  } catch (error) {
    if (error instanceof JSONError) {
      console.error("JSON parsing error:", error.message);
      console.error("Code frame:", error.codeFrame);
    } else {
      console.error("Error in generateNextStep:", error);
    }
    return {
      thought: "Unable to determine next step due to an error",
      action: "SUMMARIZE",
      params: {}
    };
  }
}

//@ts-expect-error
async function clickWithRetry(page: puppeteer.Page, selector: string, maxAttempts = 3): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector);
      return true;
    } catch (error:any) {
      console.log(`Attempt ${attempt + 1} failed to click ${selector}: ${error.message}`);
      if (attempt === maxAttempts - 1) {
        console.log(`All ${maxAttempts} attempts to click ${selector} failed.`);
        try {
          await page.evaluate((sel:any) => {
            const element = document.querySelector(sel);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, selector);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await page.click(selector);
          console.log(`Successfully clicked ${selector} after scrolling`);
          return true;
        } catch (scrollError:any) {
          console.log(`Failed to click ${selector} even after scrolling: ${scrollError?.message}`);
          return false;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}
//@ts-expect-error
async function typeText(page: puppeteer.Page, selector: string, text: string) {
  await page.waitForSelector(selector, { timeout: 5000 });
  await page.type(selector, text);
}
//@ts-expect-error
async function takeScreenshot(page: puppeteer.Page): Promise<string> {
  return await page.screenshot({ encoding: 'base64' }) as string;
}
//@ts-expect-error
async function extractLinks(page: puppeteer.Page) {
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(link => ({
      text: link.textContent,
      href: link.href
    })).slice(0, 5);
  });
}
//@ts-expect-error
async function summarizePage(page: puppeteer.Page): Promise<string> {
  const content = await page.evaluate(() => document.body.innerText);
  const summary = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "Summarize the following webpage content concisely:" },
      { role: "user", content: content.slice(0, 10000) }
    ],
    temperature: 0.3,
  });
  return summary.choices[0]?.message?.content || '';
}

//@ts-expect-error
async function scroll(page: puppeteer.Page, direction: string) {
  await page.evaluate((dir:any) => {
    window.scrollBy(0, dir === 'down' ? window.innerHeight : -window.innerHeight);
  }, direction);
}
//@ts-expect-error
async function highlightElements(page: puppeteer.Page, selector: string) {
  await page.evaluate((sel:any) => {
    const elements = document.querySelectorAll(sel);
    elements.forEach((el, index) => {
      const element = el as HTMLElement;
      element.style.border = '2px solid red';
      element.style.backgroundColor = 'yellow';
      const label = document.createElement('div');
      label.textContent = `${index + 1}`;
      label.style.position = 'absolute';
      label.style.background = 'red';
      label.style.color = 'white';
      label.style.padding = '2px';
      label.style.zIndex = '10000';
      const rect = element.getBoundingClientRect();
      label.style.left = `${rect.left + window.pageXOffset}px`;
      label.style.top = `${rect.top + window.pageYOffset}px`;
      document.body.appendChild(label);
    });
  }, selector);
}

async function checkTaskCompletion(task: string, currentState: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: "system", content: "You are a QA testing assistant. Determine if the given task has been completed based on the current state." },
      { role: "user", content: `Task: ${task}\nCurrent state: ${currentState}\nHas the task been completed? Respond with a JSON object containing 'completed' (boolean) and 'reason' (string). Do not use any Markdown formatting in your response.` }
    ],
    max_tokens: 100,
    temperature: 0.3,
  });

  try {
    const content = response.choices[0]?.message?.content || '';
    const cleanedContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    return parseJson(cleanedContent);
  } catch (error) {
    if (error instanceof JSONError) {
      console.error("JSON parsing error in checkTaskCompletion:", error.message);
      console.error("Code frame:", error.codeFrame);
    } else {
      console.error("Error in checkTaskCompletion:", error);
    }
    return { completed: false, reason: "Unable to determine task completion" };
  }
}

async function summarizeTest(task: string, testResult: string) {
  const summary = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a QA testing summary assistant. Provide a concise summary of the test results." },
      { role: "user", content: `Task: ${task}\n\nTest Results:\n${testResult}\n\nPlease provide a brief summary of the test execution and results.` }
    ],
    max_tokens: 150,
    temperature: 0.7,
  });
  return summary.choices[0]?.message?.content || '';
}

export async function runQualityAnalysis(url: string, task: string): Promise<any> {
  let browser;
  try {
    const executablePath = process.env.NODE_ENV === 'production'
      ? await chrome.executablePath
      : '/usr/bin/google-chrome-stable'; // Adjust this path for your local Chrome installation

    const options = {
      args: chrome.args,
      executablePath: executablePath,
      headless: chrome.headless,
    };

    if (process.env.NODE_ENV === 'development') {
      // For local development, use these options
      options.headless = true;
      options.args = ['--no-sandbox', '--disable-setuid-sandbox'];
    }

    browser = await puppeteer.launch(options);
    const page = await browser.newPage();

    let result = '';
    let currentState = `URL: ${url}`;
    let screenshots: string[] = [];
    let completedActions: string[] = [];
    let taskCompleted = false;
    let stepCount = 0;
    const maxSteps = 15;

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    while (!taskCompleted && stepCount < maxSteps) {
      const pageContent = await page.evaluate(() => document.body.innerText);
      const nextStep = await generateNextStep(page, currentState, task, completedActions, pageContent);

      result += `Step ${stepCount + 1}: ${JSON.stringify(nextStep)}\n`;

      try {
        switch (nextStep.action) {
          case 'NAVIGATE':
            //@ts-expect-error
            if (nextStep.params?.url) {
              //@ts-expect-error
              await page.goto(nextStep.params.url, { waitUntil: 'networkidle0', timeout: 60000 });
              currentState = `URL: ${await page.url()}`;
            }
            break;
          case 'CLICK':
            //@ts-expect-error
            if (nextStep.params?.selector) {
              //@ts-expect-error
              await clickWithRetry(page, nextStep.params.selector);
            }
            break;
          case 'TYPE':
            //@ts-expect-error
            if (nextStep.params?.selector && nextStep.params?.text) {
              //@ts-expect-error
              await typeText(page, nextStep.params.selector, nextStep.params.text);
            }
            break;
          case 'WAIT':
            await new Promise(resolve => setTimeout(resolve, (nextStep.params as { ms?: number })?.ms || 1000));
            break;
          case 'SCREENSHOT':
            const screenshot = await takeScreenshot(page);
            screenshots.push(screenshot);
            break;
          case 'EXTRACT_LINKS':
            const links = await extractLinks(page);
            result += `Links: ${JSON.stringify(links)}\n`;
            break;
          case 'SUMMARIZE':
            const summary = await summarizePage(page);
            result += `Summary: ${summary}\n`;
            taskCompleted = true;
            break;
          case 'SCROLL':
            //@ts-expect-error
            await scroll(page, nextStep.params?.direction || 'down');
            break;
          case 'HIGHLIGHT':
            //@ts-expect-error
            if (nextStep.params?.selector) {
              //@ts-expect-error
              await highlightElements(page, nextStep.params.selector);
            }
            break;
          default:
            result += `Unknown action: ${nextStep.action}\n`;
        }
        result += `Step completed successfully\n`;
        //@ts-expect-error
        completedActions.push(nextStep.action);
      } catch (stepError: any) {
        result += `Error executing step: ${stepError.message}\n`;
      }

      currentState = `URL: ${await page.url()}\nLast action: ${nextStep.action}`;
      stepCount++;

      if (!taskCompleted) {
        const completionCheck = await checkTaskCompletion(task, currentState);
        if (completionCheck.completed) {
          taskCompleted = true;
          result += `Task completed: ${completionCheck.reason}\n`;
        }
      }
    }

    if (!taskCompleted) {
      result += "Maximum steps reached without completing the task.\n";
    }

    const testSummary = await summarizeTest(task, result);
    result += `\nTest Summary:\n${testSummary}`;

    return { result, screenshots };
  } catch (error:any) {
    console.error("Error in runQualityAnalysis:", error);
    return { result: "An error occurred during the analysis", error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}