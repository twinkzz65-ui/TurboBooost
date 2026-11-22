FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV NO_TUNNEL=1 PYTHONUNBUFFERED=1
# Render сам передаёт PORT (по умолчанию 10000); сервер читает его из окружения
CMD ["python", "server.py"]
