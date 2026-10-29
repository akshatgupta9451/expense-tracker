.PHONY: up down logs migrate revision test lint format

up:            ## Start all services
	docker compose up -d --build
down:          ## Stop all services
	docker compose down
logs:
	docker compose logs -f
migrate:       ## Apply DB migrations
	docker compose exec backend alembic upgrade head
revision:      ## Create migration: make revision m="message"
	docker compose exec backend alembic revision --autogenerate -m "$(m)"
test:
	docker compose exec backend pytest
	cd frontend && npm test
lint:
	cd backend && ruff check . && ruff format --check .
	cd frontend && npm run lint
format:
	cd backend && ruff format . && ruff check --fix .
	cd frontend && npm run format
