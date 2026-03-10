import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { db, type Ticket, type User } from "../db/db";
import { sha256Base64 } from "../lib/digest";
import "../styles/create-ticket.css";

const TOPICS = [
    "Материальная поддержка",
    "Социальная поддержка",
    "Общежитие",
    "Справка/документы",
    "Вопрос по стипендии",
    "Другое",
] as const;

const TOPIC_ENUM = TOPICS as unknown as [string, ...string[]];

// ===== Мат. поддержка (категории) =====
const MS_CATEGORIES = [
    "Студенты-сироты (дети-сироты и дети, оставшиеся без попечения родителей)",
    "Студенты-инвалиды",
    "Студенты, пострадавшие в результате аварии на Чернобыльской АЭС",
    "Студенты, воспитывающие детей",
    "Студенты из многодетных семей (трое и более детей)",
    "Студенты из неполных семей",
    "Студенты, имеющие обоих родителей-инвалидов или родителей-пенсионеров",
    "Студенты, находящиеся на диспансерном учете с хроническим заболеванием",
] as const;

// Для подсказки «какие документы» (мат. поддержка)
const MS_DOCS: Record<(typeof MS_CATEGORIES)[number], string> = {
    "Студенты-сироты (дети-сироты и дети, оставшиеся без попечения родителей)":
        "Решение суда о назначении опекунства или свидетельство о смерти родителей",
    "Студенты-инвалиды": "Инвалидное удостоверение или справка",
    "Студенты, пострадавшие в результате аварии на Чернобыльской АЭС":
        "Чернобыльское удостоверение или справка",
    "Студенты, воспитывающие детей": "Свидетельство о рождении ребенка",
    "Студенты из многодетных семей (трое и более детей)":
        "Удостоверение многодетной семьи или справка из ЖЭКа по месту жительства о составе семьи",
    "Студенты из неполных семей":
        "Свидетельство о расторжении брака/о смерти одного из родителей/справка из ЗАГС о том, что отец записан со слов матери или прочерк",
    "Студенты, имеющие обоих родителей-инвалидов или родителей-пенсионеров":
        "Пенсионные удостоверения или удостоверения об инвалидности родителей",
    "Студенты, находящиеся на диспансерном учете с хроническим заболеванием":
        "Справка о диспансерном учёте + копия лицензии мед. учреждения (справка < 1 года)",
};

const MS_CAT_ENUM = MS_CATEGORIES as unknown as [string, ...string[]];

const RECTOR_TO_DEFAULT = "Ректору ФГБОУ ВО «МГТУ «СТАНКИН»";
const PROFKOM_TO_DEFAULT = "В профком обучающихся МГТУ «СТАНКИН»";

// ===== Соц. поддержка =====
const SS_LEVELS = ["Студент", "Аспирант"] as const;
const SS_LEVEL_ENUM = SS_LEVELS as unknown as [string, ...string[]];

const SS_STUDENT_CATEGORIES = [
    "Студенты-сироты (дети-сироты и дети, оставшиеся без попечения родителей)",
    "Студенты-инвалиды",
    "Студенты, пострадавшие в результате аварии на Чернобыльской АЭС",
    "Студенты, воспитывающие детей",
    "Студенты из многодетных семей (трое и более детей)",
    "Студенты из неполных семей",
    "Студенты, имеющие обоих родителей-инвалидов или родителей-пенсионеров",
    "Студенты, находящиеся на диспансерном учете с хроническим заболеванием",
    "Студенты - участники боевых действий",
    "Студенты, вступившие в брак в период обучения (возраст супругов до 35 лет)",
    "Студенты, имеющие родителей - участников боевых действий в зоне СВО",
] as const;

