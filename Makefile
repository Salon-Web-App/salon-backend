.PHONY: up down migrate seed db-status logs test stack-up stack-down stack-logs stack-reset

up:
	docker compose up -d db redis
	docker compose run --rm migrate
	docker compose up -d

down:
	docker compose down

migrate:
	docker compose run --rm migrate

seed:
	docker compose run --rm migrate npm run db:seed

db-status:
	docker compose run --rm migrate npm run db:status

logs:
	docker compose logs -f app worker

test:
	docker compose --profile test run --rm test
	docker compose --profile test rm -sf db-test redis-test

stack-up:
	cd stack && docker compose up -d --build

stack-down:
	cd stack && docker compose down

stack-logs:
	cd stack && docker compose logs -f --no-log-prefix backend worker | npx pino-pretty

stack-reset:
	cd stack && docker compose down -v
