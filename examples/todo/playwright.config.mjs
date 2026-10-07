import { defineConfig } from '@playwright/test';
export default defineConfig({
 workers: 3, testDir: './test', testMatch: '**/*.spec.mjs', fullyParallel: true,
 reporter: [['list'], ['html', {open:'never'}]],
 use: {baseURL:'http://127.0.0.1:4173', trace:'retain-on-failure'},
 webServer: {command:'node scripts/serve.mjs', url:'http://127.0.0.1:4173', reuseExistingServer:false},
 projects: [{name:'chromium',use:{browserName:'chromium'}},{name:'firefox',use:{browserName:'firefox'}},{name:'webkit',use:{browserName:'webkit'}}]
});
