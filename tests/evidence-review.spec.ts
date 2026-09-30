import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test.beforeEach(async ({ page }) => {
  const policy = readFileSync('dist/_headers', 'utf8').match(/Content-Security-Policy: (.+)/)?.[1];
  if (!policy) throw new Error('Built CSP is missing');
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': policy },
    });
  });
});

async function loadExample(page: Page) {
  await page.goto('/tools/evals');
  await page.getByRole('button', { name: 'Load fictional workshop example' }).click();
}

async function saveAAsFail(page: Page) {
  await page.getByLabel('Required result').selectOption('Fail');
  await page.getByLabel('Review reason').fill('The guarantee is not present in the notes.');
  await page.getByRole('button', { name: 'Save review for Draft A' }).click();
}

async function saveBAsPass(page: Page) {
  await page.getByLabel('Review draft').selectOption('1');
  await page.getByLabel('Required result').selectOption('Pass');
  await page.getByLabel('Review reason').fill('This only states the confirmed status.');
  await page.getByRole('button', { name: 'Save review for Draft B' }).click();
}

test('V1–V5: saves inspectable evidence, focuses current citations, keeps old citations outdated, exports, and resets locally', async ({
  page,
}) => {
  const submissionRequests: string[] = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(request.resourceType())) {
      submissionRequests.push(request.url());
    }
  });

  await loadExample(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  for (const heading of await page.locator('.evidence-section h2, .evidence-cards h2').all()) {
    const fontSize = await heading.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    expect(fontSize).toBeLessThanOrEqual(24);
  }
  await expect(page.getByRole('button', { name: 'Source passage 1, revision 1' })).toBeVisible();
  await expect(page.getByRole('note', { name: 'Selected source passage' })).toContainText(
    'The workshop has not measured outcomes.',
  );

  await saveAAsFail(page);
  await expect(page.getByText('The guarantee is not present in the notes.')).toBeVisible();
  await expect(page.getByText('Draft A saved reviews')).toBeVisible();
  const sourceCitation = page.getByRole('button', {
    name: 'Open source passage 1 from revision 1',
  });
  await sourceCitation.focus();
  await page.keyboard.press('Enter');
  const sourcePassage = page.getByRole('button', { name: 'Source passage 1, revision 1' });
  await expect(sourcePassage).toBeFocused();
  await expect(sourcePassage).toHaveAttribute('data-highlighted', 'true');
  await expect(page.locator('.skip-link')).not.toBeFocused();

  await page.getByLabel('Review draft').selectOption('1');
  await expect(page.getByLabel('Review reason')).toHaveValue('');
  await saveBAsPass(page);
  await expect(page.getByText('Draft B is eligible based on your saved reviews.')).toBeVisible();
  await expect(
    page.getByText('Weighted preferences compare only drafts that meet required checks.'),
  ).toBeVisible();

  await page.getByRole('textbox', { name: 'Draft B', exact: true }).fill('Changed draft B.');
  await expect(page.getByText('Draft B: Review outdated')).toBeVisible();
  await expect(
    page.locator('.evidence-card.outdated').filter({ hasText: 'Draft B' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open Draft B passage 1 from revision 1' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Review Draft B check Avoid unsupported promises again' })
    .click();
  await expect(page.getByLabel('Review reason')).toHaveValue('');
  await page.getByLabel('Required result').selectOption('Pass');
  await page.getByLabel('Review reason').fill('This edited draft is now reviewed deliberately.');
  await page.getByRole('button', { name: 'Save review for Draft B' }).click();
  await expect(
    page.getByRole('button', { name: 'Open Draft B passage 1 from revision 2' }),
  ).toBeVisible();

  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const jsonPath = await (await jsonDownload).path();
  expect(jsonPath).not.toBeNull();
  const json = JSON.parse(readFileSync(jsonPath!, 'utf8'));
  expect(json.version).toBe(2);
  expect(json.snapshots.length).toBeGreaterThanOrEqual(3);
  expect(json.judgments.some((judgment: { state: string }) => judgment.state === 'Outdated')).toBe(
    true,
  );

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const csvPath = await (await csvDownload).path();
  expect(csvPath).not.toBeNull();
  const csv = readFileSync(csvPath!, 'utf8');
  expect(csv).toContain('rating state');
  expect(csv).toContain('validation error');
  expect(csv).toContain('Outdated');

  await page.getByRole('button', { name: 'Reset all' }).click();
  await expect(page.getByLabel('Source notes', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Review reason')).toHaveValue('');
  await expect(page.getByText('Saved reasons and citations will appear here.')).toBeVisible();
  expect(submissionRequests).toEqual([]);
});

test('V3 and V6: full selected quotations wrap and the workflow has no horizontal overflow at all required widths', async ({
  page,
}) => {
  await loadExample(page);
  const source = `A long source passage with the same beginning ${'x'.repeat(240)} and a source ending.`;
  const draft = `A long draft passage with the same beginning ${'x'.repeat(240)} and a distinct draft ending.`;
  await page.getByLabel('Source notes', { exact: true }).fill(source);
  await page.getByLabel('Draft A', { exact: true }).fill(draft);
  await page.getByLabel('Draft B', { exact: true }).fill(draft);

  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('note', { name: 'Selected source passage' })).toContainText(
      'a source ending.',
    );
    await expect(page.getByRole('note', { name: 'Selected draft passage' })).toContainText(
      'a distinct draft ending.',
    );
    const dimensions = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      html: document.documentElement.scrollWidth,
      width: window.innerWidth,
    }));
    expect(dimensions.body, `body overflows at ${width}px`).toBeLessThanOrEqual(dimensions.width);
    expect(dimensions.html, `document overflows at ${width}px`).toBeLessThanOrEqual(
      dimensions.width,
    );
  }
});

