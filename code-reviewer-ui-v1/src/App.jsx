import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { v4 as uuidv4 } from 'uuid';

// --- Chatbox Component (with corrected styles) ---
const Chatbox = ({ isOpen, onClose, code, language, initialReview, conversation, onNewMessage }) => {
    const [messages, setMessages] = useState(conversation);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        setMessages(conversation);
    }, [conversation]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    if (!isOpen) return null;

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/follow-up', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language, review: initialReview, conversation: newMessages })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const assistantMessage = { role: 'assistant', content: data.response };
            const finalMessages = [...newMessages, assistantMessage];
            setMessages(finalMessages);
            onNewMessage(finalMessages);
        } catch (err) {
            console.error(err);
            const errorMessage = { role: 'assistant', content: `Error: ${err.message}` };
            setMessages([...newMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col z-50">
            <header className="flex justify-between items-center p-3 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white">Chat about Review</h3>
                <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-700">&times;</button>
            </header>
            <div className="flex-grow p-4 overflow-y-auto custom-scrollbar">
                {messages.map((msg, index) => (
                    <div key={index} className={`p-3 rounded-lg mb-3 max-w-xs text-sm ${msg.role === 'user' ? 'bg-sky-700 ml-auto' : 'bg-slate-600'}`}>
                        <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.content)) }} />
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            {isLoading && <div className="p-2 text-center text-xs text-slate-400">AI is thinking...</div>}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-700 flex gap-2">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a follow-up..." className="flex-grow bg-slate-700 border border-slate-600 rounded-lg p-2 focus:ring-sky-500 focus:border-sky-500 text-sm" />
                <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-semibold p-2 rounded-lg">Send</button>
            </form>
        </div>
    );
};


