import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import puppeteer from 'puppeteer';
import { OpenAI } from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export const SYSTEM_PROMPT_FIRST_STEP = `
You are an advanced web navigation AI assistant. Given a user's task, determine the optimal starting point for accomplishing the goal.
Respond with a JSON object containing:
1. A concise rationale for your decision.
2. The initial URL to navigate to (either a direct URL or a Google search URL).

Response format:
{
    "thought": "Brief explanation of your reasoning",
    "param": "URL to start the task"
}

For Google searches, use the format: 'https://www.google.com/search?q=your+search+query'
Ensure the URL is properly encoded for web use.
`

export const SYSTEM_PROMPT_NEXT_STEP = (originalPrompt: string, currentURL: string, actionHistory: string) => `
You are an advanced web navigation AI assistant tasked with guiding a web browsing session.
Original task: "${originalPrompt}"
Current URL: ${currentURL}
Recent action history: ${actionHistory}

Provide the next optimal action to progress towards the goal. Ensure each action is unique and advances the task.
Confirm when the goal has been successfully achieved.

Respond with a JSON object in this format:
{
    "thought": "Brief explanation of your reasoning",
    "action": "CLICKBTN" | "WAITLOAD" | "TYPETEXT" | "NAVIGATEURL" | "SCROLL" | "HIGHLIGHT" | "SCREENSHOT" | "SUMMARIZE_PAGE" | "EXTRACT_LINKS" | "NONE",
    "ariaLabel": "Text content, aria label, or title of the element to interact with",
    "text": "Text to input (only for TYPETEXT action)",
    "param": "URL to navigate to (only for NAVIGATEURL action) or direction for SCROLL action"
}

Guidelines:
1. Use the visible text, aria label, or title of elements for the ariaLabel field.
2. To submit a search, add '\\n' at the end of the search text in the TYPETEXT action.
3. If unable to find elements or navigate to a URL, use the EXTRACT_LINKS action to get available links on the page.
4. Use the SCROLL action with "up" or "down" as the param to navigate long pages.
5. Use the HIGHLIGHT action to identify clickable elements or form fields.
6. Use the SCREENSHOT action to capture the current page state for analysis.
7. Use the SUMMARIZE_PAGE action to get an overview of the page content.
8. Ensure each action is distinct from the previous one.
9. If the goal is achieved, indicate so in the "thought" field and use the "NONE" action.
`

async function generateInstructions(task: string) {
  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: "system", content: SYSTEM_PROMPT_FIRST_STEP },
          { role: "user", content: task }
        ],
        max_tokens: 500,
        n: 1,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    try {
      return JSON.parse(content);
    } catch (error) {
      console.error(`Attempt ${attempt + 1}: Failed to parse JSON from ChatGPT response:`, content);
      attempt++;
      
      if (attempt >= maxAttempts) {
        throw new Error("Failed to get a valid JSON response after multiple attempts. Please try again.");
      }
    }
  }
}

