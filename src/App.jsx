import { useEffect, useRef, useState } from "react";
import {
    ConversationProvider,
    useConversationControls,
    useConversationMode,
    useConversationStatus,
} from "@elevenlabs/react";
import { motion } from "framer-motion";

const AGENT_ID = "agent_2101m452e8x6fg6a8wpn09kv0xcj";

function Icon({ name, size = 20 }) {
    const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true,
    };

    const paths = {
        audio: (
            <>
                <path d="M12 3v18" />
                <path d="M8 7v10M4 10v4m12-7v10m4-7v4" />
            </>
        ),
        message: (
            <>
                <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
            </>
        ),
        mic: (
            <>
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
            </>
        ),
        stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
        send: (
            <>
                <path d="m22 2-7 20-4-9-9-4 20-7Z" />
                <path d="M22 2 11 13" />
            </>
        ),
        sparkle: (
            <>
                <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
                <path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" />
            </>
        ),
        check: <path d="m5 12 4 4L19 6" />,
    };

    return <svg {...common}>{paths[name]}</svg>;
}

function VoiceAgent({ error, setError }) {
    const { startSession, endSession, sendUserMessage } =
        useConversationControls();

    const { status } = useConversationStatus();
    const { isSpeaking } = useConversationMode();

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [chatError, setChatError] = useState("");

    const chatEndRef = useRef(null);

    const connected = status === "connected";
    const connecting = status === "connecting";

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    const addChatMessage = (role, text) => {
        const content = text.trim();

        if (!content) return;

        setChatMessages((messages) => {
            const lastMessage = messages[messages.length - 1];

            if (
                lastMessage?.role === role &&
                lastMessage.text === content
            ) {
                return messages;
            }

            return [
                ...messages,
                {
                    id: `${Date.now()}-${messages.length}`,
                    role,
                    text: content,
                },
            ];
        });
    };

    const handleConversationMessage = (event) => {
        if (event.type === "user_transcript") {
            addChatMessage(
                "user",
                event.user_transcription_event.user_transcript
            );
        } else if (event.type === "agent_response") {
            addChatMessage(
                "assistant",
                event.agent_response_event.agent_response
            );
        } else if (event.type === "agent_response_correction") {
            const correction = event.agent_response_correction_event;

            if (correction.corrected_agent_response) {
                setChatMessages((messages) => {
                    const corrected = [...messages];

                    const responseIndex = corrected.findIndex(
                        (message) =>
                            message.role === "assistant" &&
                            message.text ===
                            correction.original_agent_response
                    );

                    if (responseIndex === -1) return corrected;

                    corrected[responseIndex] = {
                        ...corrected[responseIndex],
                        text: correction.corrected_agent_response,
                    };

                    return corrected;
                });
            }
        }
    };

    const startConversation = async () => {
        setError("");

        try {
            await startSession({
                agentId: AGENT_ID,
                onMessage: handleConversationMessage,
            });
        } catch (sessionError) {
            console.error(
                "Could not start voice session:",
                sessionError
            );

            setError(
                "Could not start the conversation. Check your microphone permission and connection, then try again."
            );
        }
    };

    const sendChatMessage = (event) => {
        event.preventDefault();

        const message = chatInput.trim();

        if (!message || !connected) return;

        setChatError("");

        try {
            sendUserMessage(message);
            addChatMessage("user", message);
            setChatInput("");
        } catch (sendError) {
            console.error("Could not send chat message:", sendError);

            setChatError(
                "Your message could not be sent. Please try again."
            );
        }
    };

    const sessionStatus = connected
        ? isSpeaking
            ? "Your assistant is speaking"
            : "Listening to you"
        : connecting
            ? "Connecting to your assistant"
            : "Ready when you are";

    return (
        <>
            <header className="flex h-16 items-center justify-between border-b border-white/10 bg-gray-900 px-5 sm:h-20 sm:px-[7%]">
                <a
                    className="inline-flex items-center gap-2.5 text-xl font-bold tracking-tight text-gray-100 no-underline"
                    href="#"
                    aria-label="Aural home"
                >
                    <span className="grid size-9 place-items-center rounded-xl border border-gray-300/20 bg-gray-900 text-gray-200">
                        <Icon name="audio" size={22} />
                    </span>

                    <span>
                        ITI Admission Assistant
                        <span className="text-gray-300">.</span>
                    </span>
                </a>
            </header>

            <div className="mt-5 text-center">
                <div className="inline-flex items-center gap-2 text-[10px] font-bold tracking-widest text-gray-300/70">
                    <Icon name="sparkle" size={15} />
                    YOUR PERSONAL VOICE ASSISTANT
                </div>
            </div>

            <main className="mx-auto mt-0 grid grid-cols-1 gap-10 p-10 sm:grid-cols-2">
                <section className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
                    <div className="flex min-h-96 flex-col items-center px-6 pt-7 pb-7 text-center sm:min-h-96 sm:pt-9">
                        <div className="mb-4 grid h-32 place-items-center">
                            <div className="relative grid size-32 place-items-center rounded-full bg-gray-400/10">
                                <motion.div
                                    className={`relative z-10 grid size-20 place-items-center rounded-full border border-gray-300/30 text-gray-100 shadow-xl ${connected
                                            ? "bg-gray-500 text-white shadow-gray-400/40"
                                            : "bg-gray-950"
                                        }`}
                                    animate={
                                        connected
                                            ? {
                                                scale: isSpeaking
                                                    ? [1, 1.08, 1]
                                                    : [1, 1.035, 1],
                                            }
                                            : { scale: 1 }
                                    }
                                    transition={{
                                        repeat: connected ? Infinity : 0,
                                        duration: isSpeaking ? 0.85 : 1.8,
                                        ease: "easeInOut",
                                    }}
                                >
                                    <Icon name="audio" size={37} />
                                </motion.div>

                                {connected &&
                                    [0, 1].map((ring) => (
                                        <motion.span
                                            key={ring}
                                            className="absolute inset-2 rounded-full border border-gray-300/30"
                                            animate={{
                                                scale: [0.7, 1.35],
                                                opacity: [0, 0.7, 0],
                                            }}
                                            transition={{
                                                duration: 2.7,
                                                ease: "easeOut",
                                                repeat: Infinity,
                                                delay: ring * 1.35,
                                            }}
                                        />
                                    ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-center text-[10px] font-bold tracking-widest text-gray-300/70">
                            <span
                                className={`mr-2 inline-block size-1.5 rounded-full ${connected
                                        ? "bg-green-300 shadow-lg shadow-green-300/70"
                                        : "bg-gray-500"
                                    }`}
                            />

                            {connected
                                ? "VOICE SESSION ACTIVE"
                                : "AI VOICE ASSISTANT"}
                        </div>

                        <h2 className="mt-2 text-[22px] font-medium tracking-tight text-gray-100">
                            {connected
                                ? isSpeaking
                                    ? "Aural is talking"
                                    : "I’m listening"
                                : "Let’s talk about it."}
                        </h2>

                        <p className="mt-2 mb-6 min-h-5 text-xs text-gray-400">
                            {connected
                                ? sessionStatus
                                : "Speak naturally. Your assistant listens and responds in real time."}
                        </p>

                        <button
                            className={`inline-flex h-12 min-w-56 items-center justify-center gap-2.5 rounded-xl border px-5 text-xs font-bold transition hover:-translate-y-px hover:shadow-lg disabled:cursor-wait disabled:opacity-75 ${connected
                                    ? "border-red-900 bg-red-950 text-red-100"
                                    : "border-gray-300 bg-gray-300 text-gray-950 shadow-lg shadow-gray-400/20"
                                }`}
                            onClick={
                                connected
                                    ? endSession
                                    : startConversation
                            }
                            disabled={connecting}
                        >
                            {connecting ? (
                                <motion.span
                                    className="size-4 rounded-full border-2 border-gray-950/30 border-t-gray-950"
                                    animate={{ rotate: 360 }}
                                    transition={{
                                        duration: 0.8,
                                        ease: "linear",
                                        repeat: Infinity,
                                    }}
                                />
                            ) : (
                                <Icon
                                    name={connected ? "stop" : "mic"}
                                    size={18}
                                />
                            )}

                            {connecting
                                ? "Connecting..."
                                : connected
                                    ? "End conversation"
                                    : "Start a conversation"}
                        </button>

                        <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-500">
                            <span className="grid size-4 place-items-center rounded-full bg-green-400/10 text-green-300">
                                <Icon name="check" size={12} />
                            </span>

                            Your microphone is only active during a conversation
                        </div>
                    </div>

                    {error && (
                        <p
                            className="m-0 border-t border-red-900 bg-red-950/30 px-5 py-3 text-center text-[11px] text-red-300"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}
                </section>

                <section
                    className="flex flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-xl"
                    aria-labelledby="chat-heading"
                >
                    <div className="flex items-center justify-between gap-3 border-b border-gray-700 px-4 py-3.5 sm:px-5 sm:py-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gray-900 bg-gray-950 text-gray-200">
                                <Icon name="message" size={17} />
                            </span>

                            <div>
                                <h2
                                    id="chat-heading"
                                    className="m-0 text-xs font-semibold text-gray-100"
                                >
                                    Chat with your assistant
                                </h2>

                                <p className="mt-1 mb-0 text-[10px] text-gray-500">
                                    {connected
                                        ? "Send a message or keep talking out loud."
                                        : "Start a voice conversation to begin chatting."}
                                </p>
                            </div>
                        </div>

                        <span
                            className={`inline-flex items-center whitespace-nowrap text-[10px] ${connected
                                    ? "text-green-300"
                                    : "text-gray-500"
                                }`}
                        >
                            <span
                                className={`mr-1.5 inline-block size-1.5 rounded-full ${connected
                                        ? "bg-green-300 shadow-md shadow-green-300/60"
                                        : "bg-gray-500"
                                    }`}
                            />

                            {connected
                                ? "Connected"
                                : connecting
                                    ? "Connecting"
                                    : "Offline"}
                        </span>
                    </div>

                    <div
                        className="flex grow flex-col gap-3 overflow-y-auto p-5 sm:h-56 sm:p-4"
                        aria-live="polite"
                        aria-relevant="additions"
                    >
                        <div
                            className="flex h-52 grow"
                            aria-live="polite"
                            aria-relevant="additions"
                        >
                            {chatMessages.length === 0 ? (
                                <div className="flex flex-1 items-center justify-center gap-2 text-[11px] text-gray-500">
                                    <span className="text-gray-300">
                                        <Icon
                                            name="sparkle"
                                            size={17}
                                        />
                                    </span>

                                    <span>
                                        Your conversation will appear here.
                                    </span>
                                </div>
                            ) : (
                                chatMessages.map((message) => (
                                    <div
                                        className={`max-w-[92%] rounded-xl border px-3 py-2 sm:max-w-[82%] ${message.role === "user"
                                                ? "self-end rounded-br-sm border-gray-900 bg-gray-950"
                                                : "self-start rounded-bl-sm border-gray-700 bg-gray-800"
                                            }`}
                                        key={message.id}
                                    >
                                        <span className="text-[9px] font-bold text-gray-300">
                                            {message.role === "assistant"
                                                ? "Aural"
                                                : "You"}
                                        </span>

                                        <p className="mt-1 mb-0 whitespace-pre-wrap text-xs leading-relaxed text-gray-200 wrap-anywhere">
                                            {message.text}
                                        </p>
                                    </div>
                                ))
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        <form
                            className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-950 py-1.5 pr-2 pl-3 transition focus-within:border-gray-700 focus-within:shadow-md"
                            onSubmit={sendChatMessage}
                        >
                            <input
                                className="h-9 min-w-0 flex-1 border-0 bg-transparent text-xs text-gray-100 outline-none placeholder:text-gray-600 disabled:cursor-not-allowed"
                                aria-label="Message your assistant"
                                value={chatInput}
                                onChange={(event) =>
                                    setChatInput(event.target.value)
                                }
                                placeholder={
                                    connected
                                        ? "Write a message…"
                                        : "Start a conversation to chat…"
                                }
                                maxLength={1000}
                                disabled={!connected}
                            />

                            <button
                                className="grid size-9 shrink-0 place-items-center rounded-lg border border-gray-300 bg-gray-300 text-gray-950 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
                                type="submit"
                                aria-label="Send message"
                                disabled={
                                    !connected || !chatInput.trim()
                                }
                            >
                                <Icon name="send" size={17} />
                            </button>
                        </form>
                    </div>

                    {chatError && (
                        <p
                            className="-mt-1 mx-5 mb-3 text-[10px] text-red-300"
                            role="alert"
                        >
                            {chatError}
                        </p>
                    )}
                </section>
            </main>

            <footer className="mx-auto grid grid-cols-1 gap-3 pt-6 sm:w-full sm:grid-cols-3 sm:gap-5">
                <div className="mx-auto flex min-w-0 items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gray-700 bg-gray-900 text-gray-300">
                        <Icon name="mic" size={17} />
                    </span>

                    <span>
                        <strong className="block whitespace-nowrap text-[11px] font-semibold text-gray-300 sm:text-[10px]">
                            Natural conversations
                        </strong>

                        <small className="mt-1 block whitespace-nowrap text-[10px] text-gray-500 sm:text-[9px]">
                            Talk, listen, and think out loud
                        </small>
                    </span>
                </div>

                <div className="mx-auto flex min-w-0 items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gray-700 bg-gray-900 text-gray-300">
                        <Icon name="audio" size={17} />
                    </span>

                    <span>
                        <strong className="block whitespace-nowrap text-[11px] font-semibold text-gray-300 sm:text-[10px]">
                            Real-time responses
                        </strong>

                        <small className="mt-1 block whitespace-nowrap text-[10px] text-gray-500 sm:text-[9px]">
                            Hear your assistant reply live
                        </small>
                    </span>
                </div>

                <div className="mx-auto flex min-w-0 items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gray-700 bg-gray-900 text-gray-300">
                        <Icon name="sparkle" size={17} />
                    </span>

                    <span>
                        <strong className="block whitespace-nowrap text-[11px] font-semibold text-gray-300 sm:text-[10px]">
                            Made for ideas
                        </strong>

                        <small className="mt-1 block whitespace-nowrap text-[10px] text-gray-500 sm:text-[9px]">
                            A little more human, every time
                        </small>
                    </span>
                </div>
            </footer>
        </>
    );
}

export default function App() {
    const [error, setError] = useState("");

    return (
        <ConversationProvider
            onError={(sessionError) => {
                console.error(
                    "ElevenLabs error:",
                    sessionError
                );

                setError(
                    "The voice session encountered an error. Please try reconnecting."
                );
            }}
        >
            <VoiceAgent
                error={error}
                setError={setError}
            />
        </ConversationProvider>
    );
}