const SS_ASP_CATEGORIES = [
    "Аспиранты-инвалиды",
    "Аспиранты, имеющие детей",
    "Аспиранты-участники боевых действий",
    "Аспиранты, пострадавшие в результате аварии на Чернобыльской АЭС",
    "Аспиранты, вступившие в брак в период обучения (возраст супругов — до 35 лет)",
    "Аспиранты, имеющие родителей, участников боевых действий в зоне СВО",
] as const;

// Документы (соц. поддержка — студент)
const SS_STUDENT_DOCS: Record<(typeof SS_STUDENT_CATEGORIES)[number], string> = {
    "Студенты-сироты (дети-сироты и дети, оставшиеся без попечения родителей)":
        "Решение суда о назначении опекунства или свидетельство о смерти родителей",
    "Студенты-инвалиды": "Инвалидное удостоверение или справка",
    "Студенты, пострадавшие в результате аварии на Чернобыльской АЭС":
        "Чернобыльское удостоверение или справка",
    "Студенты, воспитывающие детей": "Свидетельство о рождении ребенка",
    "Студенты из многодетных семей (трое и более детей)":
        "Удостоверение многодетной семьи или справка из ЖЭКа по месту жительства о составе семьи",
    "Студенты из неполных семей":
        "Свидетельство о расторжении брака/о смерти одного из родителей/справка из ЗАГС о том, что отец записан со слов матери или прочерк",
    "Студенты, имеющие обоих родителей-инвалидов или родителей-пенсионеров":
        "Пенсионные удостоверения или удостоверения об инвалидности родителей",
    "Студенты, находящиеся на диспансерном учете с хроническим заболеванием":
        "Справка о диспансерном учёте + копия лицензии мед. учреждения (справка < 1 года)",
    "Студенты - участники боевых действий": "Удостоверение участника боевых действий",
    "Студенты, вступившие в брак в период обучения (возраст супругов до 35 лет)":
        "Ксерокопия свидетельства о заключении брака + ксерокопия паспорта (разворот 14–15 со штампом)",
    "Студенты, имеющие родителей - участников боевых действий в зоне СВО":
        "Ксерокопия справки из военного комиссариата",
};

// Документы (соц. поддержка — аспирант)
const SS_ASP_DOCS: Record<(typeof SS_ASP_CATEGORIES)[number], string> = {
    "Аспиранты-инвалиды": "Инвалидное удостоверение или справка",
    "Аспиранты, имеющие детей": "Свидетельство о рождении ребенка",
    "Аспиранты-участники боевых действий": "Удостоверение участника боевых действий",
    "Аспиранты, пострадавшие в результате аварии на Чернобыльской АЭС":
        "Чернобыльское удостоверение или справка из УСЗН",
    "Аспиранты, вступившие в брак в период обучения (возраст супругов — до 35 лет)":
        "Ксерокопия свидетельства о заключении брака + ксерокопия паспорта (разворот 14–15 со штампом)",
    "Аспиранты, имеющие родителей, участников боевых действий в зоне СВО":
        "Ксерокопия справки из военного комиссариата",
};

