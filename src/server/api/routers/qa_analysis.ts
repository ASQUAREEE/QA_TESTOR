import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import puppeteer from 'puppeteer';
import { OpenAI } from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are a QA testing AI assistant. Given a website URL and a specific task, determine the steps for testing the functionality.
Respond with a JSON object containing:
1. A concise rationale for your decision.
2. The action to take (NAVIGATE, CLICK, TYPE, WAIT, SCREENSHOT, EXTRACT_LINKS, SUMMARIZE, SCROLL, or HIGHLIGHT).
3. Any necessary parameters for the action.

For TYPE and CLICK actions, use specific CSS selectors or XPath. Common selectors:
- Search bar: input[name="search_query"], #search, [aria-label="Search"]
- Search button: button[aria-label="Search"], #search-icon-legacy
- Video: #video-title, .ytd-video-renderer

Example response:
{
    "thought": "Brief explanation",
    "action": "TYPE",
    "params": { "selector": "input[name='search_query']", "text": "example search" }
}
`;

async function generateNextStep(currentState: string, task: string, completedActions: string[]) {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Current state: ${currentState}\nTask: ${task}\nCompleted actions: ${completedActions.join(', ')}\nWhat's the next step? Avoid repeating actions, especially searches.` }
    ],
    max_tokens: 150,
    temperature: 0.7,
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return null;
  }
}

async function runQualityAnalysis(url: string, task: string): Promise<any> {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  let result = '';
  let currentState = `URL: ${url}`;
  let screenshots: string[] = [];
  let completedActions = new Set();
  let videoClicked = false;
  let criticalErrorOccurred = false;
  let errors: string[] = [];

  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push(`Console ${msg.type()}: ${msg.text()}`);
    }
  });

  // Capture network errors
  page.on('requestfailed', request => {
    const failure = request.failure();
    if (failure && failure.errorText !== 'net::ERR_ABORTED') {
      errors.push(`Network error: ${request.url()} ${failure.errorText}`);
      if (failure.errorText.includes('ERR_CONNECTION_REFUSED') || failure.errorText.includes('ERR_NAME_NOT_RESOLVED')) {
        criticalErrorOccurred = true;
      }
    }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    
    let taskCompleted = false;
    let stepCount = 0;
    const maxSteps = 10;

    while (!taskCompleted && stepCount < maxSteps) {
      if (criticalErrorOccurred) {
        result += "Critical error occurred. Stopping further actions.\n";
        break;
      }

      const nextStep = await generateNextStep(currentState, task, Array.from(completedActions));
      if (!nextStep) {
        result += `Step ${stepCount + 1}: Failed to generate next step\n`;
        break;
      }
      result += `Step ${stepCount + 1}: ${JSON.stringify(nextStep)}\n`;

      // Check if the action has already been performed
      if (completedActions.has(nextStep.action)) {
        if (nextStep.action === 'TYPE' && nextStep.params?.selector.includes('search')) {
          result += `Step ${stepCount + 1}: Search already performed. Skipping.\n`;
          stepCount++;
          continue;
        }
        if (nextStep.action === 'CLICK' && videoClicked) {
          result += `Step ${stepCount + 1}: Video already clicked. Skipping.\n`;
          stepCount++;
          continue;
        }
      }

      try {
        switch (nextStep.action) {
          case 'NAVIGATE':
            if (nextStep.params?.url && !completedActions.has('NAVIGATE')) {
              await page.goto(nextStep.params.url, { waitUntil: 'networkidle0', timeout: 60000 });
              currentState = `URL: ${await page.url()}`;
              completedActions.add('NAVIGATE');
            }
            break;
          case 'CLICK':
            if (nextStep.params?.selector) {
              await clickElement(page, nextStep.params.selector);
              completedActions.add('CLICK');
              if (nextStep.params.selector === '#video-title' || nextStep.params.selector === 'a[title]') {
                videoClicked = true;
              }
            }
            break;
          case 'TYPE':
            if (nextStep.params?.selector && nextStep.params?.text && !completedActions.has('SEARCH')) {
              await typeText(page, nextStep.params.selector, nextStep.params.text);
              await page.keyboard.press('Enter'); // Ensure the search is executed
              completedActions.add('TYPE');
              completedActions.add('SEARCH');
            }
            break;
          case 'WAIT':
            await new Promise(resolve => setTimeout(resolve, nextStep.params?.ms || 1000));
            break;
          case 'SCREENSHOT':
            const screenshot = await takeScreenshot(page);
            screenshots.push(screenshot);
            completedActions.add('SCREENSHOT');
            break;
          case 'EXTRACT_LINKS':
            const links = await extractLinks(page);
            result += `Links: ${JSON.stringify(links)}\n`;
            completedActions.add('EXTRACT_LINKS');
            break;
          case 'SUMMARIZE':
            const summary = await summarizePage(page);
            result += `Summary: ${summary}\n`;
            completedActions.add('SUMMARIZE');
            break;
          case 'SCROLL':
            await scroll(page, nextStep.params?.direction || 'down');
            completedActions.add('SCROLL');
            break;
          case 'HIGHLIGHT':
            if (nextStep.params?.selector) {
              await highlightElements(page, nextStep.params.selector);
              completedActions.add('HIGHLIGHT');
            }
            break;
          default:
            result += `Unknown action: ${nextStep.action}\n`;
        }
        result += `Step completed successfully\n`;
      } catch (stepError: any) {
        result += `Error executing step: ${stepError.message}\n`;
        if (nextStep.action === 'CLICK' || nextStep.action === 'TYPE') {
          const alternativeSelector = await findAlternativeSelector(page, nextStep.params?.selector);
          if (alternativeSelector) {
            result += `Trying alternative selector: ${alternativeSelector}\n`;
            await (nextStep.action === 'CLICK' ? clickElement(page, alternativeSelector) : typeText(page, alternativeSelector, nextStep.params?.text));
            result += `Step completed successfully with alternative selector\n`;
            if (nextStep.action === 'CLICK' && (alternativeSelector === '#video-title' || alternativeSelector === 'a[title]')) {
              videoClicked = true;
            }
          }
        }
      }

      currentState = `URL: ${await page.url()}\nLast action: ${nextStep.action}`;
      stepCount++;

      // Check if the video is playing
      if (videoClicked) {
        const isPlaying = await checkIfVideoPlaying(page);
        if (isPlaying) {
          taskCompleted = true;
          result += `Task completed: Video is playing.\n`;
        }
      }

      const completionCheck = await checkTaskCompletion(task, currentState);
      if (completionCheck.completed) {
        taskCompleted = true;
        result += `Task completed: ${completionCheck.reason}\n`;
      }
    }

    if (!taskCompleted) {
      result += "Maximum steps reached without completing the task.\n";
    }

    // Analyze errors and add important ones to the result
    if (errors.length > 0) {
      const errorSummary = await summarizeErrors(errors);
      result += `\nImportant Errors:\n${errorSummary}`;
    }

    const testSummary = await summarizeTest(task, result);
    result += `\nTest Summary:\n${testSummary}`;

    return { result, screenshots };
  } catch (error) {
    console.error("Error in runQualityAnalysis:", error);
    return { result: "An error occurred during the analysis", error: error.message };
  } finally {
    await browser.close();
  }
}