async function executeWebTask(task: string) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  let result = '';
  let currentUrl = '';

  try {
    const initialStep = await generateInstructions(task);
    result += `Initial step:\n${JSON.stringify(initialStep, null, 2)}\n\n`;

    await page.goto(initialStep.param, { waitUntil: 'networkidle0', timeout: 60000 });
    currentUrl = initialStep.param;
    result += `Navigated to: ${currentUrl}\n`;

    let taskCompleted = false;
    let stepCount = 0;
    const maxSteps = 20; // Increased from 10 to allow for more complex tasks

    while (!taskCompleted && stepCount < maxSteps) {
      const nextStep = await generateNextStep(task, currentUrl, result);
      result += `Next step:\n${JSON.stringify(nextStep, null, 2)}\n\n`;

      if (nextStep.thought.toLowerCase().includes("task completed") || 
          nextStep.thought.toLowerCase().includes("goal achieved") ||
          nextStep.action.toLowerCase() === "none") {
        taskCompleted = true;
        result += "Task completed successfully.\n";
        break;
      }

      try {
        switch (nextStep.action) {
          case 'CLICKBTN':
            await clickElement(page, nextStep.ariaLabel);
            // Wait for video player to load
            await page.waitForSelector('video', { timeout: 10000 });
            // Check if video is playing
            const isPlaying = await page.evaluate(() => {
              const video = document.querySelector('video');
              return video && !video.paused && !video.ended && video.currentTime > 0;
            });
            if (!isPlaying) {
              // If not playing, try to click the play button
              await page.click('.ytp-play-button');
            }
            break;
          case 'TYPETEXT':
            await typeText(page, nextStep.text);
            break;
          case 'WAITLOAD':
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
            break;
          case 'NAVIGATEURL':
            if (nextStep.param) {
              await page.goto(nextStep.param, { waitUntil: 'networkidle0', timeout: 60000 });
              currentUrl = nextStep.param;
              result += `Navigated to: ${currentUrl}\n`;
            }
            break;
          case 'SCROLL':
            await scroll(page, nextStep.param);
            break;
          case 'HIGHLIGHT':
            await highlightElements(page, nextStep.ariaLabel);
            break;
          case 'SCREENSHOT':
            await takeScreenshot(page);
            result += `Screenshot saved as screenshot.png\n`;
            break;
          case 'SUMMARIZE_PAGE':
            const summary = await summarizePage(page);
            result += `Page summary: ${summary}\n`;
            break;
          case 'EXTRACT_LINKS':
            const links = await extractLinks(page);
            result += `Extracted links: ${JSON.stringify(links)}\n`;
            break;
          default:
            result += `Unknown action: ${nextStep.action}\n`;
            continue;
        }
        result += `Step completed successfully\n`;
        currentUrl = await page.url();
      } catch (stepError: any) {
        result += `Error executing step: ${stepError.message}\n`;
        // Don't reload the page automatically, let the AI decide what to do next
      }

      stepCount++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    result += `Final URL: ${currentUrl}\n`;
    await new Promise(resolve => setTimeout(resolve, 4000));

  } catch (error: any) {
    result += `Error: ${error.message}\n`;
  } finally {
    // await browser.close();
  }

  return { result, livePageUrl: currentUrl };
}

async function generateNextStep(task: string, currentUrl: string, actionHistory: string) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: "system", content: SYSTEM_PROMPT_NEXT_STEP(task, currentUrl, actionHistory) },
        { role: "user", content: "What's the next step?" }
      ],
      max_tokens: 500,
      n: 1,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to parse JSON from ChatGPT response:", content);
    throw new Error("Failed to get a valid JSON response. Please try again.");
  }
}

async function clickElement(page: puppeteer.Page, ariaLabel: string) {
  await page.waitForSelector('a#video-title, button, [role="button"], a, input[type="submit"]', { timeout: 5000 });
  await page.evaluate((label) => {
    const elements = Array.from(document.querySelectorAll('a#video-title, button, [role="button"], a, input[type="submit"]'));
    const element = elements.find(el => 
      el.textContent?.trim().toLowerCase().includes(label.toLowerCase()) ||
      el.getAttribute('aria-label')?.toLowerCase().includes(label.toLowerCase()) ||
      el.getAttribute('title')?.toLowerCase().includes(label.toLowerCase())
    );
    if (element) {
      (element as HTMLElement).click();
    } else {
      // If no exact match, click the first video
      const firstVideo = document.querySelector('a#video-title');
      if (firstVideo) (firstVideo as HTMLElement).click();
    }
  }, ariaLabel);
}

async function typeText(page: puppeteer.Page, text: string) {
  await page.waitForSelector('input[type="text"], input[type="search"]', { timeout: 5000 });
  await page.type('input[type="text"], input[type="search"]', text);
  if (text.endsWith('\n')) {
    await page.keyboard.press('Enter');
  }
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

async function takeScreenshot(page: puppeteer.Page) {
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
}

async function extractLinks(page: puppeteer.Page) {
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(link => ({
      text: link.textContent,
      href: link.href
    })).slice(0, 5); // Return only the first 5 links
  });
}

async function summarizePage(page: puppeteer.Page) {
  const content = await page.evaluate(() => document.body.innerText);
  const summary = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "Summarize the following webpage content concisely:" },
      { role: "user", content: content.slice(0, 10000) } // Limit to first 10000 characters
    ],
    temperature: 0.3,
  });
  return summary.choices[0].message.content;
}

export const aiRouter = createTRPCRouter({
  executeTask: publicProcedure
    .input(z.object({
      task: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await executeWebTask(input.task);
    }),
});