// ===== Schema =====
const schema = z
    .object({
        topic: z.enum(TOPIC_ENUM),

        // общие поля
        title: z.string().min(3, "Коротко опиши проблему (мин. 3 символа)"),
        description: z.string().optional(),

        // ===== Материальная поддержка =====
        ms_to: z.string().optional(),
        ms_group: z.string().optional(),
        ms_studentCard: z.string().optional(),
        ms_category: z.enum(MS_CAT_ENUM).optional(),
        ms_statementText: z.string().optional(),
        ms_confirmUnionAndCitizen: z.boolean().optional(),

        // ===== Социальная поддержка =====
        ss_to: z.string().optional(),
        ss_level: z.enum(SS_LEVEL_ENUM).optional(), // Студент/Аспирант
        ss_group: z.string().optional(),
        ss_studentCard: z.string().optional(),
        ss_category: z.string().optional(), // проверим вручную в superRefine
        ss_statementText: z.string().optional(),

        // подпись
        sign_name: z.string().optional(),
        sign_agree: z.boolean().optional(),
    })
    .superRefine((val, ctx) => {
        // ===== Мат. поддержка =====
        if (val.topic === "Материальная поддержка") {
            if (!val.ms_group || val.ms_group.trim().length < 3) {
                ctx.addIssue({ code: "custom", path: ["ms_group"], message: "Укажи группу" });
            }
            if (!val.ms_studentCard || val.ms_studentCard.trim().length < 3) {
                ctx.addIssue({ code: "custom", path: ["ms_studentCard"], message: "Укажи № студенческого билета" });
            }
            if (!val.ms_category) {
                ctx.addIssue({ code: "custom", path: ["ms_category"], message: "Выбери категорию" });
            }
            if (!val.ms_statementText || val.ms_statementText.trim().length < 30) {
                ctx.addIssue({
                    code: "custom",
                    path: ["ms_statementText"],
                    message: "Текст заявления: минимум 30 символов",
                });
            }
            if (val.ms_confirmUnionAndCitizen !== true) {
                ctx.addIssue({
                    code: "custom",
                    path: ["ms_confirmUnionAndCitizen"],
                    message: "Подтвердите условие (член профсоюза + гражданин РФ)",
                });
            }
            if (!val.sign_name || val.sign_name.trim().length < 3) {
                ctx.addIssue({ code: "custom", path: ["sign_name"], message: "Подпись: укажи ФИО" });
            }
            if (val.sign_agree !== true) {
                ctx.addIssue({ code: "custom", path: ["sign_agree"], message: "Нужно подтвердить согласие" });
            }
        }

        // ===== Соц. поддержка =====
        if (val.topic === "Социальная поддержка") {
            if (!val.ss_level) {
                ctx.addIssue({ code: "custom", path: ["ss_level"], message: "Выбери уровень (студент/аспирант)" });
            }

            if (!val.ss_group || val.ss_group.trim().length < 3) {
                ctx.addIssue({ code: "custom", path: ["ss_group"], message: "Укажи группу" });
            }
            if (!val.ss_studentCard || val.ss_studentCard.trim().length < 3) {
                ctx.addIssue({ code: "custom", path: ["ss_studentCard"], message: "Укажи № студенческого билета" });
            }

            const cat = (val.ss_category ?? "").trim();
            if (!cat) {
                ctx.addIssue({ code: "custom", path: ["ss_category"], message: "Выбери категорию" });
            } else {
                const allowed =
                    val.ss_level === "Аспирант"
                        ? (SS_ASP_CATEGORIES as readonly string[])
                        : (SS_STUDENT_CATEGORIES as readonly string[]);
                if (!allowed.includes(cat)) {
                    ctx.addIssue({ code: "custom", path: ["ss_category"], message: "Категория не из списка" });
                }
            }

            if (!val.ss_statementText || val.ss_statementText.trim().length < 30) {
                ctx.addIssue({
                    code: "custom",
                    path: ["ss_statementText"],
                    message: "Текст заявления: минимум 30 символов",
                });
            }

            if (!val.sign_name || val.sign_name.trim().length < 3) {
                ctx.addIssue({ code: "custom", path: ["sign_name"], message: "Подпись: укажи ФИО" });
            }
            if (val.sign_agree !== true) {
                ctx.addIssue({ code: "custom", path: ["sign_agree"], message: "Нужно подтвердить согласие" });
            }
        }
    });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type Props = {
    open: boolean;
    onClose: () => void;
    currentUserId: string;
    onCreated: (ticketId: string) => void;
};

