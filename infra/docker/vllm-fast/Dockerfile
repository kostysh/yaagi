FROM python:3.12-slim

WORKDIR /opt/yaagi

RUN useradd --system --create-home --uid 10001 yaagi

COPY infra/docker/vllm-fast/server.py /opt/yaagi/server.py

USER yaagi

EXPOSE 8000

CMD ["python", "/opt/yaagi/server.py"]
