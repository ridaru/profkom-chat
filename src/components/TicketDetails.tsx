import { useEffect, useMemo, useState } from "react";
import { db, type Message, type Ticket, type UserRole } from "../db/db";
import MessageList from "./MessageList";
import MessageComposer from "./MessageComposer";
import "../styles/ticket-details.css";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type Props = {
    ticketId: string;
    currentUserId: string;
    role: UserRole;
    onChanged?: () => void;
};

type DocumentAttachment = {
    id: string;
    name: string;
    size: number;
    type: string;
    lastModified: number;
    dataUrl: string;
};

const statusRu: Record<Ticket["status"], string> = {
    new: "Новое",
    in_progress: "В работе",
    need_info: "Нужна инфо",
    closed: "Закрыто",
};

type MaterialSupport = {
    to: string;
    group: string;
    studentCard: string;
    category: string;
    statementText: string;
    confirmUnionAndCitizen?: boolean;
    hints?: {
        when?: string[];
        docsCommon?: string[];
        docsForCategory?: string;
    };
    attachments?: DocumentAttachment[];
};

type SocialSupport = {
    to: string;
    level: "Студент" | "Аспирант";
    group: string;
    studentCard: string;
    category: string;
    statementText: string;
    hints?: {
        when?: string[];
        docsCommon?: string[];
        docsForCategory?: string;
    };
    attachments?: DocumentAttachment[];
};

type Signature = {
    kind: string;
    signer: string;
    signedAt: string;
    digestSha256B64: string;
    statementPreview: string;
};

type TicketFormData = {
    title?: string;
    description?: string;
    materialSupport?: MaterialSupport;
    socialSupport?: SocialSupport;
    signature?: Signature;
};

async function markRead(ticketId: string, role: UserRole) {
    const toUpdate = await db.messages
        .where("ticketId")
        .equals(ticketId)
        .filter((m) => (role === "student" ? !m.isReadByStudent : !m.isReadByOperator))
        .toArray();

    if (toUpdate.length === 0) return;

    await db.messages.bulkPut(
        toUpdate.map((m) => ({
            ...m,
            isReadByStudent: role === "student" ? true : m.isReadByStudent,
            isReadByOperator: role !== "student" ? true : m.isReadByOperator,
        }))
    );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
    if (!value) return null;
    return (
        <div className="td-info__row">
            <div className="td-info__label">{label}</div>
            <div className="td-info__value">{value}</div>
        </div>
    );
}

function InfoList({ title, items }: { title: string; items?: string[] }) {
    if (!items || items.length === 0) return null;
    return (
        <div className="td-info__block">
            <div className="td-info__blockTitle">{title}</div>
            <ul className="td-info__ul">
                {items.map((x) => (
                    <li key={x}>{x}</li>
                ))}
            </ul>
        </div>
    );
}

