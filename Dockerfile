FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    DEMO_PORT=8000 \
    DEMO_HOST=0.0.0.0

WORKDIR /app

# ملفات المصدر + النسخ الديمو جاهزة داخل المجلد
COPY . .

# Express مُضمّن مسبقاً في node_modules. نثبّته فقط لو كان مفقوداً (يعمل أيضاً بدون إنترنت).
RUN if [ ! -f node_modules/express/package.json ]; then npm install --omit=dev --no-audit --no-fund; fi

EXPOSE 8000

CMD ["node", "demo-server.mjs"]
