async function checkAlive() {
    return (await fetch(`${process.env.BACKEND_URL || "http://localhost:8000"}/`)).status || 'unknown';
}

export const load = async () => {
    return {
        streamed: { backend_isalive: checkAlive() }
    };
};