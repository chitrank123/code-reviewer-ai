import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';

function App() {
    const [code, setCode] = useState("def calculate_fibonacci(n):\n    \"\"\"A suboptimal function to calculate fibonacci numbers.\"\"\"\n    if n <= 0:\n        return 0\n    elif n == 1:\n        return 1\n    else:\n        return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)\n\n# Calling the function with a value that might be slow\nprint(calculate_fibonacci(10))");
    const [review, setReview] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [htmlReview, setHtmlReview] = useState('');
    const [language, setLanguage] = useState('python');

    useEffect(() => {
        if (review) {
            // Using marked to parse the markdown string into an HTML string
            const rawHtml = marked.parse(review);
            setHtmlReview(rawHtml);
        } else {
            setHtmlReview('');
        }
    }, [review]);

    const handleReviewRequest = async () => {
        setIsLoading(true);
        setError(null);
        setReview('');

        try {
            const response = await fetch('http://127.0.0.1:5000/api/review-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            setReview(data.review);

        } catch (e) {
            console.error(e);
            setError('Failed to get review. Please ensure the backend server is running and accessible.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="min-h-screen w-full p-4 sm:p-6 lg:p-8 bg-slate-900 text-slate-300 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-full border border-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">AI Code Review Assistant</h1>
                    </div>
                    <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
                        Select a language, paste your code, and our AI will provide a detailed analysis.
                    </p>
                </header>

                {/* --- Main Content Grid --- */}
                {/* This structure prevents columns from stretching each other vertically */}
                <main className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
                    
                    {/* --- Code Editor Panel --- */}
                    {/* A fixed height is applied to this panel */}
                    <div className="flex flex-col gap-4 bg-slate-800/50 p-5 rounded-xl border border-slate-700 shadow-lg h-[520px]">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-slate-200">Your Code Editor</h2>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-auto p-2.5"
                            >
                                <option value="python">Python</option>
                                <option value="javascript">JavaScript</option>
                                <option value="sql">SQL</option>
                            </select>
                        </div>
                        <div className="editor-container flex-grow rounded-lg border border-slate-700 overflow-hidden">
                             <Editor
                                language={language}
                                theme="vs-dark"
                                value={code}
                                onChange={(value) => setCode(value)}
                                options={{ minimap: { enabled: false } }}
                             />
                        </div>
                        <button 
                            onClick={handleReviewRequest} 
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 w-full bg-sky-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 ease-in-out hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                        >
                            {isLoading ? 'Analyzing...' : 'Get AI Review'}
                        </button>
                    </div>

                    {/* --- AI Review Panel --- */}
                    {/* This panel also has a fixed height, forcing its content to scroll */}
                    <div className="flex flex-col gap-4 bg-slate-800/50 p-5 rounded-xl border border-slate-700 shadow-lg h-[520px]">
                        <h2 className="text-xl font-semibold text-slate-200">AI-Powered Review</h2>
                        {/* This is the container that will have the scrollbar */}
                        <div className="flex-grow bg-slate-900 rounded-lg border border-slate-700 overflow-y-auto custom-scrollbar">
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                    <p className="font-semibold text-lg">Analyzing your code...</p>
                                </div>
                            )}
                            {error && (
                                <div className="flex flex-col items-center justify-center h-full text-red-400 p-4">
                                    <p className="font-bold text-lg">An Error Occurred</p>
                                    <p className="text-center">{error}</p>
                                </div>
                            )}
                            {!isLoading && !error && !review && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center">
                                    <h3 className="font-semibold text-lg text-slate-400">Ready for Review</h3>
                                    <p>Your code analysis will appear here.</p>
                                </div>
                            )}
                            {/* The 'prose' class from @tailwindcss/typography styles the raw HTML */}
                            {htmlReview && (
                                <div
                                    className="prose prose-invert max-w-none p-4 sm:p-6 prose-container"
                                    dangerouslySetInnerHTML={{ __html: htmlReview }}
                                />
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default App;
