import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';
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

async function generateNextStep(page: puppeteer.Page, currentState: string, task: string, completedActions: string[], pageContent: string) {
  try {
    const htmlContent = await page.evaluate(() => document.documentElement.outerHTML);
    const truncatedHtml = htmlContent.slice(0, 10000);

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
          await page.evaluate((sel:string) => {
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
          console.log(`Failed to click ${selector} even after scrolling: ${scrollError.message}`);
          return false;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
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
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Summarize the following webpage content concisely:" },
      { role: "user", content: content.slice(0, 10000) }
    ],
    temperature: 0.3,
  });
  return summary.choices?.[0]?.message?.content || '';
}

async function scroll(page: puppeteer.Page, direction: string) {
  await page.evaluate((dir:string) => {
    window.scrollBy(0, dir === 'down' ? window.innerHeight : -window.innerHeight);
  }, direction);
}

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

async function selectOption(page: puppeteer.Page, selector: string, value: string) {
  await page.waitForSelector(selector, { timeout: 5000 });
  await page.select(selector, value);
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

async function summarizeErrors(errors: string[]): Promise<string> {
  const errorText = errors.join('\n');
  const summary = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an error analysis assistant. Summarize the following errors, focusing only on the most important ones that could affect the functionality of the website. Ignore minor issues, expected behaviors, or permission policy errors related to 'unload' events. These are generally not critical for functionality." },
      { role: "user", content: errorText }
    ],
    max_tokens: 150,
    temperature: 0.3,
  });
  return summary.choices?.[0]?.message?.content || '';
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

async function extractPageContent(page: puppeteer.Page): Promise<string> {
  return await page.evaluate(() => {
    return document.body.innerText + '\n' + 
           Array.from(document.querySelectorAll('input, button, a')).map(el => {
             return `${el.tagName} ${el.id ? `id="${el.id}"` : ''} ${el.className ? `class="${el.className}"` : ''} ${(el as HTMLElement).innerText || (el as HTMLInputElement).placeholder || ''}`;
           }).join('\n');
  });
}

const TIMEOUT = 60000; // 60 seconds timeout
const LOAD_FAIL = Symbol('LOAD_FAIL');

const sleep = (options: { ms: number, result?: any }) => new Promise(resolve => {
  setTimeout(resolve, options.ms, options.result === undefined ? true : options.result);
});

