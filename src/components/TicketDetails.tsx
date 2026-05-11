import { useEffect, useMemo, useState } from "react";
import { db, type Message, type Ticket, type UserRole } from "../db/db";
import MessageList from "./MessageList";
import MessageComposer from "./MessageComposer";
import CreateTicketModal from "./CreateTicketModal";
import { verifySignature, type DemoSignature } from "../lib/signature";
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
    digestSha256B64?: string;
    algorithm?: DemoSignature["algorithm"];
    certificateSerial?: string;
    publicKeyJwk?: JsonWebKey;
    signatureB64?: string;
    signedPayload?: string;
    statementPreview: string;
};

type TicketFormData = {
    title?: string;
    description?: string;
    materialSupport?: MaterialSupport;
    socialSupport?: SocialSupport;
    signature?: Signature;
};

type SignatureStatus = "valid" | "invalid" | "legacy" | "none";

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
        .filter((line, lineIndex) => {
            const trimmed = line.trim();
            const prev = lines[lineIndex - 1]?.trim();

            // убираем пустую строку сразу после "Падалкину Б. В."
            if (!trimmed && prev === "Падалкину Б. В.") return false;

            // дату и подпись ниже оформим отдельно
            if (/^Дата:/i.test(trimmed)) return false;
            if (/^Подпись:/i.test(trimmed)) return false;

            return true;
        })
        .map((line, lineIndex) => {
            const trimmed = line.trim();

            if (!trimmed) {
                return '<p class="MsoNormal" style="margin:0; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%; mso-line-height-rule:exactly;">&nbsp;</p>';
            }

            const isStatementTitle = trimmed.toUpperCase() === "ЗАЯВЛЕНИЕ";
            const isRecipientBlock = titleIndex > -1 && lineIndex < titleIndex;

            const align = isStatementTitle ? "center" : isRecipientBlock ? "right" : "left";
            const fontWeight = isStatementTitle ? "bold" : "normal";
            const titleMargin = isStatementTitle
                ? "margin-top:12.0pt; margin-bottom:12.0pt;"
                : "margin-top:0; margin-bottom:0;";

            return `<p class="MsoNormal" align="${align}" style="${titleMargin} text-align:${align}; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%; mso-line-height-rule:exactly; font-weight:${fontWeight};">${escapeDocHtml(trimmed)}</p>`;
        })
        .join("");
}

