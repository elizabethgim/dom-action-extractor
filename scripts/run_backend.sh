#!/bin/bash

.PHONY: run-backend

run-backend:
	PYTHONPATH=backend backend/.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
