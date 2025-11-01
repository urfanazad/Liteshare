# Deploying LiteShare to Vercel

This guide will walk you through deploying the LiteShare signaling server to Vercel and configuring the browser extension to connect to it.

## Step 1: Push to GitHub

Before deploying, make sure your project is in a GitHub repository. Vercel connects directly to your repository to build and deploy your application.

## Step 2: Deploy to Vercel

1.  **Sign up or log in** to your Vercel account.
2.  **Import your project:**
    *   From your Vercel dashboard, click **"Add New..."** -> **"Project"**.
    *   Select your GitHub repository.
3.  **Configure the project:**
    *   Vercel should automatically detect that you're using Python and configure the build settings. You shouldn't need to change anything here.
4.  **Add Environment Variable:**
    *   Before deploying, go to the **"Environment Variables"** section.
    *   Add a new variable named `LITESHARE_TOKEN`.
    *   For the value, create a strong, secret token (e.g., you can use a password generator). This will secure your WebSocket endpoint.
5.  **Deploy:**
    *   Click the **"Deploy"** button. Vercel will build and deploy your application.

## Step 3: Configure and Use the Browser Extension

Once the deployment is complete, Vercel will assign you a public URL (e.g., `https://your-app-name.vercel.app`). You can now configure the extension to connect to your live server.

1.  **Get your Vercel URL and Token:**
    *   You can find your URL on your Vercel project dashboard.
    *   Your token is the one you created in Step 2.
2.  **Load and Configure the Extension:**
    *   Open your browser and navigate to `chrome://extensions`.
    *   Make sure "Developer mode" is enabled.
    *   Click **"Load unpacked"** and select the `extension` folder from this project.
    *   Click the LiteShare extension icon in your browser toolbar.
3.  **Enter Your Credentials:**
    *   The extension will first prompt you for your **Vercel app name** (e.g., `liteshare-xyz` from `https://liteshare-xyz.vercel.app`).
    *   It will then prompt you for your **LiteShare token**.
    *   Once entered, you can join a room and start sharing.

## Step 4: Publish to the Chrome Web Store (Optional)

If you plan to publish the extension, it is recommended to build a proper options page for users to store their Vercel URL and token, rather than using prompts.