type TicketFormData = {
    title: string;
    description: string;

    materialSupport?: {
        to: string;
        group: string;
        studentCard: string;
        category: string;
        statementText: string;
        confirmUnionAndCitizen: boolean;
        hints: {
            when: string[];
            docsCommon: string[];
            docsForCategory: string;
        };
    };

    socialSupport?: {
        to: string;
        level: "Студент" | "Аспирант";
        group: string;
        studentCard: string;
        category: string;
        statementText: string;
        hints: {
            when: string[];
            docsCommon: string[];
            docsForCategory: string;
        };
    };

    signature?: {
        kind: "demo-digital-signature";
        signer: string;
        signedAt: string;
        digestSha256B64: string;
        statementPreview: string;
    };
};

const CreateTicketModal = ({ open, onClose, currentUserId, onCreated }: Props) => {
    const [me, setMe] = useState<User | null>(null);
    const [busy, setBusy] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        control,
        formState: { errors },
    } = useForm<FormInput>({
        resolver: zodResolver(schema),
        defaultValues: {
            topic: "Материальная поддержка",
            title: "",
            description: "",

            ms_to: RECTOR_TO_DEFAULT,
            ms_group: "",
            ms_studentCard: "",
            ms_category: MS_CATEGORIES[0],
            ms_statementText: "",
            ms_confirmUnionAndCitizen: false,

            ss_to: PROFKOM_TO_DEFAULT,
            ss_level: "Студент",
            ss_group: "",
            ss_studentCard: "",
            ss_category: SS_STUDENT_CATEGORIES[0],
            ss_statementText: "",

            sign_name: "",
            sign_agree: false,
        },
    });

    const values = useWatch({ control });
    const topic = values?.topic;

    useEffect(() => {
        if (!open) return;

        const load = async () => {
            const u = await db.users.get(currentUserId);
            setMe(u ?? null);
            if (u?.fullName) setValue("sign_name", u.fullName);
            setValue("ms_to", RECTOR_TO_DEFAULT);
            setValue("ss_to", PROFKOM_TO_DEFAULT);
        };

        void load();
    }, [open, currentUserId, setValue]);

    useEffect(() => {
        if (!open) return;

        reset({
            topic: "Материальная поддержка",
            title: "",
            description: "",

            ms_to: RECTOR_TO_DEFAULT,
            ms_group: "",
            ms_studentCard: "",
            ms_category: MS_CATEGORIES[0],
            ms_statementText: "",
            ms_confirmUnionAndCitizen: false,

            ss_to: PROFKOM_TO_DEFAULT,
            ss_level: "Студент",
            ss_group: "",
            ss_studentCard: "",
            ss_category: SS_STUDENT_CATEGORIES[0],
            ss_statementText: "",

            sign_name: me?.fullName ?? "",
            sign_agree: false,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // динамический список категорий соц. поддержки
    const ssCategoryOptions =
        values?.ss_level === "Аспирант" ? (SS_ASP_CATEGORIES as readonly string[]) : (SS_STUDENT_CATEGORIES as readonly string[]);

    // Если переключили уровень — подставим первую категорию соответствующего списка
    useEffect(() => {
        if (!open) return;
        if (topic !== "Социальная поддержка") return;

        const current = (values?.ss_category ?? "").trim();
        if (!current || !ssCategoryOptions.includes(current)) {
            setValue("ss_category", ssCategoryOptions[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [values?.ss_level, topic, open]);

    const msDocForCategory = useMemo(() => {
        const cat = values?.ms_category as (typeof MS_CATEGORIES)[number] | undefined;
        return cat ? MS_DOCS[cat] : "";
    }, [values?.ms_category]);

    const ssDocForCategory = useMemo(() => {
        const lvl = values?.ss_level;
        const cat = (values?.ss_category ?? "").trim();

        if (!lvl || !cat) return "";

        if (lvl === "Аспирант") {
            const key = cat as (typeof SS_ASP_CATEGORIES)[number];
            return SS_ASP_DOCS[key] ?? "";
        }
        const key = cat as (typeof SS_STUDENT_CATEGORIES)[number];
        return SS_STUDENT_DOCS[key] ?? "";
    }, [values?.ss_level, values?.ss_category]);

    const commonDocsHints = [
        "Документы приносятся только в виде распечатанных ксерокопий с оригинала (не фото).",
        "Дистанционно документы не принимаются.",
        "Если оформляете 2 выплаты — нужны ДВЕ КОПИИ документов.",
    ];

    const msWhenHints = [
        "Выплачивается 2 раза в семестр.",
        "Только членам профсоюза и гражданам РФ.",
        "Квота на материальную поддержку ограничена.",
    ];

    const ssWhenHints = [
        "Выплата назначается по категориям — документы сдаются в установленные даты.",
        "Документы предоставляются в профком обучающихся.",
    ];

    const msPreview = useMemo(() => {
        if (topic !== "Материальная поддержка") return "";

        const to = values?.ms_to ?? RECTOR_TO_DEFAULT;
        const fio = values?.sign_name ?? me?.fullName ?? "";
        const group = values?.ms_group ?? "";
        const card = values?.ms_studentCard ?? "";
        const cat = values?.ms_category ?? "";
        const text = values?.ms_statementText ?? "";

        return `${to}

от студента(ки) группы ${group}
${fio}
студенческий билет № ${card}

ЗАЯВЛЕНИЕ

Категория: ${cat}

${text}

Дата: ${new Date().toLocaleDateString("ru-RU")}
Подпись: ${fio}`;
    }, [topic, values, me]);

    const ssPreview = useMemo(() => {
        if (topic !== "Социальная поддержка") return "";

        const to = values?.ss_to ?? PROFKOM_TO_DEFAULT;
        const fio = values?.sign_name ?? me?.fullName ?? "";
        const level = values?.ss_level ?? "Студент";
        const group = values?.ss_group ?? "";
        const card = values?.ss_studentCard ?? "";
        const cat = values?.ss_category ?? "";
        const text = values?.ss_statementText ?? "";

        return `${to}

от ${level.toLowerCase()}а(ки) группы ${group}
${fio}
студенческий билет № ${card}

ЗАЯВЛЕНИЕ

Категория: ${cat}

${text}

Дата: ${new Date().toLocaleDateString("ru-RU")}
Подпись: ${fio}`;
    }, [topic, values, me]);

    const submit = async (raw: FormInput) => {
        setBusy(true);
        try {
            const vals: FormOutput = schema.parse(raw);
            const now = new Date().toISOString();
            const id = crypto.randomUUID();

            let type = "Общее";

            let formData: TicketFormData = {
                title: vals.title,
                description: (vals.description ?? "").trim(),
            };

            const signer = (vals.sign_name ?? me?.fullName ?? "").trim();

            if (vals.topic === "Материальная поддержка") {
                type = "Финансы";

                const payload = JSON.stringify({
                    topic: vals.topic,
                    title: vals.title,
                    studentId: currentUserId,
                    to: vals.ms_to ?? RECTOR_TO_DEFAULT,
                    group: vals.ms_group,
                    studentCard: vals.ms_studentCard,
                    category: vals.ms_category,
                    statementText: vals.ms_statementText,
                    confirmUnionAndCitizen: vals.ms_confirmUnionAndCitizen,
                    signer,
                    signedAt: now,
                });

                const digest = await sha256Base64(payload);

                const cat = vals.ms_category!;
                formData = {
                    ...formData,
                    materialSupport: {
                        to: (vals.ms_to ?? RECTOR_TO_DEFAULT).trim(),
                        group: vals.ms_group!.trim(),
                        studentCard: vals.ms_studentCard!.trim(),
                        category: cat,
                        statementText: vals.ms_statementText!.trim(),
                        confirmUnionAndCitizen: !!vals.ms_confirmUnionAndCitizen,
                        hints: {
                            when: msWhenHints,
                            docsCommon: commonDocsHints,
                            docsForCategory: MS_DOCS[cat],
                        },
                    },
                    signature: {
                        kind: "demo-digital-signature",
                        signer,
                        signedAt: now,
                        digestSha256B64: digest,
                        statementPreview: msPreview,
                    },
                };
            }

            if (vals.topic === "Социальная поддержка") {
                type = "Социальная";

                const payload = JSON.stringify({
                    topic: vals.topic,
                    title: vals.title,
                    studentId: currentUserId,
                    to: vals.ss_to ?? PROFKOM_TO_DEFAULT,
                    level: vals.ss_level,
                    group: vals.ss_group,
                    studentCard: vals.ss_studentCard,
                    category: vals.ss_category,
                    statementText: vals.ss_statementText,
                    signer,
                    signedAt: now,
                });

                const digest = await sha256Base64(payload);

                const lvl = (vals.ss_level ?? "Студент") as "Студент" | "Аспирант";
                const cat = (vals.ss_category ?? "").trim();

                const docsForCat =
                    lvl === "Аспирант"
                        ? SS_ASP_DOCS[cat as (typeof SS_ASP_CATEGORIES)[number]] ?? ""
                        : SS_STUDENT_DOCS[cat as (typeof SS_STUDENT_CATEGORIES)[number]] ?? "";

                formData = {
                    ...formData,
                    socialSupport: {
                        to: (vals.ss_to ?? PROFKOM_TO_DEFAULT).trim(),
                        level: lvl,
                        group: vals.ss_group!.trim(),
                        studentCard: vals.ss_studentCard!.trim(),
                        category: cat,
                        statementText: vals.ss_statementText!.trim(),
                        hints: {
                            when: ssWhenHints,
                            docsCommon: commonDocsHints,
                            docsForCategory: docsForCat,
                        },
                    },
                    signature: {
                        kind: "demo-digital-signature",
                        signer,
                        signedAt: now,
                        digestSha256B64: digest,
                        statementPreview: ssPreview,
                    },
                };
            }

            const ticket: Ticket = {
                id,
                studentId: currentUserId,
                topic: vals.topic,
                type,
                status: "new",
                createdAt: now,
                updatedAt: now,
                formData,
            };

            await db.tickets.add(ticket);

            await db.messages.add({
                id: crypto.randomUUID(),
                ticketId: id,
                authorId: currentUserId,
                text:
                    vals.topic === "Материальная поддержка"
                        ? `Создано обращение: Материальная поддержка (${vals.ms_category}).`
                        : vals.topic === "Социальная поддержка"
                            ? `Создано обращение: Социальная поддержка (${vals.ss_level}, ${vals.ss_category}).`
                            : `Создано обращение: ${vals.topic}. ${vals.title}`,
                createdAt: now,
                isReadByStudent: true,
                isReadByOperator: false,
            });

            onCreated(id);
            onClose();
        } finally {
            setBusy(false);
        }
    };

    if (!open) return null;

    return (
        <div className="ctm-overlay" onMouseDown={onClose}>
            <div className="ctm" onMouseDown={(e) => e.stopPropagation()}>
                <div className="ctm__head">
                    <div>
                        <div className="ctm__title">Новое обращение</div>
                        <div className="ctm__sub">Заполните форму и отправьте обращение</div>
                    </div>

                    <button type="button" className="ctm__x" onClick={onClose} aria-label="Закрыть">
                        ✕
                    </button>
                </div>

                <form className="ctm__form" onSubmit={handleSubmit(submit)}>
                    {/* СКРОЛЛ-ТЕЛО */}
                    <div className="ctm__body">
                            <div className="ctm__grid">
                            <label className="ctm__label">
                                Тема обращения
                                <select className="ctm__input" {...register("topic")}>
                                    {TOPICS.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="ctm__label">
                                Кратко (заголовок)
                                <input className="ctm__input" {...register("title")} placeholder="Например: Хочу оформить поддержку" />
                                {errors.title && <div className="ctm__err">{String(errors.title.message)}</div>}
                            </label>

                            <label className="ctm__label ctm__label--wide">
                                Описание (необязательно)
                                <textarea className="ctm__ta" {...register("description")} rows={3} placeholder="Опишите ситуацию..." />
                            </label>

                            {/* ===== Мат. поддержка ===== */}
                            {topic === "Материальная поддержка" && (
                                <>
                                    <div className="ctm__section ctm__label--wide">Материальная поддержка</div>

                                    <div className="ctm__info ctm__label--wide">
                                        <div className="ctm__infoTitle">Важно</div>
                                        <ul className="ctm__infoList">
                                            {msWhenHints.map((x) => (
                                                <li key={x}>{x}</li>
                                            ))}
                                            {commonDocsHints.map((x) => (
                                                <li key={x}>{x}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    <label className="ctm__label ctm__label--wide">
                                        Кому (адресат)
                                        <input className="ctm__input" {...register("ms_to")} />
                                    </label>

                                    <label className="ctm__label">
                                        Группа
                                        <input className="ctm__input" {...register("ms_group")} placeholder="ИДБ-22-11" />
                                        {errors.ms_group && <div className="ctm__err">{String(errors.ms_group.message)}</div>}
                                    </label>

                                    <label className="ctm__label">
                                        № студенческого билета
                                        <input className="ctm__input" {...register("ms_studentCard")} placeholder="Например: 123456" />
                                        {errors.ms_studentCard && <div className="ctm__err">{String(errors.ms_studentCard.message)}</div>}
                                    </label>

                                    <label className="ctm__label ctm__label--wide">
                                        Категория
                                        <select className="ctm__input" {...register("ms_category")}>
                                            {MS_CATEGORIES.map((c) => (
                                                <option key={c} value={c}>
                                                    {c}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.ms_category && <div className="ctm__err">{String(errors.ms_category.message)}</div>}
                                    </label>

                                    <div className="ctm__hint ctm__label--wide">
                                        <b>Документы по выбранной категории:</b> {msDocForCategory}
                                    </div>

                                    <label className="ctm__label ctm__label--wide">
                                        Текст заявления
                                        <textarea
                                            className="ctm__ta"
                                            {...register("ms_statementText")}
                                            rows={5}
                                            placeholder="Прошу оказать мне материальную поддержку в связи с ... (укажите обстоятельства)."
                                        />
                                        {errors.ms_statementText && <div className="ctm__err">{String(errors.ms_statementText.message)}</div>}
                                    </label>

                                    <label className="ctm__check ctm__label--wide">
                                        <input type="checkbox" {...register("ms_confirmUnionAndCitizen")} />
                                        Подтверждаю: я являюсь членом профсоюза и гражданином РФ
                                    </label>
                                    {errors.ms_confirmUnionAndCitizen && (
                                        <div className="ctm__err ctm__label--wide">{String(errors.ms_confirmUnionAndCitizen.message)}</div>
                                    )}

                                    <div className="ctm__section ctm__label--wide">Цифровая подпись (демо)</div>

                                    <label className="ctm__label ctm__label--wide">
                                        Подписант (ФИО)
                                        <input className="ctm__input" {...register("sign_name")} placeholder={me?.fullName ?? "ФИО"} />
                                        {errors.sign_name && <div className="ctm__err">{String(errors.sign_name.message)}</div>}
                                    </label>

                                    <label className="ctm__check ctm__label--wide">
                                        <input type="checkbox" {...register("sign_agree")} />
                                        Подтверждаю достоверность данных и согласен(на) на обработку персональных данных
                                    </label>
                                    {errors.sign_agree && <div className="ctm__err ctm__label--wide">{String(errors.sign_agree.message)}</div>}

                                    <div className="ctm__preview ctm__label--wide">
                                        <div className="ctm__previewTitle">Предпросмотр заявления</div>
                                        <pre className="ctm__pre">{msPreview}</pre>
                                    </div>

                            </>
                        )}

                        {/* ===== Соц. поддержка ===== */}
                        {topic === "Социальная поддержка" && (
                            <>
                                <div className="ctm__section ctm__label--wide">Социальная поддержка</div>

                                <div className="ctm__info ctm__label--wide">
                                    <div className="ctm__infoTitle">Важно</div>
                                    <ul className="ctm__infoList">
                                        {ssWhenHints.map((x) => (
                                            <li key={x}>{x}</li>
                                        ))}
                                        {commonDocsHints.map((x) => (
                                            <li key={x}>{x}</li>
                                        ))}
                                    </ul>
                                </div>

                                <label className="ctm__label ctm__label--wide">
                                    Кому (адресат)
                                    <input className="ctm__input" {...register("ss_to")} />
                                </label>

                                <label className="ctm__label">
                                    Уровень
                                    <select className="ctm__input" {...register("ss_level")}>
                                        {SS_LEVELS.map((l) => (
                                            <option key={l} value={l}>
                                                {l}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.ss_level && <div className="ctm__err">{String(errors.ss_level.message)}</div>}
                                </label>

                                <label className="ctm__label">
                                    Группа
                                    <input className="ctm__input" {...register("ss_group")} placeholder="ИДБ-22-11" />
                                    {errors.ss_group && <div className="ctm__err">{String(errors.ss_group.message)}</div>}
                                </label>

                                <label className="ctm__label">
                                    № студенческого билета
                                    <input className="ctm__input" {...register("ss_studentCard")} placeholder="Например: 123456" />
                                    {errors.ss_studentCard && <div className="ctm__err">{String(errors.ss_studentCard.message)}</div>}
                                </label>

                                <label className="ctm__label ctm__label--wide">
                                    Категория
                                    <select className="ctm__input" {...register("ss_category")}>
                                        {ssCategoryOptions.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.ss_category && <div className="ctm__err">{String(errors.ss_category.message)}</div>}
                                </label>

                                <div className="ctm__hint ctm__label--wide">
                                    <b>Документы по выбранной категории:</b> {ssDocForCategory}
                                </div>

                                <label className="ctm__label ctm__label--wide">
                                    Текст заявления
                                    <textarea
                                        className="ctm__ta"
                                        {...register("ss_statementText")}
                                        rows={5}
                                        placeholder="Прошу назначить социальную поддержку в связи с ... (укажите обстоятельства)."
                                    />
                                    {errors.ss_statementText && <div className="ctm__err">{String(errors.ss_statementText.message)}</div>}
                                </label>

                                <div className="ctm__section ctm__label--wide">Цифровая подпись (демо)</div>

                                <label className="ctm__label ctm__label--wide">
                                    Подписант (ФИО)
                                    <input className="ctm__input" {...register("sign_name")} placeholder={me?.fullName ?? "ФИО"} />
                                    {errors.sign_name && <div className="ctm__err">{String(errors.sign_name.message)}</div>}
                                </label>

                                <label className="ctm__check ctm__label--wide">
                                    <input type="checkbox" {...register("sign_agree")} />
                                    Подтверждаю достоверность данных и согласен(на) на обработку персональных данных
                                </label>
                                {errors.sign_agree && <div className="ctm__err ctm__label--wide">{String(errors.sign_agree.message)}</div>}

                                <div className="ctm__preview ctm__label--wide">
                                    <div className="ctm__previewTitle">Предпросмотр заявления</div>
                                    <pre className="ctm__pre">{ssPreview}</pre>
                                </div>
                            </>
                        )}
                    </div>
                    </div>
                    <div className="ctm__foot">
                        <button type="button" className="ctm-btn" onClick={onClose}>
                            Отмена
                        </button>
                        <button type="submit" className="ctm-btn ctm-btn--primary" disabled={busy}>
                            {busy ? "Создаём…" : "Создать обращение"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTicketModal;