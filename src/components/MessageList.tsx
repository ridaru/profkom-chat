import type { Message } from "../db/db";
import "../styles/messages.css";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type Props = {
    messages: Message[];
    currentUserId: string;
};

const MessageList = ({ messages, currentUserId }: Props) => {
    return (
        <div className="msg-list">
            {messages.length === 0 ? (
                <div className="msg-empty">Пока нет сообщений</div>
            ) : (
                messages.map((m) => {
                    const mine = m.authorId === currentUserId;
                    return (
                        <div key={m.id} className={`msg ${mine ? "msg--mine" : "msg--their"}`}>
                            <div className="msg__bubble">
                                <div className="msg__text">{m.text}</div>
                                <div className="msg__time">
                                    {format(new Date(m.createdAt), "HH:mm • dd.MM.yyyy", { locale: ru })}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default MessageList;