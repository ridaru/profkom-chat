import { useRef, useState } from "react";
import "../styles/messages.css";

type Props = {
    onSend: (text: string) => Promise<void> | void;
};

const MessageComposer = ({ onSend }: Props) => {
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const resizeTextarea = (textarea: HTMLTextAreaElement) => {
        const maxHeight = 140;

        textarea.style.height = "auto";
        const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    };

    const send = async () => {
        const value = text.trim();
        if (!value) return;

        try {
            setSending(true);
            await onSend(value);
            setText("");
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.overflowY = "hidden";
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="composer">
            <textarea
                ref={textareaRef}
                className="composer__input"
                placeholder="Введите сообщение..."
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    resizeTextarea(e.target);
                }}
                rows={2}
            />
            <button className="composer__btn" onClick={send} disabled={sending} aria-label="Отправить сообщение">
                <svg
                    className="composer__sendIcon"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>
        </div>
    );
};

export default MessageComposer;
