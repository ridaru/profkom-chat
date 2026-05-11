import { useRef, useState } from "react";
import "../styles/messages.css";
import type { UserRole } from "../db/db";

type Props = {
    onSend: (text: string) => Promise<void> | void;
    role: UserRole;
};

const operatorTemplates = [
    {
        label: "Принято в работу",
        text: "Здравствуйте! Ваше обращение принято в работу.",
    },
    {
        label: "Приложите документы",
        text: "Пожалуйста, приложите недостающие документы к обращению.",
    },
    {
        label: "Уточните детали",
        text: "Уточните, пожалуйста, детали по вашему обращению.",
    },
    {
        label: "Документы проверены",
        text: "Документы проверены, обращение передано на дальнейшее рассмотрение.",
    },
    {
        label: "Обращение обработано",
        text: "Ваше обращение обработано. При необходимости можете написать в этом чате.",
    },
];

const MessageComposer = ({ onSend, role }: Props) => {
    const [text, setText] = useState("");
    const [previewText, setPreviewText] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const showTemplates = role !== "student";
    const visibleText = previewText ?? text;

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
            setPreviewText(null);
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

    const applyTemplate = (template: string) => {
        setPreviewText(null);
        setText((current) => {
            const trimmed = current.trim();
            return trimmed ? `${trimmed}\n${template}` : template;
        });

        window.setTimeout(() => {
            if (!textareaRef.current) return;
            resizeTextarea(textareaRef.current);
            textareaRef.current.focus();
        }, 0);
    };

    const previewTemplate = (template: string) => {
        const trimmed = text.trim();
        setPreviewText(trimmed ? `${trimmed}\n${template}` : template);

        window.setTimeout(() => {
            if (!textareaRef.current) return;
            resizeTextarea(textareaRef.current);
        }, 0);
    };

    const clearPreview = () => {
        setPreviewText(null);

        window.setTimeout(() => {
            if (!textareaRef.current) return;
            resizeTextarea(textareaRef.current);
        }, 0);
    };

    return (
        <div className="composer-wrap">
            {showTemplates && (
                <div className="composer-templates" aria-label="Шаблоны ответов">
                    {operatorTemplates.map((template) => (
                        <button
                            key={template.label}
                            type="button"
                            className="composer-template"
                            onMouseEnter={() => previewTemplate(template.text)}
                            onMouseLeave={clearPreview}
                            onFocus={() => previewTemplate(template.text)}
                            onBlur={clearPreview}
                            onClick={() => applyTemplate(template.text)}
                        >
                            {template.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="composer">
                <textarea
                    ref={textareaRef}
                    className="composer__input"
                    placeholder="Введите сообщение..."
                    value={visibleText}
                    onChange={(e) => {
                        setPreviewText(null);
                        setText(e.target.value);
                        resizeTextarea(e.target);
                    }}
                    readOnly={previewText !== null}
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
        </div>
    );
};

export default MessageComposer;
