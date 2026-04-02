FROM node:20-alpine
# Minimal image for Story Magic cron jobs.
# WEB_URL and CRON_SECRET are injected by Render at runtime.
CMD ["node", "-e", "\
fetch(process.env.WEB_URL + '/api/cron/prize-draw', {\
  method: 'POST',\
  headers: { 'x-cron-secret': process.env.CRON_SECRET }\
})\
.then(r => r.json())\
.then(d => { console.log(JSON.stringify(d)); process.exit(0); })\
.catch(e => { console.error(e.message); process.exit(1); })\
"]
