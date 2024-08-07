import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import puppeteer from 'puppeteer';
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

// @ts-expect-error
async function generateNextStep(page: puppeteer.Page, currentState: string, task: string, completedActions: string[], pageContent: string) {
  try {
    // Extract HTML content
    const htmlContent = await page.evaluate(() => document.documentElement.outerHTML);
    
    // Truncate the htmlContent to reduce token count
    const truncatedHtml = htmlContent.slice(0, 10000); // Adjust this value as needed

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
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

    if (!response.choices || response.choices.length === 0 || !response.choices[0]?.message) {
      throw new Error("Unexpected response structure from OpenAI API");
    }

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI API");
    }

    // Strip Markdown formatting and comments
    const cleanedContent = content
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .replace(/\/\/.*$/gm, ''); // Remove single-line comments

    return parseJson(cleanedContent);
  } catch (error) {
    if (error instanceof JSONError) {
      console.error("JSON parsing error:", error.message);
      console.error("Code frame:", error.codeFrame);
    } else {
      console.error("Error in generateNextStep:", error);
    }
    // If all else fails, return a default step
    return {
      thought: "Unable to determine next step due to an error",
      action: "SUMMARIZE",
      params: {}
    };
  }
}

async function runQualityAnalysis(url: string, task: string): Promise<any> {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--start-maximized'],
    defaultViewport: null
  });
  const page = await browser.newPage();

  let result = '';
  let screenshots: string[] = [];
  let pageErrorOccurred = false;

  // Capture page errors
  page.on('pageerror', (error) => {
    const errorMessage = error.message;
    if (errorMessage.includes('React') || errorMessage.includes('must be used within')) {
      result += `Critical React Error: ${errorMessage}\n`;
    } else {
      result += `Page Error: ${errorMessage}\n`;
    }
    pageErrorOccurred = true;
  });

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    
    if (!response?.ok()) {
      const statusCode = response?.status();
      result += `Critical error: HTTP status ${statusCode}\n`;
      return { result, screenshots, error: `HTTP status ${statusCode}` };
    }

    if (pageErrorOccurred) {
      return { result, screenshots, error: "Page error occurred" };
    }

    let taskCompleted = false;
    let stepCount = 0;
    const maxSteps = 10;
    let currentState = `URL: ${url}`;
    let completedActions: string[] = [];
    let videoClicked = false;
    let criticalErrorOccurred = false;
    let errors: string[] = [];
    let reactErrors: string[] = [];
    let criticalErrors: string[] = [];
    let actionAttempts: { [key: string]: number } = {};

    // Capture console messages
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warn') {
        const text = msg.text();
        if (text.includes('React') || text.includes('must be used within')) {
          reactErrors.push(`React error: ${text}`);
        } else {
          errors.push(`Console ${msg.type()}: ${text}`);
        }
      }
    });

    // Capture network errors
    page.on('requestfailed', request => {
      const failure = request.failure();
      if (failure && failure.errorText !== 'net::ERR_ABORTED') {
        errors.push(`Network error: ${request.url()} ${failure.errorText}`);
        if (failure.errorText.includes('ERR_CONNECTION_REFUSED') || failure.errorText.includes('ERR_NAME_NOT_RESOLVED')) {
          criticalErrors.push(`Critical network error: ${failure.errorText}`);
          criticalErrorOccurred = true;
        }
      }
    });

    while (!taskCompleted && stepCount < maxSteps) {
      if (criticalErrorOccurred) {
        result += "Critical error occurred. Stopping further actions.\n";
        return { result, screenshots, error: "Critical error" };
      }

      const pageContent = await extractPageContent(page);
      const nextStep = await generateNextStep(page, currentState, task, completedActions, pageContent);

      if (!nextStep) {
        result += `Step ${stepCount + 1}: Failed to generate next step\n`;
        break;
      }
      result += `Step ${stepCount + 1}: ${JSON.stringify(nextStep)}\n`;
      // @ts-expect-error
      const actionKey = `${nextStep.action}_${nextStep.params?.selector || ''}`;
      if (actionAttempts[actionKey] && actionAttempts[actionKey] >= 3) {
        result += `Skipping repeated action: ${actionKey}\n`;
        stepCount++;
        continue;
      }

      actionAttempts[actionKey] = (actionAttempts[actionKey] || 0) + 1;

      try {
        switch (nextStep.action) {
          case 'NAVIGATE':
// @ts-expect-error

            if (nextStep.params?.url && !completedActions.includes('NAVIGATE')) {
// @ts-expect-error

              await page.goto(nextStep.params.url, { waitUntil: 'networkidle0', timeout: 60000 });
              currentState = `URL: ${await page.url()}`;
              completedActions.push('NAVIGATE');
            }
            break;
          case 'CLICK':
            // @ts-expect-error
            if (nextStep.params?.selector) {
              // @ts-expect-error
              await clickWithRetry(page, nextStep.params.selector);
              // @ts-expect-error
              completedActions.push(`CLICK_${nextStep.params.selector}`);
              // @ts-expect-error
              if (nextStep.params.selector === '#video-title' || nextStep.params.selector === 'a[title]') {
                videoClicked = true;
              }
            }
            break;
          case 'TYPE':
            // @ts-expect-error
            if (nextStep.params?.selector && nextStep.params?.text) {
              // @ts-expect-error
              await typeText(page, nextStep.params.selector, nextStep.params.text);
              // @ts-expect-error
              completedActions.push(`TYPE_${nextStep.params.selector}`);
            }
            break;
          case 'WAIT':
            // @ts-expect-error
            await new Promise(resolve => setTimeout(resolve, nextStep.params?.ms || 1000));
            completedActions.push('WAIT');
            break;
          case 'SCREENSHOT':
            const screenshot = await takeScreenshot(page);
            screenshots.push(screenshot);
            completedActions.push('SCREENSHOT');
            break;
          case 'EXTRACT_LINKS':
            const links = await extractLinks(page);
            result += `Links: ${JSON.stringify(links)}\n`;
            completedActions.push('EXTRACT_LINKS');
            break;
          case 'SUMMARIZE':
            const summary = await summarizePage(page);
            result += `Summary: ${summary}\n`;
            completedActions.push('SUMMARIZE');
            taskCompleted = true;
            break;
          case 'SCROLL':
            // @ts-expect-error
            await scroll(page, nextStep.params?.direction || 'down');
            completedActions.push('SCROLL');
            break;
          case 'HIGHLIGHT':
            // @ts-expect-error
            if (nextStep.params?.selector) {
              // @ts-expect-error
              await highlightElements(page, nextStep.params.selector);
              // @ts-expect-error
              completedActions.push(`HIGHLIGHT_${nextStep.params.selector}`);
            }
            break;
          case 'SELECT':
            // @ts-expect-error
            if (nextStep.params?.selector && nextStep.params?.value) {
              // @ts-expect-error
              await selectOption(page, nextStep.params.selector, nextStep.params.value);
              // @ts-expect-error
              completedActions.push(`SELECT_${nextStep.params.selector}`);
            }
            break;
          default:
            result += `Unknown action: ${nextStep.action}\n`;
        }
        result += `Step completed successfully\n`;
      } catch (stepError: any) {
        result += `Error executing step: ${stepError.message}\n`;
        if (nextStep.action === 'CLICK' || nextStep.action === 'TYPE') {
          // @ts-expect-error
          const alternativeSelector = await findAlternativeSelector(page, nextStep.params?.selector);
          if (alternativeSelector) {
            result += `Trying alternative selector: ${alternativeSelector}\n`;
            // @ts-expect-error
            await (nextStep.action === 'CLICK' ? clickWithRetry(page, alternativeSelector) : typeText(page, alternativeSelector, nextStep.params?.text));
            result += `Step completed successfully with alternative selector\n`;
            if (nextStep.action === 'CLICK' && (alternativeSelector === '#video-title' || alternativeSelector === 'a[title]')) {
              videoClicked = true;
            }
          }
        } else if (nextStep.action === 'SELECT') {
          result += `Attempting to force select option...\n`;
          // @ts-expect-error
          await forceSelectOption(page, nextStep.params?.selector, nextStep.params?.value);
          result += `Forced selection completed\n`;
        }
      }

      currentState = `URL: ${await page.url()}\nLast action: ${nextStep.action}\nCompleted actions: ${completedActions.join(', ')}`;
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

    if (reactErrors.length > 0 || criticalErrors.length > 0) {
      const errorSummary = await summarizeErrors([...reactErrors, ...criticalErrors]);
      result += `\nCritical Errors:\n${errorSummary}`;
    } else if (errors.length > 0) {
      const errorSummary = await summarizeErrors(errors);
      result += `\nNon-critical Errors:\n${errorSummary}`;
    } else {
      result += "\nNo errors were detected during the test.";
    }

    const testSummary = await summarizeTest(task, result);
    result += `\nTest Summary:\n${testSummary}`;

    return { result, screenshots };
  } catch (error:any) {
    console.error("Error in runQualityAnalysis:", error);
    return { result: "An error occurred during the analysis", error: error.message };
  } finally {
    await browser.close();
  }
}