async function summarizeErrors(errors: string[]): Promise<string> {
  const errorText = errors.join('\n');
  const summary = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are an error analysis assistant. Summarize the following errors, focusing only on the most important ones that could affect the functionality of the website. Ignore minor issues or expected behaviors." },
      { role: "user", content: errorText }
    ],
    max_tokens: 150,
    temperature: 0.3,
  });
  return summary.choices[0].message.content;
}

async function checkIfVideoPlaying(page: puppeteer.Page): Promise<boolean> {
  return await page.evaluate(() => {
    const video = document.querySelector('video');
    return video && !video.paused;
  });
}

async function findAlternativeSelector(page: puppeteer.Page, originalSelector: string): Promise<string | null> {
  const alternatives = [
    '#video-title',
    '.ytd-video-renderer',
    'a.ytd-video-renderer',
    '#contents ytd-video-renderer',
    'ytd-video-renderer #video-title',
    'ytd-video-renderer .ytd-video-renderer',
    'a.ytd-video-renderer h3',
    '#contents .ytd-video-renderer h3',
    'a[href^="/watch"]',
    'a[title]'
  ];

  for (const selector of alternatives) {
    const element = await page.$(selector);
    if (element) {
      return selector;
    }
  }

  return null;
}

async function clickElement(page: puppeteer.Page, selector: string) {
  await page.waitForSelector(selector, { timeout: 5000 });
  await page.click(selector);
}

async function typeText(page: puppeteer.Page, selector: string, text: string) {
  await page.waitForSelector(selector, { timeout: 5000 });
  await page.type(selector, text);
}

async function takeScreenshot(page: puppeteer.Page): Promise<string> {
  return await page.screenshot({ encoding: 'base64' }) as string;
}

async function extractLinks(page: puppeteer.Page) {
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(link => ({
      text: link.textContent,
      href: link.href
    })).slice(0, 5);
  });
}

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
  return summary.choices[0].message.content;
}

async function scroll(page: puppeteer.Page, direction: string) {
  await page.evaluate((dir) => {
    window.scrollBy(0, dir === 'down' ? window.innerHeight : -window.innerHeight);
  }, direction);
}

async function highlightElements(page: puppeteer.Page, selector: string) {
  await page.evaluate((sel) => {
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
    model: 'gpt-3.5-turbo',
    messages: [
      { role: "system", content: "You are a QA testing assistant. Determine if the given task has been completed based on the current state." },
      { role: "user", content: `Task: ${task}\nCurrent state: ${currentState}\nHas the task been completed? Respond with a JSON object containing 'completed' (boolean) and 'reason' (string).` }
    ],
    max_tokens: 100,
    temperature: 0.3,
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Failed to parse task completion check:", error);
    return { completed: false, reason: "Unable to determine task completion" };
  }
}

async function summarizeTest(task: string, testResult: string) {
  const summary = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a QA testing summary assistant. Provide a concise summary of the test results." },
      { role: "user", content: `Task: ${task}\n\nTest Results:\n${testResult}\n\nPlease provide a brief summary of the test execution and results.` }
    ],
    max_tokens: 150,
    temperature: 0.7,
  });
  return summary.choices[0].message.content;
}

export const qualityAnalysisRouter = createTRPCRouter({
  analyzeWebsite: publicProcedure
    .input(z.object({
      url: z.string().url(),
      task: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await runQualityAnalysis(input.url, input.task);
    }),
});