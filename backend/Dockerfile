FROM python:3.13-slim
WORKDIR /app
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY . .
RUN useradd --create-home app && mkdir -p /data/uploads && chown -R app:app /app /data
USER app
EXPOSE 8000