function formatFileSize(size: number) {
    if (size < 1024) return `${size} Б`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
    return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function AttachmentList({ items }: { items?: DocumentAttachment[] }) {
    if (!items || items.length === 0) return null;

    return (
        <div className="td-info__block">
            <div className="td-info__blockTitle">Файлы документов</div>
            <ul className="td-files">
                {items.map((file) => (
                    <li className="td-files__item" key={file.id}>
                        <div className="td-files__meta">
                            <span className="td-files__name">{file.name}</span>
                            <span className="td-files__size">{formatFileSize(file.size)}</span>
                        </div>
                        <a className="td-files__link" href={file.dataUrl} download={file.name}>
                            Скачать
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function escapeDocHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function statementToDocHtml(statementText: string) {
    const lines = statementText.split(/\r?\n/);
    const titleIndex = lines.findIndex((line) => line.trim().toUpperCase() === "ЗАЯВЛЕНИЕ");

    return lines
        .map((line, lineIndex) => {
            const trimmed = line.trim();

            if (!trimmed) {
                return '<p class="MsoNormal" style="margin:0; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%; mso-line-height-rule:exactly;">&nbsp;</p>';
            }

            const isSignLine = /^(Дата|Подпись):/i.test(trimmed);
            const isTitle = trimmed === trimmed.toUpperCase() && trimmed.length > 3;
            const isRecipientBlock = titleIndex > -1 && lineIndex < titleIndex;
            const align = isSignLine || isRecipientBlock ? "right" : isTitle ? "center" : "left";
            const fontWeight = isTitle ? "bold" : "normal";
            const titleMargin = isTitle ? "margin-top:6.0pt; margin-bottom:6.0pt;" : "margin-top:0; margin-bottom:0;";

            return `<p class="MsoNormal" align="${align}" style="${titleMargin} text-align:${align}; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%; mso-line-height-rule:exactly; font-weight:${fontWeight};">${escapeDocHtml(trimmed)}</p>`;
        })
        .join("");
}

function downloadStatementDoc(statementText: string, title?: string) {
    const normalizedTitle = (title ?? "statement")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, "_");
    const fileName = `${normalizedTitle || "statement"}.doc`;
    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="utf-8">
    <title>${escapeDocHtml(title ?? "Заявление")}</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {
            size: A4;
            margin: 20mm 10mm 20mm 30mm;
            mso-header-margin: 0mm;
            mso-footer-margin: 0mm;
        }
        body {
            margin: 0;
            font-family: "Times New Roman", serif;
            font-size: 12pt;
            line-height: 150%;
            color: #000;
        }
        p.MsoNormal {
            mso-style-parent: "";
            margin: 0;
            font-size: 12.0pt;
            font-family: "Times New Roman", serif;
            line-height: 150%;
            mso-line-height-rule: exactly;
        }
    </style>
</head>
<body>
    <div class="Section1" style="page: Section1;">
        ${statementToDocHtml(statementText)}
    </div>
</body>
</html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

const TicketDetails = ({ ticketId, currentUserId, role, onChanged }: Props) => {
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);

    const reload = async () => {
        const t = await db.tickets.get(ticketId);
        setTicket(t ?? null);

        const msgs = await db.messages.where("ticketId").equals(ticketId).toArray();
        msgs.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
        setMessages(msgs);

        await markRead(ticketId, role);
        onChanged?.();
    };

    useEffect(() => {
        void reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketId]);

    const handleSend = async (text: string) => {
        const now = new Date().toISOString();

        await db.messages.add({
            id: crypto.randomUUID(),
            ticketId,
            authorId: currentUserId,
            text,
            createdAt: now,
            isReadByStudent: role === "student",
            isReadByOperator: role !== "student",
        });

        const t = await db.tickets.get(ticketId);
        if (t) await db.tickets.put({ ...t, updatedAt: now });

        await reload();
    };

    const form = useMemo(() => (ticket?.formData ?? {}) as TicketFormData, [ticket]);

    if (!ticket) {
        return (
            <div className="td td--empty">
                <div className="td-empty">
                    <div className="td-empty__title">Обращение не найдено</div>
                    <div className="td-empty__text">Возможно, база была очищена.</div>
                </div>
            </div>
        );
    }

    const title = `${ticket.topic} • ${ticket.type}`;
    const created = format(new Date(ticket.createdAt), "dd.MM.yyyy HH:mm", { locale: ru });
    const updated = format(new Date(ticket.updatedAt), "dd.MM.yyyy HH:mm", { locale: ru });

    const ms = form.materialSupport;
    const ss = form.socialSupport;
    const sign = form.signature;

    return (
        <div className="td">
            <header className="td-head">
                <div className="td-head__main">
                    <div className="td-head__title">{title}</div>
                    <div className="td-head__meta">
                        <span className={`td-badge td-badge--${ticket.status}`}>{statusRu[ticket.status]}</span>
                        <span>Создано: {created}</span>
                        <span>Обновлено: {updated}</span>
                    </div>
                </div>
            </header>

            <div className="td-body">
                {/* Левая колонка — данные обращения */}
                <section className="td-card td-info">
                    <div className="td-card__title td-info__titleRow">
                        <span>Данные обращения</span>
                        {sign?.statementPreview && (
                            <button type="button" className="td-info__download" onClick={() => downloadStatementDoc(sign.statementPreview, form.title)}>
                                Скачать Word
                            </button>
                        )}
                    </div>

                    {form.title && <InfoRow label="Заголовок" value={form.title} />}
                    {form.description && <InfoRow label="Описание" value={form.description} />}

                    {ms && (
                        <>
                            <div className="td-info__sep" />
                            <InfoRow label="Кому" value={ms.to} />
                            <InfoRow label="Категория" value={ms.category} />
                            <InfoRow label="Группа" value={ms.group} />
                            <InfoRow label="№ студенческого" value={ms.studentCard} />

                            <div className="td-info__block">
                                <div className="td-info__blockTitle">Текст заявления</div>
                                <div className="td-info__text">{ms.statementText}</div>
                            </div>

                            <InfoList title="Когда выплачивается / условия" items={ms.hints?.when} />
                            <InfoList title="Общие правила документов" items={ms.hints?.docsCommon} />

                            {ms.hints?.docsForCategory && (
                                <div className="td-info__block">
                                    <div className="td-info__blockTitle">Документы по категории</div>
                                    <div className="td-info__text">{ms.hints.docsForCategory}</div>
                                </div>
                            )}

                            <AttachmentList items={ms.attachments} />
                        </>
                    )}

                    {ss && (
                        <>
                            <div className="td-info__sep" />
                            <InfoRow label="Кому" value={ss.to} />
                            <InfoRow label="Уровень" value={ss.level} />
                            <InfoRow label="Категория" value={ss.category} />
                            <InfoRow label="Группа" value={ss.group} />
                            <InfoRow label="№ студенческого" value={ss.studentCard} />

                            <div className="td-info__block">
                                <div className="td-info__blockTitle">Текст заявления</div>
                                <div className="td-info__text">{ss.statementText}</div>
                            </div>

                            <InfoList title="Когда выплачивается / условия" items={ss.hints?.when} />
                            <InfoList title="Общие правила документов" items={ss.hints?.docsCommon} />

                            {ss.hints?.docsForCategory && (
                                <div className="td-info__block">
                                    <div className="td-info__blockTitle">Документы по категории</div>
                                    <div className="td-info__text">{ss.hints.docsForCategory}</div>
                                </div>
                            )}

                            <AttachmentList items={ss.attachments} />
                        </>
                    )}

                    {sign && (
                        <>
                            <div className="td-info__sep" />
                            <div className="td-info__block">
                                <div className="td-info__blockTitle">Подпись (демо)</div>
                                <InfoRow label="Подписант" value={sign.signer} />
                                <InfoRow label="Дата подписи" value={format(new Date(sign.signedAt), "dd.MM.yyyy HH:mm", { locale: ru })} />
                                <InfoRow label="Digest (SHA-256)" value={sign.digestSha256B64} />
                                <details className="td-info__details">
                                    <summary>Показать сформированное заявление</summary>
                                    <pre className="td-info__pre">{sign.statementPreview}</pre>
                                </details>
                            </div>
                        </>
                    )}
                </section>

                {/* Правая колонка — чат */}
                <section className="td-chat">
                    <div className="td-card__title td-chat__title">Переписка</div>
                    <MessageList messages={messages} currentUserId={currentUserId} />
                    <MessageComposer onSend={handleSend} />
                </section>
            </div>
        </div>
    );
};

export default TicketDetails;