function statementFooterToDocHtml(statementText: string, signature?: Signature, status?: SignatureStatus) {
    const lines = statementText.split(/\r?\n/);

    const dateLine = lines.find((line) => /^Дата:/i.test(line.trim()))?.trim() ?? "";
    const signLine = lines.find((line) => /^Подпись:/i.test(line.trim()))?.trim() ?? "";

    const date = dateLine.replace(/^Дата:\s*/i, "");
    const signerFromStatement = signLine.replace(/^Подпись:\s*/i, "");

    const signer = signerFromStatement || signature?.signer || "";

    if (!signature) {
        return `
            <table style="width:100%; margin-top:18.0pt; border-collapse:collapse; table-layout:fixed;">
                <tr>
                    <td style="width:50%; padding:0; border:none; vertical-align:top;">
                        <p class="MsoNormal" style="margin:0; text-align:left; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%;">
                            Дата: ${escapeDocHtml(date)}
                        </p>
                    </td>
                    <td style="width:50%; padding:0; border:none; vertical-align:top;">
                        <p class="MsoNormal" style="margin:0; text-align:right; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%;">
                            Подпись: ${escapeDocHtml(signer)}
                        </p>
                    </td>
                </tr>
            </table>
        `;
    }

    const statusText =
        status === "valid"
            ? "Подпись действительна"
            : status === "invalid"
                ? "Подпись не прошла проверку"
                : status === "legacy"
                    ? "Старая подпись: требуется переподписание"
                    : "Статус подписи не определен";

    const signedAt = signature.signedAt
        ? new Date(signature.signedAt).toLocaleString("ru-RU")
        : "Нет данных";

    return `
        <table style="width:100%; margin-top:18.0pt; border-collapse:collapse; table-layout:fixed;">
            <tr>
                <td style="width:50%; padding:0; border:none; vertical-align:top;">
                    <p class="MsoNormal" style="margin:0; text-align:left; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%;">
                        Дата: ${escapeDocHtml(date)}
                    </p>
                </td>
                <td style="width:50%; padding:0; border:none; vertical-align:top;">
                    <p class="MsoNormal" style="margin:0; text-align:right; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%;">
                        Подпись: ${escapeDocHtml(signer)}
                    </p>

                    <p class="MsoNormal" style="margin:18.0pt 0 6.0pt 0; text-align:right; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%; font-weight:bold;">
                        Демо-подпись заявления
                    </p>
                    <p class="MsoNormal" style="margin:0; text-align:right; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%;">
                        Статус проверки: ${escapeDocHtml(statusText)}
                    </p>
                    <p class="MsoNormal" style="margin:0; text-align:right; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%;">
                        Подписант: ${escapeDocHtml(signature.signer)}
                    </p>
                    <p class="MsoNormal" style="margin:0; text-align:right; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%;">
                        Дата подписи: ${escapeDocHtml(signedAt)}
                    </p>
                    <p class="MsoNormal" style="margin:0; text-align:right; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%;">
                        Ключ подписи: ${escapeDocHtml(signature.certificateSerial ?? "Нет данных")}
                    </p>
                    <p class="MsoNormal" style="margin:0; text-align:right; font-family:&quot;Times New Roman&quot;, serif; font-size:12.0pt; line-height:150%;">
                        Алгоритм: ${escapeDocHtml(signature.algorithm ?? "Учебная модель Web Crypto API")}
                    </p>
                    <p class="MsoNormal" style="margin-top:10.0pt; text-align:right; font-family:&quot;Times New Roman&quot;, serif; font-size:10.0pt; line-height:130%; color:#666;">
                        Подпись является демонстрационной моделью для дипломного проекта и не является юридически значимой квалифицированной электронной подписью.
                    </p>
                </td>
            </tr>
        </table>
    `;
}

