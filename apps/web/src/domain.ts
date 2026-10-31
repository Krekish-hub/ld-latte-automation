export const categories = {
  bot: "Бот",
  integration: "Интеграция",
  report: "Отчёт",
  other: "Другое",
} as const;
export const statuses = {
  new: "Новая",
  in_progress: "В работе",
  completed: "Завершена",
} as const;
export type Category = keyof typeof categories;
export type Status = keyof typeof statuses;
export type Draft = {
  title: string;
  description: string;
  category: Category | "";
};
export type RequestRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: Category;
  status: Status;
  created_at: string;
  updated_at: string;
};
export const emptyDraft: Draft = { title: "", description: "", category: "" };
export function validateDraft(draft: Draft) {
  const errors: Partial<Record<keyof Draft, string>> = {};
  if (!draft.title.trim()) errors.title = "Введите название заявки";
  else if (draft.title.trim().length > 160)
    errors.title = "Не более 160 символов";
  if (!draft.description.trim()) errors.description = "Опишите задачу";
  else if (draft.description.trim().length > 10000)
    errors.description = "Не более 10 000 символов";
  if (!Object.hasOwn(categories, draft.category))
    errors.category = "Выберите категорию";
  return errors;
}
export function payload(draft: Draft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category as Category,
  };
}
export function matchesDraft(row: RequestRow, draft: Draft) {
  const expected = payload(draft);
  return (
    row.title === expected.title &&
    row.description === expected.description &&
    row.category === expected.category
  );
}
export function escapeSearch(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
export function isAuthRateLimit(error: unknown) {
  const e = error as { code?: string; status?: number };
  return (
    e?.status === 429 ||
    e?.code === "over_email_send_rate_limit" ||
    e?.code === "over_request_rate_limit"
  );
}
export function humanError(error: unknown) {
  const e = error as { code?: string; message?: string; status?: number };
  if (e?.message === "Invalid login credentials")
    return "Неверная почта или пароль.";
  if (e?.message === "Email not confirmed")
    return "Подтвердите почту по ссылке в письме, затем войдите.";
  if (
    e?.code === "email_address_not_authorized" ||
    e?.message?.includes("Email address not authorized")
  )
    return "Отправка писем для этого адреса ещё не настроена. Сообщите владельцу сервиса.";
  if (isAuthRateLimit(e))
    return "Слишком много попыток. Подождите немного и попробуйте ещё раз.";
  if (e?.code === "user_already_exists")
    return "Аккаунт уже существует. Попробуйте войти.";
  if (e?.code === "weak_password") return "Выберите более сложный пароль.";
  if (e?.code === "PGRST205" || e?.code === "42P01")
    return "Хранилище заявок ещё не настроено. Попробуйте позже.";
  if (e?.code === "42501")
    return "Нет доступа к данным. Войдите заново; если ошибка повторится, сообщите владельцу сервиса.";
  if (e?.code === "23514" || e?.code === "23502")
    return "Проверьте обязательные поля и допустимые значения.";
  if (e?.code === "23505")
    return "Запись с таким идентификатором уже есть. Обновите данные перед повтором.";
  if (
    e?.message?.includes("fetch") ||
    e?.message?.includes("network") ||
    e?.message?.includes("Failed to")
  )
    return "Не удалось связаться с сервером. Проверьте соединение и повторите.";
  return "Не удалось выполнить действие. Попробуйте ещё раз.";
}
