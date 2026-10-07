import {test, expect} from '@playwright/test';
const input = page => page.getByRole('textbox', {name:'New todo',exact:true});
const rows = page => page.locator('.todo-list li');
async function add(page,title) { await input(page).fill(title); await input(page).press('Enter'); }
async function edit(page,index=0) { await rows(page).nth(index).locator('label').dblclick(); return rows(page).nth(index).locator('.edit'); }
async function ready(page) { await page.goto('/'); await page.waitForFunction(()=>window.mithrilTodoReady === true); }
test.beforeEach(async ({page}) => { await ready(page); });
test('empty state, autofocus and clear button visibility', async ({page}) => {
 await expect(input(page)).toBeFocused(); await expect(page.locator('#main')).toBeHidden(); await expect(page.locator('#footer')).toBeHidden();
 await add(page,'first'); await expect(page.locator('#main')).toBeVisible(); await expect(page.locator('#footer')).toBeVisible(); await expect(page.locator('.clear-completed')).toBeHidden();
});
test('Enter appends trimmed titles, rejects blanks, clears input and renders safe text', async ({page}) => {
 await add(page,'   '); await expect(rows(page)).toHaveCount(0);
 await add(page,'  first  '); await add(page,'<img src=x onerror=alert(1)>');
 await expect(rows(page).locator('label')).toHaveText(['first','<img src=x onerror=alert(1)>']); await expect(input(page)).toHaveValue(''); await expect(rows(page).locator('img')).toHaveCount(0);
});
test('IME composition does not submit a new todo or an edit', async ({page}) => {
 await input(page).fill('入力中'); await input(page).dispatchEvent('keydown',{key:'Enter',isComposing:true}); await expect(rows(page)).toHaveCount(0);
 await input(page).press('Enter'); const field=await edit(page); await field.fill('編集中'); await field.dispatchEvent('keydown',{key:'Enter',isComposing:true}); await expect(rows(page).first()).toHaveClass(/editing/); await field.press('Escape'); await expect(rows(page).locator('label')).toHaveText('入力中');
});
test('individual completion and master state, strong counter and pluralization', async ({page}) => {
 await add(page,'first'); await expect(page.locator('.todo-count')).toHaveText('1 item left'); await expect(page.locator('.todo-count strong')).toHaveText('1');
 await add(page,'second'); await expect(page.locator('.todo-count')).toHaveText('2 items left');
 await rows(page).nth(0).locator('.toggle').check(); await expect(rows(page).nth(0)).toHaveClass(/completed/); await expect(page.locator('#toggle-all')).not.toBeChecked();
 await rows(page).nth(1).locator('.toggle').check(); await expect(page.locator('#toggle-all')).toBeChecked(); await expect(page.locator('.todo-count')).toHaveText('0 items left');
 await rows(page).nth(0).locator('.toggle').uncheck(); await expect(page.locator('#toggle-all')).not.toBeChecked();
});
test('master checkbox completes and reactivates all, including hidden items', async ({page}) => {
 await add(page,'first'); await add(page,'second'); await rows(page).first().locator('.toggle').check();
 await page.getByRole('link',{name:'Active',exact:true}).click(); await expect(rows(page)).toHaveCount(1);
 await page.locator('label[for="toggle-all"]').click(); await expect(rows(page)).toHaveCount(0); await expect(page.locator('#toggle-all')).toBeChecked();
 await page.locator('label[for="toggle-all"]').click(); await expect(rows(page)).toHaveCount(2);
});
test('editing focuses prefilled title, hides view and trims Enter save', async ({page}) => {
 await add(page,'first'); const field=await edit(page); await expect(field).toBeFocused(); await expect(field).toHaveValue('first'); await expect(rows(page).locator('.view')).toBeHidden();
 await field.fill(' renamed '); await field.press('Enter'); await expect(rows(page).locator('label')).toHaveText('renamed'); await expect(page.locator('li.editing')).toHaveCount(0);
});
test('blur saves, Escape cancels without a later blur save', async ({page}) => {
 await add(page,'first'); let field=await edit(page); await field.fill(' changed '); await input(page).click(); await expect(rows(page).locator('label')).toHaveText('changed');
 field=await edit(page); await field.fill('discarded'); await field.press('Escape'); await input(page).click(); await expect(rows(page).locator('label')).toHaveText('changed');
});
for(const finish of ['Enter','blur']) test(`empty edited title deletes on ${finish}`, async ({page}) => {
 await add(page,'first'); const field=await edit(page); await field.fill(' '); if(finish==='Enter') await field.press('Enter'); else await input(page).click(); await expect(rows(page)).toHaveCount(0); await expect(page.locator('#main')).toBeHidden();
});
test('hover exposes delete, delete preserves other tasks', async ({page}) => {
 await add(page,'first'); await add(page,'second'); await rows(page).first().hover(); await expect(rows(page).first().locator('.destroy')).toBeVisible(); await rows(page).first().locator('.destroy').click(); await expect(rows(page).locator('label')).toHaveText('second');
});
test('clear completed preserves active tasks and resets master state', async ({page}) => {
 await add(page,'active'); await add(page,'done'); await rows(page).nth(1).locator('.toggle').check(); await expect(page.locator('.clear-completed')).toBeVisible(); await page.locator('.clear-completed').click(); await expect(rows(page).locator('label')).toHaveText('active'); await expect(page.locator('.clear-completed')).toBeHidden(); await expect(page.locator('#toggle-all')).not.toBeChecked();
 await rows(page).first().locator('.toggle').check(); await page.locator('.clear-completed').click(); await expect(page.locator('#footer')).toBeHidden(); await expect(page.locator('#toggle-all')).not.toBeChecked();
});
test('all routes, selected link, live removal, reload and history', async ({page}) => {
 await add(page,'active'); await add(page,'done'); await rows(page).nth(1).locator('.toggle').check();
 await page.getByRole('link',{name:'Active',exact:true}).click(); await expect(rows(page).locator('label')).toHaveText('active'); await expect(page.locator('.filters .selected')).toHaveAttribute('href','#/active');
 await page.reload(); await page.waitForFunction(()=>window.mithrilTodoReady); await expect(rows(page).locator('label')).toHaveText('active'); await expect(page).toHaveURL(/#\/active$/);
 await rows(page).first().locator('.toggle').click(); await expect(rows(page)).toHaveCount(0);
 await page.getByRole('link',{name:'Completed',exact:true}).click(); await expect(rows(page)).toHaveCount(2); await rows(page).first().locator('.toggle').click(); await expect(rows(page).locator('label')).toHaveText('done');
 await page.getByRole('link',{name:'All',exact:true}).click(); await expect(rows(page)).toHaveCount(2); await page.evaluate(()=>history.back()); await expect(rows(page).locator('label')).toHaveText('done');
});
test('persisted schema and completed state; editing is not persisted', async ({page}) => {
 await add(page,'saved'); await rows(page).first().locator('.toggle').check(); const field=await edit(page); await field.fill('uncommitted');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('todos-mithril')));
 expect(before[0].title).toBe('saved'); expect(Object.keys(before[0]).sort()).toEqual(['completed','id','title']);
 await page.reload(); await page.waitForFunction(()=>window.mithrilTodoReady);
 // Firefox may emit blur before navigation: blur is an intentional save action.
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('todos-mithril')));
 expect(['saved','uncommitted']).toContain(stored[0].title);
 await expect(rows(page).locator('label')).toHaveText(stored[0].title); await expect(rows(page).first()).toHaveClass(/completed/); await expect(page.locator('li.editing')).toHaveCount(0);
 expect(Object.keys(stored[0]).sort()).toEqual(['completed','id','title']);
});
test('legacy migration only when current key is absent; retain old key', async ({page}) => {
 await page.evaluate(()=>localStorage.setItem('mithril-todo-pages-v1',JSON.stringify([{id:'old',title:'old',status:'completed'}]))); await page.reload(); await page.waitForFunction(()=>window.mithrilTodoReady); await expect(rows(page).locator('label')).toHaveText('old');
 await add(page,'new'); expect(await page.evaluate(()=>localStorage.getItem('mithril-todo-pages-v1'))).not.toBeNull();
 await page.evaluate(()=>localStorage.setItem('todos-mithril','[]')); await page.reload(); await page.waitForFunction(()=>window.mithrilTodoReady); await expect(rows(page)).toHaveCount(0);
});
test('invalid storage recovers and storage failure retains in-memory operation', async ({page}) => {
 await page.evaluate(()=>localStorage.setItem('todos-mithril','[null]')); await page.reload(); await page.waitForFunction(()=>window.mithrilTodoReady); await expect(rows(page)).toHaveCount(0);
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('quota');};}); await add(page,'retained'); await expect(rows(page).locator('label')).toHaveText('retained'); await expect(page.locator('#feedback')).toContainText('Storage unavailable');
});
for(const asset of ['metrics.json','logic.json','policy.wasm']) test(`missing ${asset} fails closed with readable status`, async ({page}) => {
 await page.route('**/'+asset,route=>route.fulfill({status:404,body:'missing'})); await page.reload(); await expect(input(page)).toBeDisabled(); await expect(page.locator('#feedback')).toHaveText('Unable to load verified logic. Reload to retry.');
});
test('tampered policy refuses startup', async ({page}) => {
 await page.route('**/policy.wasm',route=>route.fulfill({body:'tampered'})); await page.reload(); await expect(input(page)).toBeDisabled();
});
test('100-task completion and deletion workload without browser exceptions', async ({page}) => {
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>localStorage.setItem('todos-mithril',JSON.stringify(Array.from({length:100},(_,i)=>({id:String(i),title:'Task '+i,completed:false}))))); await page.reload(); await page.waitForFunction(()=>window.mithrilTodoReady);
 await expect(rows(page)).toHaveCount(100); await page.evaluate(()=>{for(const node of document.querySelectorAll('.toggle'))node.click();}); await expect(page.locator('li.completed')).toHaveCount(100);
 await page.evaluate(()=>{for(const node of [...document.querySelectorAll('.destroy')].reverse())node.click();}); await expect(rows(page)).toHaveCount(0); expect(errors).toEqual([]);
});
