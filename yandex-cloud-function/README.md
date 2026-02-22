# CORS-прокси для Yandex Cloud Functions

Альтернатива Cloudflare Worker для пользователей в России (работает без VPN).

> **Ограничение:** Yandex Cloud Functions не поддерживают стриминг — ответ LLM
> появится целиком после завершения генерации, а не токен за токеном.
> Для длинных документов (МСЭК) возможно ожидание 20–60 с без индикации прогресса.
> Если важен стриминг — используйте Cloudflare Worker (`/worker/`).

## Деплой

1. Откройте [console.yandex.cloud](https://console.yandex.cloud) → **Cloud Functions** → **Создать функцию**.
2. Среда выполнения: **Node.js 18**.
3. Точка входа: `index.handler`.
4. Загрузите файл `index.js` из этой папки (или вставьте содержимое вручную).
5. *(Опционально)* Добавьте переменную окружения `ALLOWED_HOSTS` с вашим списком
   хостов через запятую, если нужны хосты помимо стандартных.
6. Включите **публичный доступ** к функции.
7. Скопируйте HTTPS-URL вызова функции (вида `https://functions.yandexcloud.net/…`).
8. Вставьте URL в ПНД.doc → **Настройки** → **URL прокси-сервера** → **Сохранить**.

## Стандартные разрешённые хосты

```
api.anthropic.com
api.openai.com
api.deepseek.com
generativelanguage.googleapis.com
llm.api.cloud.yandex.net
```

Для добавления собственных хостов (ollama, vLLM и т.д.) задайте переменную `ALLOWED_HOSTS`.
