# Address the Stinky Fish

A web app for the "Stinky Fish" team exercise — each person privately answers
four reflection prompts, picks their top 3 unspoken issues, and the team pools
everyone's answers onto a shared board to sort into Quick Wins / Big Wins and
agree on next steps.

## What you're deploying

This is a small Next.js app with two parts:

- **The page itself** (`pages/index.js`) — what people see and interact with.
- **Two API routes** (`pages/api/board/...`) — these run on Vercel's servers
  and talk to a shared Redis database, so everyone's submissions show up on
  everyone else's screen.

You don't need to touch any code to deploy this. Follow the steps below.

## Deploy steps

### 1. Get the code onto GitHub

If you don't already have a GitHub account, make one (free). Then:

- Create a new repository (any name, e.g. `stinky-fish`).
- Upload this whole folder into it. The easiest way: on the new repo's page,
  click **uploading an existing file**, then drag in everything from this
  folder (including the hidden `.gitignore` file — your file browser may need
  to be set to show hidden files).

### 2. Import the project into Vercel

- Go to [vercel.com](https://vercel.com) and sign in (you can sign in with
  your GitHub account directly).
- Click **Add New... → Project**.
- Pick the repository you just created and click **Import**.
- Leave all the build settings on their defaults — Vercel recognizes Next.js
  automatically. Click **Deploy**.

Your first deploy will go live, but submitting fish won't work yet — that
needs a database, which is the next step.

### 3. Add a Redis database

- In your new Vercel project, go to the **Storage** tab.
- Click **Create Database**.
- You'll see a few Redis options in the Marketplace — **either "Redis" or
  "Upstash" works** with this app, so pick whichever one you're comfortable
  with. Both have a genuinely free tier with no card required for normal use
  at this scale.
- Follow its setup prompts — when asked to pick a plan/tier, choose the
  **free** option. Region doesn't matter much for a small team tool like
  this; pick whatever's closest to you.
- When it asks which project to connect to, choose this one. This is what
  injects the database credentials into your project automatically — you
  won't need to copy any keys yourself.

Vercel automatically adds the right environment variables for whichever
provider you chose. You don't need to know or set these yourself.

### 4. Redeploy

Environment variables only take effect on a new deploy. Go to your project's
**Deployments** tab, click the **...** menu on the most recent deployment,
and choose **Redeploy**.

That's it — your app is live at the `.vercel.app` URL Vercel gave you (or a
custom domain, if you add one under **Settings → Domains**).

## Using it

- Share the site's URL with your team.
- Everyone picks the same **session code** (e.g. `marketing-q3`) when they
  open the app — that's what groups your team's fish together. Anyone who
  enters the same code sees the same shared board.
- Each person privately fills out the four prompts and submits their top 3.
  Submissions are anonymous — no names are ever stored.
- Once people start submitting, anyone on the team can open the **Team
  board** tab to see everything pooled together, drag fish into Quick Wins /
  Big Wins, and fill out the action plan. This updates live for everyone
  (checks for updates every few seconds).

## If something's not syncing

If you see a "Sync problem" banner in the app, it almost always means the
Redis database isn't connected yet — double check steps 3 and 4 above, in
that order (the database has to exist *and* you have to redeploy after
adding it). If you already have a database connected and just updated the
code (e.g. re-uploaded this project), you don't need to touch the database
again — just redeploy so the new code picks up the same environment
variables.

## Running it on your own computer (optional)

Only needed if you want to test changes locally before deploying.

```
npm install
npm run dev
```

This starts the app at `http://localhost:3000`. Fish submission won't work
locally unless you also create a `.env.local` file with your own Redis
credentials — see `.env.example` for the variable names.
