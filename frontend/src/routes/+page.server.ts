// src/routes/+page.server.js

let question = "Hello, how are you?";
let answer = "I am fine, thank you!";

async function answerQuestion(user_question: string) {
    question = user_question;
    const query = new URLSearchParams({ question });
    const backend_url = import.meta.env.VITE_BACKEND_URL;
    const streamedAnswer = fetch(`${backend_url}/chat?` + query.toString(), { method: 'POST' }); // Awaited before initial render
    console.log('Streamed answer fetch initiated');
    // as streamedAnswer comes in, update answer
    for await (const chunk of (await streamedAnswer).body as any) {
        const text = new TextDecoder().decode(chunk);
        answer += text;
        load(); // Trigger re-render with updated answer
    }
    return answer;
}

export const load = async () => {
    return {
        initialData: {message: question},
        streamed: {completion: answer}
    };
};

export const actions = {
    refetchData: async ({ request }: { request: Request }) => {
    const formData = await request.formData();
    const query = formData.get('query');
    console.log('Refetching data with query:', query);  
    if (typeof query !== 'string') {
        return { success: false, error: 'Invalid query' };
    }
    const newData = answerQuestion(query);
    // Return data to be used in the load function or handled client-side
    return { success: true};
    }
};