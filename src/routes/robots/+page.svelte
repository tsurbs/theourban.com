<script lang="ts">
</script>

<svelte:head>
    <title>Robots | Theo Urban</title>
    <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="robots-view">
    <div class="container">
        <h1>Welcome, Crawler!</h1>
        <p>
            You've been redirected to this page because we detected a robot or
            crawler user-agent.
        </p>
        <div class="status-box">
            <span class="pulse"></span>
            Detected:
            <code
                >{typeof window !== "undefined"
                    ? navigator.userAgent
                    : "Server-side Detection"}</code
            >
        </div>
        <p class="note">
            This page provides a simplified view for indexing and automated
            tools.
        </p>
        <a href="/" class="return-link">View Main Site</a>
    </div>
</main>

<style>
    .robots-view {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: #0a0a0a;
        color: #fff;
        font-family: "Courier New", Courier, monospace;
        padding: 20px;
    }

    .container {
        max-width: 600px;
        text-align: center;
        background: #1a1a1a;
        padding: 40px;
        border-radius: 12px;
        border: 1px solid #333;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    h1 {
        font-size: 2rem;
        margin-bottom: 20px;
        color: #10b981;
    }

    p {
        line-height: 1.6;
        color: #aaa;
        margin-bottom: 24px;
    }

    .status-box {
        background: #000;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        border: 1px solid #444;
    }

    code {
        color: #3b82f6;
        word-break: break-all;
    }

    .pulse {
        width: 12px;
        height: 12px;
        background: #10b981;
        border-radius: 50%;
        box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        }
        70% {
            transform: scale(1);
            box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
        }
        100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
        }
    }

    .note {
        font-size: 0.85rem;
        opacity: 0.6;
    }

    .return-link {
        color: #fff;
        text-decoration: none;
        border-bottom: 1px solid #10b981;
        padding-bottom: 2px;
        transition: opacity 0.2s;
    }

    .return-link:hover {
        opacity: 0.8;
    }
</style>