test('Important 5 and Minor 1: changing required checks invalidates old evidence and resets a removed check selection', async ({
  page,
}) => {
  await loadExample(page);
  await saveAAsFail(page);
  await page.getByRole('button', { name: 'Add required check' }).click();
  await expect(page.getByText('Draft A: Review outdated')).toBeVisible();
  await page.getByLabel('Review check').selectOption('1');
  await page.getByRole('button', { name: 'Remove required check 2' }).click();
  await expect(page.getByLabel('Review check')).toHaveValue('0');
  await expect(page.getByLabel('Review reason')).toHaveValue('');
  await page.getByLabel('Review reason').fill('The remaining check has a fresh review.');
  await page.getByRole('button', { name: 'Save review for Draft A' }).click();
  await expect(page.locator('.evidence-card').filter({ hasText: 'Current review' })).toBeVisible();
});

test('round 2: marks superseded duplicate judgments, keeps partial reviews incomplete, and exposes specific over-limit errors', async ({
  page,
}) => {
  await page.goto('/tools/evals');
  await expect(
    page.getByText('Add your notes and both drafts, then name a check each draft must pass.'),
  ).toBeVisible();
  await expect(page.locator('.evidence-validation')).toHaveCount(0);
  await loadExample(page);
  await page.getByLabel('Required result').selectOption('Pass');
  await page.getByLabel('Review reason').fill('First pass stays in the history.');
  await page.getByRole('button', { name: 'Save review for Draft A' }).click();
  await page.getByLabel('Required result').selectOption('Fail');
  await page.getByLabel('Review reason').fill('Second fail controls the current review.');
  await page.getByRole('button', { name: 'Save review for Draft A' }).click();

  const draftAReviews = page.getByRole('region', { name: 'Draft A saved reviews' });
  const superseded = draftAReviews.locator('.evidence-card.superseded');
  const active = draftAReviews.locator('.evidence-card:not(.superseded):not(.outdated)');
  await expect(superseded).toHaveCount(1);
  await expect(superseded).toContainText('Superseded review');
  await expect(active).toHaveCount(1);
  await expect(active).toContainText('Current review');
  await expect(page.getByText('Draft A: Needs changes')).toBeVisible();

  await loadExample(page);
  await page.getByRole('button', { name: 'Add required check' }).click();
  await page.getByLabel('Required result').selectOption('Pass');
  await page.getByLabel('Review reason').fill('Only the first check is current.');
  await page.getByRole('button', { name: 'Save review for Draft A' }).click();
  await expect(page.getByText('Draft A: Unreviewed')).toBeVisible();
  await expect(page.getByText('Draft A: Review outdated')).toHaveCount(0);

  await page.getByLabel('Draft A', { exact: true }).fill('Edited Draft A.');
  await expect(page.getByText('Draft A: Review outdated')).toBeVisible();
  await page
    .getByRole('button', { name: 'Review Draft A check Avoid unsupported promises again' })
    .click();
  await page.getByLabel('Required result').selectOption('Pass');
  await page.getByLabel('Review reason').fill('The stale first check is now current.');
  await page.getByRole('button', { name: 'Save review for Draft A' }).click();
  await expect(page.getByText('Draft A: Unreviewed')).toBeVisible();

  await page.getByLabel('Source notes', { exact: true }).fill('x'.repeat(20_001));
  await expect(page.getByText('Source notes must be 20,000 characters or fewer.')).toBeVisible();
});

test('captures current citations, full quotes, and outdated evidence at the required viewports', async ({
  page,
}) => {
  test.skip(process.env.CAPTURE_UI !== '1', 'Set CAPTURE_UI=1 to create review evidence captures.');
  await loadExample(page);
  await saveAAsFail(page);
  await saveAAsFail(page);
  await expect(page.locator('.evidence-card.superseded')).toHaveCount(1);
  await saveBAsPass(page);
  await page.getByRole('textbox', { name: 'Draft B', exact: true }).fill('Changed draft B.');
  await page.getByRole('button', { name: 'Open source passage 1 from revision 1' }).click();

  const captureDirectory = resolve(
    process.cwd(),
    'test-results',
    'evidence-review-captures',
  );
  mkdirSync(captureDirectory, { recursive: true });
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1200 });
    await page.screenshot({
      path: resolve(captureDirectory, `evidence-review-${width}.png`),
      fullPage: true,
    });
  }
});
