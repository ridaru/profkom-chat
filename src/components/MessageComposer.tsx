import { useState } from "react";
import "../styles/messages.css";

type Props = {
    onSend: (text: string) => Promise<void> | void;
};

const MessageComposer = ({ onSend }: Props) => {
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);

    const send = async () => {
        const value = text.trim();
        if (!value) return;

        try {
            setSending(true);
            await onSend(value);
            setText("");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="composer">
      <textarea
          className="composer__input"
          placeholder="Введите сообщение…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
      />
            <button className="composer__btn" onClick={send} disabled={sending}>
                {sending ? "..." : "Отправить"}
            </button>
        </div>
    );
};

export default MessageComposer;