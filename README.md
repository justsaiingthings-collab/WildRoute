# 🏔️ WildRoute

Find campsites, dispersed camping areas, and top-rated trails near any US destination — powered by Claude AI.

## Deploy Free in 5 Minutes (Vercel)

### 1. Get an Anthropic API Key
Go to [console.anthropic.com](https://console.anthropic.com/) → API Keys → Create Key.

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
# Create a new repo at github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/wildroute.git
git push -u origin main
```

### 3. Deploy on Vercel (free)
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"** → import your `wildroute` repo
3. In **Environment Variables**, add:
   - **Name:** `VITE_ANTHROPIC_API_KEY`
   - **Value:** your `sk-ant-...` key
4. Click **Deploy** — done! You'll get a free `*.vercel.app` URL.

---

## Alternative: Netlify (also free)

1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
2. Connect GitHub and select your repo
3. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. **Site configuration → Environment variables** → add `VITE_ANTHROPIC_API_KEY`
5. **Trigger deploy** — you'll get a free `*.netlify.app` URL.

---

## Run Locally

```bash
cp .env.example .env.local
# edit .env.local and paste your API key

npm install
npm run dev
# open http://localhost:5173
```

## ⚠️ API Key Security Note

Your API key is used **directly from the browser**. This is fine for personal use or demos, but if you make the URL public, anyone who visits can run up API costs. To protect against abuse you can:
- Add a Vercel Edge Function as a proxy (keeps key server-side)
- Set spending limits at [console.anthropic.com](https://console.anthropic.com/)
- Password-protect the Vercel deployment (Vercel dashboard → Settings → Password Protection)

## Screen Shots

![](https://github.com/justsaiingthings-collab/WildRoute/blob/main/images/campsites.png)
![](https://github.com/justsaiingthings-collab/WildRoute/blob/main/images/dispersed.png)
![](https://github.com/justsaiingthings-collab/WildRoute/blob/main/images/dispersedData.png)
![](https://github.com/justsaiingthings-collab/WildRoute/blob/main/images/trails.png)