function downloadStatementDoc(statementText: string, title?: string, signature?: Signature, status?: SignatureStatus) {
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
        ${statementFooterToDocHtml(statementText, signature, status)}
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

function isDemoSignature(signature: Signature): signature is Signature & DemoSignature {
    return (
        signature.kind === "web-crypto-ecdsa-demo" &&
        Boolean(signature.publicKeyJwk) &&
        Boolean(signature.signatureB64) &&
        Boolean(signature.signedPayload)
    );
}

const TicketDetails = ({ ticketId, currentUserId, role, onChanged }: Props) => {
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [statusBusy, setStatusBusy] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [signatureStatus, setSignatureStatus] = useState<SignatureStatus>("none");

    const reload = async () => {
        const t = await db.tickets.get(ticketId);
        setTicket(t ?? null);

        const msgs = await db.messages.where("ticketId").equals(ticketId).toArray();
        msgs.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
        setMessages(msgs);
    };

    useEffect(() => {
        void reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketId]);

    useEffect(() => {
        if (messages.length === 0) return;

        const hasUnread = messages.some((message) => (
            role === "student" ? !message.isReadByStudent : !message.isReadByOperator
        ));
        if (!hasUnread) return;

        const timer = window.setTimeout(() => {
            void markRead(ticketId, role).then(() => onChanged?.());
        }, 1200);

        return () => window.clearTimeout(timer);
    }, [messages, onChanged, role, ticketId]);

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

    const handleTakeToWork = async () => {
        if (!ticket) return;

        const now = new Date().toISOString();
        setStatusBusy(true);
        try {
            await db.tickets.update(ticket.id, {
                status: "in_progress",
                assignedTo: currentUserId,
                updatedAt: now,
            });
            await reload();
        } finally {
            setStatusBusy(false);
        }
    };

    const handleCloseTicket = async () => {
        if (!ticket) return;

        const now = new Date().toISOString();
        setStatusBusy(true);
        try {
            await db.tickets.update(ticket.id, {
                status: "closed",
                updatedAt: now,
            });
            await reload();
        } finally {
            setStatusBusy(false);
        }
    };

    const form = useMemo(() => (ticket?.formData ?? {}) as TicketFormData, [ticket]);
    const sign = form.signature;

    useEffect(() => {
        if (!sign) {
            setSignatureStatus("none");
            return;
        }

        if (!isDemoSignature(sign)) {
            setSignatureStatus("legacy");
            return;
        }

        let alive = true;

        void verifySignature(sign)
            .then((valid) => {
                if (alive) setSignatureStatus(valid ? "valid" : "invalid");
            })
            .catch(() => {
                if (alive) setSignatureStatus("invalid");
            });

        return () => {
            alive = false;
        };
    }, [sign]);

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
    const canManage = role === "admin";
    const isClosed = ticket.status === "closed";

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

                {canManage && !isClosed && (
                    <div className="td-head__actions">
                        {ticket.status === "new" ? (
                            <button
                                type="button"
                                className="td-action td-action--primary"
                                onClick={handleTakeToWork}
                                disabled={statusBusy}
                            >
                                {statusBusy ? "Обновляем..." : "Взять в работу"}
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="td-action td-action--danger"
                                onClick={handleCloseTicket}
                                disabled={statusBusy}
                            >
                                {statusBusy ? "Закрываем..." : "Закрыть обращение"}
                            </button>
                        )}
                    </div>
                )}
            </header>

            <div className="td-body">
                {/* Левая колонка — данные обращения */}
                <section className="td-card td-info">
                    <div className="td-card__title td-info__titleRow">
                        <span>Данные обращения</span>
                        {sign?.statementPreview && (
                            <button
                                type="button"
                                className="td-info__download"
                                onClick={() => downloadStatementDoc(sign.statementPreview, form.title, sign, signatureStatus)}
                            >
                                Скачать Word
                            </button>
                        )}
                        {!isClosed && role === "student" && (
                            <button type="button" className="td-info__download td-info__download--ghost" onClick={() => setEditOpen(true)}>
                                Редактировать обращение
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
                                <div className="td-info__blockTitle">Демо-подпись заявления</div>
                                <div className={`td-sign-status td-sign-status--${signatureStatus}`}>
                                    {signatureStatus === "valid"
                                        ? "Подпись действительна"
                                        : signatureStatus === "invalid"
                                        ? "Подпись не прошла проверку"
                                        : signatureStatus === "legacy"
                                        ? "Старая подпись: требуется переподписание"
                                        : "Подпись не найдена"}
                                </div>
                                <InfoRow label="Подписант" value={sign.signer} />
                                <InfoRow label="Дата подписи" value={format(new Date(sign.signedAt), "dd.MM.yyyy HH:mm", { locale: ru })} />
                                <InfoRow label="Ключ подписи" value={sign.certificateSerial} />
                                <InfoRow label="Алгоритм" value={sign.algorithm} />
                                <details className="td-info__details">
                                    <summary>Показать данные подписи</summary>
                                    {sign.signatureB64 && (
                                        <pre className="td-info__pre">{sign.signatureB64}</pre>
                                    )}
                                    {sign.digestSha256B64 && (
                                        <pre className="td-info__pre">{sign.digestSha256B64}</pre>
                                    )}
                                </details>
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
                    {isClosed ? (
                        <div className="td-chat__closed">Обращение закрыто и находится в архиве</div>
                    ) : (
                        <MessageComposer onSend={handleSend} role={role} />
                    )}
                </section>
            </div>

            {ticket && (
                <CreateTicketModal
                    open={editOpen}
                    onClose={() => setEditOpen(false)}
                    currentUserId={currentUserId}
                    initialTicket={ticket}
                    onSaved={() => {
                        setEditOpen(false);
                        void reload().then(() => onChanged?.());
                    }}
                    onCreated={() => undefined}
                />
            )}
        </div>
    );
};

export default TicketDetails;
