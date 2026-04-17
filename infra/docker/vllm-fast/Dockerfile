ARG VLLM_FAST_BASE_IMAGE=vllm/vllm-openai-rocm:gemma4
FROM ${VLLM_FAST_BASE_IMAGE}

WORKDIR /opt/yaagi

COPY infra/docker/vllm-fast/server.py /opt/yaagi/server.py

EXPOSE 8000

ENTRYPOINT ["python", "/opt/yaagi/server.py"]
