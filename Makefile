.PHONY: dev restart clean build test e2e install

# Start dev server (clean restart: kill old process + clear cache)
dev:
	@echo "→ Killing existing dev server on :3000..."
	@lsof -ti :3000 | xargs kill -9 2>/dev/null || true
	@echo "→ Clearing Next.js build cache..."
	@rm -rf web/.next
	@echo "→ Starting dev server..."
	@cd web && npm run dev

# Restart dev server without clearing cache (faster, for normal restarts)
restart:
	@lsof -ti :3000 | xargs kill -9 2>/dev/null || true
	@cd web && npm run dev

# Full clean: cache + node_modules reinstall
clean:
	@rm -rf web/.next web/node_modules
	@cd web && npm install

# Production build
build:
	@cd web && npm run build

# Unit tests (web + CLI)
test:
	@cd web && npm test
	@bash cli/tests/run-all.sh

# E2E tests (requires dev server running)
e2e:
	@cd web && npx playwright test

# Install dependencies
install:
	@cd web && npm install
