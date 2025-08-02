# Set the source directory and target directory
SRC_DIR := src/tests
TARGET_DIR := $(SRC_DIR)

# Find all .ts files in the source directory
TS_FILES := $(wildcard $(SRC_DIR)/*.ts)

# Filter out _gen.ts files
SRC_FILES := $(filter-out %_gen.ts, $(TS_FILES))

# Define the target files, each source file corresponding to a _gen.ts file
GEN_FILES := $(SRC_FILES:%.ts=%_gen.ts)

# Default target
all: $(GEN_FILES)

# Pattern rule for generating `src/tests/*_gen.ts` codegen fixtures
$(TARGET_DIR)/%_gen.ts: $(TARGET_DIR)/%.ts
	bun src/cli.ts $<

# Or, one-liner to do the same thing
fixtures:
	find src/tests -maxdepth 1 -name "*.ts" ! -name "*_gen.ts" | xargs bun src/cli.ts

# Clean task
clean:
	rm -f $(GEN_FILES)

.PHONY: all clean fixtures