async function summarizeErrors(errors: string[]): Promise<string> {
  const errorText = errors.join('\n');
  const summary = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an error analysis assistant. Summarize the following errors, focusing on React errors and other critical issues that could affect the functionality of the website. Provide a brief explanation of each error and its potential impact." },
      { role: "user", content: errorText }
    ],
    max_tokens: 200,
    temperature: 0.3,
  });
  return summary.choices?.[0]?.message?.content || '';
}
// @ts-expect-error
async function checkIfVideoPlaying(page: puppeteer.Page): Promise<boolean> {
  return await page.evaluate(() => {
    const video = document.querySelector('video');
    return video && !video.paused;
  });
}
// @ts-expect-error

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
// @ts-expect-error
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
        // If all attempts fail, try scrolling and clicking one last time
        try {
          await page.evaluate((sel:string) => {
            const element = document.querySelector(sel);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, selector);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for scroll to complete
          await page.click(selector);
          console.log(`Successfully clicked ${selector} after scrolling`);
          return true;
        } catch (scrollError:any) {
          console.log(`Failed to click ${selector} even after scrolling: ${scrollError.message}`);
          return false;
        }
      }
      // Use a Promise-based timeout instead of page.waitForTimeout
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}
// @ts-expect-error

async function typeText(page: puppeteer.Page, selector: string, text: string) {
  await page.waitForSelector(selector, { timeout: 5000 });
  await page.type(selector, text);
}
// @ts-expect-error
async function takeScreenshot(page: puppeteer.Page): Promise<string> {
  return await page.screenshot({ encoding: 'base64' }) as string;
}
// @ts-expect-error

async function extractLinks(page: puppeteer.Page) {
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(link => ({
      text: link.textContent,
      href: link.href
    })).slice(0, 5);
  });
}
// @ts-expect-error

async function summarizePage(page: puppeteer.Page): Promise<string> {
  const content = await page.evaluate(() => document.body.innerText);
  const summary = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Summarize the following webpage content concisely:" },
      { role: "user", content: content.slice(0, 10000) }
    ],
    temperature: 0.3,
  });
  return summary.choices?.[0]?.message?.content || '';
}

// @ts-expect-error
async function scroll(page: puppeteer.Page, direction: string) {
  await page.evaluate((dir:string) => {
    window.scrollBy(0, dir === 'down' ? window.innerHeight : -window.innerHeight);
  }, direction);
}
// @ts-expect-error

async function highlightElements(page: puppeteer.Page, selector: string) {
  await page.evaluate((sel:string) => {
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
    model: 'gpt-4o',
    messages: [
      { role: "system", content: "You are a QA testing assistant. Determine if the given task has been completed based on the current state." },
      { role: "user", content: `Task: ${task}\nCurrent state: ${currentState}\nHas the task been completed? Respond with a JSON object containing 'completed' (boolean) and 'reason' (string). Do not use any Markdown formatting in your response.` }
    ],
    max_tokens: 100,
    temperature: 0.3,
  });

  try {
    const content = response.choices?.[0]?.message?.content || '';
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
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a QA testing summary assistant. Provide a concise summary of the test results." },
      { role: "user", content: `Task: ${task}\n\nTest Results:\n${testResult}\n\nPlease provide a brief summary of the test execution and results.` }
    ],
    max_tokens: 150,
    temperature: 0.7,
  });
  return summary.choices?.[0]?.message?.content || '';
}

// @ts-expect-error

async function extractPageContent(page: puppeteer.Page): Promise<string> {
  return await page.evaluate(() => {
    return document.body.innerText + '\n' + 
           Array.from(document.querySelectorAll('input, button, a')).map(el => {
             return `${el.tagName} ${el.id ? `id="${el.id}"` : ''} ${el.className ? `class="${el.className}"` : ''} ${(el as HTMLElement).innerText || (el as HTMLInputElement).placeholder || ''}`;
           }).join('\n');
  });
}
// @ts-expect-error

async function selectOption(page: puppeteer.Page, selector: string, value: string) {
  await page.waitForSelector(selector, { timeout: 5000 });
  await page.select(selector, value);
}
// @ts-expect-error
async function forceSelectOption(page: puppeteer.Page, selector: string, value: string) {
  await page.evaluate((sel:string, val:string) => {
    const select = document.querySelector(sel) as HTMLSelectElement;
    if (select) {
      select.value = val;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, selector, value);
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