// --- Main App Component ---
function App() {
    const [code, setCode] = useState("def calculate_fibonacci(n):\n    \"\"\"A suboptimal function to calculate fibonacci numbers.\"\"\"\n    if n <= 0:\n        return 0\n    elif n == 1:\n        return 1\n    else:\n        return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)\n\n# Calling the function with a value that might be slow\nprint(calculate_fibonacci(10))");
    const [review, setReview] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [htmlReview, setHtmlReview] = useState('');
    const [language, setLanguage] = useState('python');
    const [copyStatus, setCopyStatus] = useState('Copy Review');
    const [history, setHistory] = useState([]);
    const [activeReviewId, setActiveReviewId] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [persona, setPersona] = useState('Standard');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', code: '' });
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [conversation, setConversation] = useState([]);

    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem('codeReviewHistory');
            if (savedHistory) setHistory(JSON.parse(savedHistory));
        } catch (e) { console.error("Failed to load history", e); }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('codeReviewHistory', JSON.stringify(history));
        } catch (e) { console.error("Failed to save history", e); }
    }, [history]);

    useEffect(() => {
        if (review) {
            try {
                marked.setOptions({ breaks: true, gfm: true });
                const sanitizedHtml = DOMPurify.sanitize(marked.parse(review));
                setHtmlReview(sanitizedHtml);
            } catch (e) {
                console.error('Markdown parsing error:', e);
                setError(`Failed to render review: ${e.message}.`);
                setHtmlReview('');
            }
        } else {
            setHtmlReview('');
        }
    }, [review]);

    const handleReviewRequest = async () => {
        setIsLoading(true);
        setError(null);
        setReview('');
        setConversation([]);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/review-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language, persona })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setReview(data.review);

            const newReviewId = uuidv4();
            const newHistoryItem = { id: newReviewId, code, language, review: data.review, timestamp: new Date().toISOString(), persona, conversation: [] };
            setHistory([newHistoryItem, ...history]);
            setActiveReviewId(newReviewId);

        } catch (e) {
            console.error(e);
            setError('Failed to get review. Please ensure the backend server is running and accessible.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAdvancedRequest = async (endpoint, body, modalTitle) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setModalContent({ title: modalTitle, code: data.result });
            setIsModalOpen(true);
        } catch (e) {
            console.error(e);
            setError(`Request failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFixCode = () => handleAdvancedRequest('fix-code', { code, language, review }, 'Fixed Code');
    const handleGenerateTests = () => handleAdvancedRequest('generate-tests', { code, language }, `Unit Tests for ${language}`);

    const handleUpdateConversation = (newConversation) => {
        setConversation(newConversation);
        const updatedHistory = history.map(item => 
            item.id === activeReviewId ? { ...item, conversation: newConversation } : item
        );
        setHistory(updatedHistory);
    };

    const handleSelectReview = (id) => {
        const selected = history.find(item => item.id === id);
        if (selected) {
            setCode(selected.code);
            setLanguage(selected.language);
            setReview(selected.review);
            setPersona(selected.persona || 'Standard');
            setConversation(selected.conversation || []);
            setActiveReviewId(selected.id);
            setIsChatOpen(false);
        }
    };

    const handleNewReview = () => {
        setCode('');
        setReview('');
        setError(null);
        setConversation([]);
        setActiveReviewId(null);
        setIsChatOpen(false);
    };

    const handleDeleteReview = (id) => {
        setHistory(history.filter(item => item.id !== id));
        if (activeReviewId === id) handleNewReview();
    };

    const handleCopyToClipboard = () => {
        if (copy(review)) {
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus('Copy Review'), 2000);
        }
    };

    const handleFormatCode = async () => { /* Your format code logic */ };

    return (
        <>
            {isModalOpen && <ResultModal title={modalContent.title} code={modalContent.code} language={language} onClose={() => setIsModalOpen(false)} onApply={() => { setCode(modalContent.code); setIsModalOpen(false); }} />}
            <Chatbox isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} code={code} language={language} initialReview={review} conversation={conversation} onNewMessage={handleUpdateConversation} />
            
            <div className="flex h-screen bg-slate-900 text-slate-300 font-sans">
                <aside className={`bg-slate-800/50 border-r border-slate-700 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0'} overflow-hidden`}>
                    <div className="p-4 border-b border-slate-700 flex-shrink-0"><h2 className="text-lg font-semibold text-white">Review History</h2></div>
                    <button onClick={handleNewReview} className="m-4 text-center bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 px-4 rounded-lg flex-shrink-0">+ New Review</button>
                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                        {history.map(item => (
                            <div key={item.id} onClick={() => handleSelectReview(item.id)} className={`p-3 m-2 rounded-lg cursor-pointer group ${activeReviewId === item.id ? 'bg-sky-800/50' : 'hover:bg-slate-700/50'}`}>
                                <p className="font-semibold text-sm truncate">{item.code.split('\n')[0] || 'Untitled'}</p>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</p>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteReview(item.id); }} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                <div className="flex-1 flex flex-col min-h-0">
                    <header className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900 flex-shrink-0">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/></svg></button>
                        <h1 className="text-xl font-bold text-slate-100 tracking-tight">AI Code Review Assistant</h1>
                        <div className="w-8"></div>
                    </header>

                    <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col gap-4 min-h-0">
                            <div className="flex justify-between items-center flex-shrink-0">
                                <h2 className="text-xl font-semibold text-slate-200">Your Code Editor</h2>
                                <div className="flex items-center gap-2">
                                    <select value={persona} onChange={(e) => setPersona(e.target.value)} className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-auto p-2.5"><option>Standard</option><option>Beginner</option><option>Security</option><option>Performance</option></select>
                                    <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-auto p-2.5"><option value="python">Python</option><option value="javascript">JavaScript</option><option value="sql">SQL</option></select>
                                </div>
                            </div>
                            <div className="editor-container flex-grow rounded-lg border border-slate-700 overflow-hidden"><Editor language={language} theme="vs-dark" value={code} onChange={(value) => setCode(value)} options={{ minimap: { enabled: false } }}/></div>
                            <div className="flex gap-4 flex-shrink-0">
                                <button onClick={handleFormatCode} disabled={isLoading} className="flex items-center justify-center gap-2 w-full bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed">{isLoading ? 'Processing...' : 'Format Code'}</button>
                                <button onClick={handleReviewRequest} disabled={isLoading} className="flex items-center justify-center gap-2 w-full bg-sky-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed">{isLoading ? 'Processing...' : 'Get AI Review'}</button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 min-h-0">
                            <div className="flex justify-between items-center flex-shrink-0">
                                <h2 className="text-xl font-semibold text-slate-200">AI-Powered Review</h2>
                                <div className="flex items-center gap-2">
                                    {review && <button onClick={() => setIsChatOpen(true)} className="bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-500">Chat about this review</button>}
                                    {review && <button onClick={handleCopyToClipboard} className="bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-500">{copyStatus}</button>}
                                </div>
                            </div>
                            <div className="flex-grow bg-slate-900 rounded-lg border border-slate-700 overflow-y-auto custom-scrollbar">
                                {isLoading && !review && <div className="p-4 flex items-center justify-center h-full">Processing your code...</div>}
                                {error && <div className="p-4 text-red-400 flex items-center justify-center h-full">{error}</div>}
                                {!isLoading && !error && !review && (<div className="flex flex-col items-center justify-center h-full text-slate-500 text-center"><h3 className="font-semibold text-lg text-slate-400">Ready for Review</h3><p>Your code analysis will appear here.</p></div>)}
                                {htmlReview && <div className="prose prose-invert max-w-none p-4 sm:p-6" dangerouslySetInnerHTML={{ __html: htmlReview }} />}
                            </div>
                             {review && (
                                <div className="flex-shrink-0 flex gap-4">
                                    <button onClick={handleFixCode} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg">Fix My Code</button>
                                    <button onClick={handleGenerateTests} disabled={isLoading} className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg">Generate Tests</button>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}

// --- ResultModal Component ---
const ResultModal = ({ title, code, language, onClose, onApply }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg w-full max-w-3xl h-3/4 flex flex-col">
            <header className="flex justify-between items-center p-4 border-b border-slate-700">
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-700 text-2xl leading-none">&times;</button>
            </header>
            <div className="flex-grow p-4 min-h-0">
                <Editor language={language} theme="vs-dark" value={code} options={{ readOnly: true, minimap: { enabled: false } }} />
            </div>
            <footer className="p-4 border-t border-slate-700 flex justify-end gap-4">
                <button onClick={onClose} className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg">Close</button>
                <button onClick={onApply} className="bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 px-4 rounded-lg">Apply to Editor</button>
            </footer>
        </div>
    </div>
);


export default App;
