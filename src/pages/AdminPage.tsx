import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { db, type PriorityRule, type ResponseTemplate, type TicketPriority, type User, type UserRole } from "../db/db";
import { useAuth } from "../features/auth/store";
import "../styles/admin-page.css";

const roleLabels: Record<UserRole, string> = {
    student: "Студент",
    operator: "Оператор",
    admin: "Администратор",
};

const staffRoles: UserRole[] = ["operator", "admin"];

const priorityLabels: Record<TicketPriority, string> = {
    low: "Низкий",
    normal: "Обычный",
    high: "Высокий",
};

const priorityOptions: { value: TicketPriority; label: string }[] = [
    { value: "low", label: priorityLabels.low },
    { value: "normal", label: priorityLabels.normal },
    { value: "high", label: priorityLabels.high },
];

const emptyTemplate = { title: "", preview: "", text: "" };

export default function AdminPage() {
    const userId = useAuth((s) => s.userId)!;

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [priorityRules, setPriorityRules] = useState<PriorityRule[]>([]);
    const [templates, setTemplates] = useState<ResponseTemplate[]>([]);
    const [query, setQuery] = useState("");
    const [ruleQuery, setRuleQuery] = useState("");
    const [templateDraft, setTemplateDraft] = useState(emptyTemplate);
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [me, allUsers, rules, allTemplates] = await Promise.all([
                db.users.get(userId),
                db.users.toArray(),
                db.priorityRules.toArray(),
                db.responseTemplates.toArray(),
            ]);

            setCurrentUser(me ?? null);
            setUsers(allUsers);
            setPriorityRules(rules);
            setTemplates(allTemplates);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const filteredUsers = useMemo(() => {
        const value = query.toLowerCase().trim();
        if (!value) return users;

        return users.filter((user) => (
            user.fullName.toLowerCase().includes(value) ||
            user.email.toLowerCase().includes(value) ||
            roleLabels[user.role].toLowerCase().includes(value)
        ));
    }, [query, users]);

    const filteredPriorityRules = useMemo(() => {
        const value = ruleQuery.toLowerCase().trim();
        if (!value) return priorityRules;

        return priorityRules.filter((rule) => (
            rule.topic.toLowerCase().includes(value) ||
            (rule.type ?? "").toLowerCase().includes(value) ||
            rule.description.toLowerCase().includes(value) ||
            priorityLabels[rule.priority].toLowerCase().includes(value)
        ));
    }, [priorityRules, ruleQuery]);

    const staffCount = users.filter((user) => staffRoles.includes(user.role)).length;
    const activeTemplateCount = templates.filter((template) => template.isActive).length;

    const handleRoleChange = async (targetUser: User, role: UserRole) => {
        setMessage(null);
        setSavingId(targetUser.id);

        try {
            await db.users.update(targetUser.id, { role });
            setUsers((current) => current.map((user) => (
                user.id === targetUser.id ? { ...user, role } : user
            )));

            if (targetUser.id === userId) {
                setCurrentUser((user) => (user ? { ...user, role } : user));
            }

            setMessage(`Роль пользователя ${targetUser.fullName} обновлена`);
        } finally {
            setSavingId(null);
        }
    };

    const handlePriorityRuleChange = async (rule: PriorityRule, priority: TicketPriority) => {
        if (rule.priority === priority) return;

        setMessage(null);
        setSavingRuleId(rule.id);

        try {
            const updatedAt = new Date().toISOString();
            await db.priorityRules.update(rule.id, { priority, updatedAt });
            setPriorityRules((current) => current.map((item) => (
                item.id === rule.id ? { ...item, priority, updatedAt, updatedBy: userId } : item
            )));
            setMessage(`Приоритет для типа «${rule.topic}» обновлён`);
        } finally {
            setSavingRuleId(null);
        }
    };

    const resetTemplateDraft = () => {
        setEditingTemplateId(null);
        setTemplateDraft(emptyTemplate);
    };

    const handleSaveTemplate = async () => {
        const title = templateDraft.title.trim();
        const preview = templateDraft.preview.trim();
        const text = templateDraft.text.trim();
        if (!title || !text) return;

        setMessage(null);
        setSavingTemplate(true);

        try {
            if (editingTemplateId) {
                const updated = await db.responseTemplates.update(editingTemplateId, { title, preview, text });
                setTemplates((current) => current.map((item) => (
                    item.id === editingTemplateId ? updated : item
                )));
                setMessage(`Шаблон «${title}» обновлён`);
            } else {
                const now = new Date().toISOString();
                const created = await db.responseTemplates.add({
                    id: crypto.randomUUID(),
                    title,
                    preview,
                    text,
                    isActive: true,
                    createdAt: now,
                    updatedAt: now,
                    updatedBy: userId,
                });
                setTemplates((current) => [created, ...current]);
                setMessage(`Шаблон «${title}» добавлен`);
            }

            resetTemplateDraft();
        } finally {
            setSavingTemplate(false);
        }
    };

    const handleEditTemplate = (template: ResponseTemplate) => {
        setEditingTemplateId(template.id);
        setTemplateDraft({
            title: template.title,
            preview: template.preview,
            text: template.text,
        });
    };

    const handleToggleTemplate = async (template: ResponseTemplate) => {
        const updated = await db.responseTemplates.update(template.id, { isActive: !template.isActive });
        setTemplates((current) => current.map((item) => (
            item.id === template.id ? updated : item
        )));
    };

    const handleDeleteTemplate = async (template: ResponseTemplate) => {
        await db.responseTemplates.delete(template.id);
        setTemplates((current) => current.filter((item) => item.id !== template.id));
        if (editingTemplateId === template.id) resetTemplateDraft();
        setMessage(`Шаблон «${template.title}» удалён`);
    };

    if (loading) {
        return (
            <div className="admin-page">
                <section className="admin-panel">Загрузка административной панели...</section>
            </div>
        );
    }

    if (currentUser?.role !== "admin") {
        return <Navigate to="/app" replace />;
    }

    return (
        <div className="admin-page">
            <section className="admin-panel">
                <div className="admin-panel__head">
                    <div>
                        <h1 className="admin-title">Административная панель</h1>
                        <div className="admin-subtitle">
                            Управление сотрудниками профкома, правами и правилами обработки обращений
                        </div>
                    </div>

                    <div className="admin-stats">
                        <div className="admin-stat">
                            <span className="admin-stat__value">{users.length}</span>
                            <span className="admin-stat__label">Пользователей</span>
                        </div>
                        <div className="admin-stat">
                            <span className="admin-stat__value">{staffCount}</span>
                            <span className="admin-stat__label">Сотрудников</span>
                        </div>
                        <div className="admin-stat">
                            <span className="admin-stat__value">{priorityRules.length}</span>
                            <span className="admin-stat__label">Правил приоритета</span>
                        </div>
                        <div className="admin-stat">
                            <span className="admin-stat__value">{activeTemplateCount}</span>
                            <span className="admin-stat__label">Шаблонов ответа</span>
                        </div>
                    </div>
                </div>

                <div className="admin-toolbar">
                    <input
                        className="admin-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Поиск по ФИО, email или роли"
                    />

                    {message && <div className="admin-message">{message}</div>}
                </div>

                <div className="admin-tableWrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Пользователь</th>
                                <th>Email</th>
                                <th>Текущая роль</th>
                                <th>Назначить роль</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="admin-user">
                                            <span className="admin-avatar">
                                                {user.fullName.slice(0, 1).toUpperCase()}
                                            </span>
                                            <span className="admin-user__name">{user.fullName}</span>
                                        </div>
                                    </td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={`admin-role admin-role--${user.role}`}>
                                            {roleLabels[user.role]}
                                        </span>
                                    </td>
                                    <td>
                                        <select
                                            className="admin-roleSelect"
                                            value={user.role}
                                            onChange={(event) => {
                                                void handleRoleChange(user, event.target.value as UserRole);
                                            }}
                                            disabled={savingId === user.id}
                                        >
                                            <option value="student">Студент</option>
                                            <option value="operator">Оператор профкома</option>
                                            <option value="admin">Администратор</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                        <div className="admin-empty">Пользователи не найдены</div>
                    )}
                </div>

                <section className="admin-section">
                    <div className="admin-section__head">
                        <div>
                            <h2 className="admin-section__title">Приоритеты по типам обращений</h2>
                            <div className="admin-subtitle">
                                Эти правила применяются автоматически к новым обращениям.
                            </div>
                        </div>
                        <input
                            className="admin-search"
                            value={ruleQuery}
                            onChange={(event) => setRuleQuery(event.target.value)}
                            placeholder="Поиск по теме, типу, приоритету"
                        />
                    </div>

                    <div className="admin-tableWrap">
                        <table className="admin-table admin-table--tickets">
                            <thead>
                                <tr>
                                    <th>Тема обращения</th>
                                    <th>Тип</th>
                                    <th>Логика правила</th>
                                    <th>Текущий приоритет</th>
                                    <th>Назначить приоритет</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPriorityRules.map((rule) => (
                                    <tr key={rule.id}>
                                        <td>
                                            <span className="admin-ticket__topic">{rule.topic}</span>
                                        </td>
                                        <td>{rule.type ?? "Любой"}</td>
                                        <td>{rule.description}</td>
                                        <td>
                                            <span className={`admin-priority admin-priority--${rule.priority}`}>
                                                {priorityLabels[rule.priority]}
                                            </span>
                                        </td>
                                        <td>
                                            <select
                                                className="admin-roleSelect"
                                                value={rule.priority}
                                                onChange={(event) => {
                                                    void handlePriorityRuleChange(rule, event.target.value as TicketPriority);
                                                }}
                                                disabled={savingRuleId === rule.id}
                                            >
                                                {priorityOptions.map((item) => (
                                                    <option key={item.value} value={item.value}>
                                                        {item.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredPriorityRules.length === 0 && (
                            <div className="admin-empty">Правила приоритета не найдены</div>
                        )}
                    </div>
                </section>

                <section className="admin-section">
                    <div className="admin-section__head">
                        <div>
                            <h2 className="admin-section__title">Шаблоны ответов</h2>
                            <div className="admin-subtitle">
                                Название отображается кнопкой, мини-превью видно при наведении, а текст вставляется в поле ответа.
                            </div>
                        </div>
                    </div>

                    <div className="admin-template-editor">
                        <label>
                            Название
                            <input
                                className="admin-input"
                                value={templateDraft.title}
                                onChange={(event) => setTemplateDraft((draft) => ({ ...draft, title: event.target.value }))}
                                placeholder="Например: Документы проверены"
                            />
                        </label>
                        <label>
                            Мини-превью
                            <input
                                className="admin-input"
                                value={templateDraft.preview}
                                onChange={(event) => setTemplateDraft((draft) => ({ ...draft, preview: event.target.value }))}
                                placeholder="Краткое описание для подсказки"
                            />
                        </label>
                        <label className="admin-template-editor__text">
                            Текст для вставки
                            <textarea
                                className="admin-input admin-textarea"
                                value={templateDraft.text}
                                onChange={(event) => setTemplateDraft((draft) => ({ ...draft, text: event.target.value }))}
                                placeholder="Текст, который будет вставлен в сообщение"
                                rows={4}
                            />
                        </label>
                        <div className="admin-template-editor__actions">
                            <button
                                type="button"
                                className="admin-btn admin-btn--primary"
                                onClick={() => void handleSaveTemplate()}
                                disabled={savingTemplate || !templateDraft.title.trim() || !templateDraft.text.trim()}
                            >
                                {editingTemplateId ? "Сохранить" : "Добавить"}
                            </button>
                            {editingTemplateId && (
                                <button type="button" className="admin-btn" onClick={resetTemplateDraft}>
                                    Отмена
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="admin-template-grid">
                        {templates.map((template) => (
                            <article className={`admin-template-card ${!template.isActive ? "admin-template-card--off" : ""}`} key={template.id}>
                                <div className="admin-template-card__head">
                                    <div>
                                        <h3>{template.title}</h3>
                                        <p>{template.preview || "Без мини-превью"}</p>
                                    </div>
                                    <span className={`admin-template-status ${template.isActive ? "admin-template-status--on" : "admin-template-status--off"}`}>
                                        {template.isActive ? "Активен" : "Скрыт"}
                                    </span>
                                </div>
                                <pre>{template.text}</pre>
                                <div className="admin-template-card__actions">
                                    <button type="button" className="admin-btn" onClick={() => handleEditTemplate(template)}>
                                        Редактировать
                                    </button>
                                    <button type="button" className="admin-btn" onClick={() => void handleToggleTemplate(template)}>
                                        {template.isActive ? "Скрыть" : "Показать"}
                                    </button>
                                    <button type="button" className="admin-btn admin-btn--danger" onClick={() => void handleDeleteTemplate(template)}>
                                        Удалить
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            </section>
        </div>
    );
}