export async function runQualityAnalysis(url: string, task: string): Promise<any> {
  let browser;
  try {
    const executablePath = process.env.NODE_ENV === 'production'
      ? await chromium.executablePath
      : '/usr/bin/google-chrome-stable'; // Adjust this path for your local Chrome installation

    const options = {
      args: [...chromium.args, '--enable-blink-features=HTMLImports'],
      executablePath: executablePath,
      headless: chromium.headless,
    };

    if (process.env.NODE_ENV === 'development') {
      // For local development, use these options
      options.headless = true;
      options.args = ['--no-sandbox', '--disable-setuid-sandbox', '--enable-blink-features=HTMLImports'];
    }

    browser = await puppeteer.launch(options);
    const page = await browser.newPage();

    const sleepOptions = { ms: TIMEOUT - 1000, result: LOAD_FAIL };
    const response = await Promise.race([
      sleep(sleepOptions),
      page.goto(url, { timeout: TIMEOUT + 1000 }),
    ]);

    const success = response !== LOAD_FAIL;

    if (!success) {
      return { 
        result: "Navigation failed due to timeout", 
        screenshots: [], 
        error: "Page load timed out" 
      };
    }

    if (!response?.ok()) {
      const statusCode = response?.status();
      return { 
        result: `Critical error: HTTP status ${statusCode}`, 
        screenshots: [], 
        error: `HTTP status ${statusCode}` 
      };
    }

    let result = '';
    let currentState = `URL: ${url}`;
    let screenshots: string[] = [];
    let completedActions: string[] = [];
    let videoClicked = false;
    let criticalErrorOccurred = false;
    let errors: string[] = [];
    let actionAttempts: { [key: string]: number } = {};
    let pageErrorOccurred = false;

    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warn') {
        errors.push(`Console ${msg.type()}: ${msg.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      const errorMessage = error.message;
      if (errorMessage.includes('React') || errorMessage.includes('must be used within')) {
        result += `Critical React Error: ${errorMessage}\n`;
        criticalErrorOccurred = true;
      } else {
        result += `Page Error: ${errorMessage}\n`;
      }
      errors.push(`Page error: ${errorMessage}`);
      pageErrorOccurred = true;
    });

    page.on('requestfailed', request => {
      const failure = request.failure();
      if (failure && failure.errorText !== 'net::ERR_ABORTED') {
        errors.push(`Network error: ${request.url()} ${failure.errorText}`);
        if (failure.errorText.includes('ERR_CONNECTION_REFUSED') || failure.errorText.includes('ERR_NAME_NOT_RESOLVED')) {
          criticalErrorOccurred = true;
        }
      }
    });

    if (pageErrorOccurred) {
      return { result, screenshots, error: "Page error occurred" };
    }
    
    let taskCompleted = false;
    let stepCount = 0;
    const maxSteps = 15;

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
            if (nextStep.params?.url && !completedActions.includes('NAVIGATE')) {
              await page.goto(nextStep.params.url, { waitUntil: 'networkidle0', timeout: 60000 });
              currentState = `URL: ${await page.url()}`;
              completedActions.push('NAVIGATE');
            }
            break;
          case 'CLICK':
            if (nextStep.params?.selector) {
              await clickWithRetry(page, nextStep.params.selector);
              completedActions.push(`CLICK_${nextStep.params.selector}`);
              if (nextStep.params.selector === '#video-title' || nextStep.params.selector === 'a[title]') {
                videoClicked = true;
              }
            }
            break;
          case 'TYPE':
            if (nextStep.params?.selector && nextStep.params?.text) {
              await typeText(page, nextStep.params.selector, nextStep.params.text);
              completedActions.push(`TYPE_${nextStep.params.selector}`);
            }
            break;
          case 'WAIT':
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
            await scroll(page, nextStep.params?.direction || 'down');
            completedActions.push('SCROLL');
            break;
          case 'HIGHLIGHT':
            if (nextStep.params?.selector) {
              await highlightElements(page, nextStep.params.selector);
              completedActions.push(`HIGHLIGHT_${nextStep.params.selector}`);
            }
            break;
          case 'SELECT':
            if (nextStep.params?.selector && nextStep.params?.value) {
              await selectOption(page, nextStep.params.selector, nextStep.params.value);
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
          const alternativeSelector = await findAlternativeSelector(page, nextStep.params?.selector);
          if (alternativeSelector) {
            result += `Trying alternative selector: ${alternativeSelector}\n`;
            await (nextStep.action === 'CLICK' ? clickWithRetry(page, alternativeSelector) : typeText(page, alternativeSelector, nextStep.params?.text));
            result += `Step completed successfully with alternative selector\n`;
            if (nextStep.action === 'CLICK' && (alternativeSelector === '#video-title' || alternativeSelector === 'a[title]')) {
              videoClicked = true;
            }
          }
        }
      }

      currentState = `URL: ${await page.url()}\nLast action: ${nextStep.action}\nCompleted actions: ${completedActions.join(', ')}`;
      stepCount++;

      if (videoClicked) {
        const isPlaying = await checkIfVideoPlaying(page);
        if (isPlaying) {
          taskCompleted = true;
          result += `Task completed: Video is playing.\n`;
        }
      }
    }

    if (!taskCompleted) {
      result += "Maximum steps reached without completing the task.\n";
    }

    const criticalErrors = errors.filter(error => 
      !error.includes("Permissions policy violation: unload is not allowed")
    );

    if (criticalErrors.length > 0) {
      const errorSummary = await summarizeErrors(criticalErrors);
      result += `\nImportant Errors:\n${errorSummary}`;
    } else {
      result += "\nNo critical errors were detected during the test.";
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