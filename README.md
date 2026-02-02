# Linear CLI

A command-line interface for interacting with the [Linear](https://linear.app) API.

## Installation

```bash
npm install
npm run build
npm link
```

## Authentication

### Using Personal API Key (Recommended)

Create an API key at https://linear.app/settings/api, then:

```bash
linear auth login
# Or non-interactively:
linear auth login --key <your-api-key>
```

### Using OAuth

OAuth requires registering an OAuth application in Linear (admin permissions required):

```bash
linear auth login --oauth
```

### Check Authentication Status

```bash
linear auth status
```

## Usage

### Issues

```bash
# List issues
linear issues list --team TECH
linear issues list --assignee me --state "In Progress"

# View issue details
linear issues view TECH-123

# Create an issue
linear issues create --title "Fix bug" --team TECH --priority 2

# Update an issue
linear issues update TECH-123 --state "Done"

# Add a comment
linear issues comment TECH-123 --body "This is fixed"

# Archive an issue
linear issues delete TECH-123
```

### Projects

```bash
# List projects
linear projects list

# View project details
linear projects view "Project Name"

# Create a project
linear projects create --name "Q1 Launch" --teams TECH,DESIGN

# Update a project
linear projects update "Project Name" --state completed
```

### Teams

```bash
linear teams list
linear teams view TECH
```

### Cycles

```bash
linear cycles list --team TECH
linear cycles current --team TECH
linear cycles create --team TECH --starts-at 2024-01-01 --ends-at 2024-01-14
```

### Labels

```bash
linear labels list
linear labels create --name "urgent" --color "#ff0000" --team TECH
```

### Users

```bash
linear users list
linear users me
linear users view "John Doe"
```

### Workflow States

```bash
linear states list --team TECH
```

## Global Options

All commands support these options:

- `--json` - Output as JSON (useful for scripting)
- `--no-color` - Disable colored output
- `--help` - Show help for a command

## Shell Completion

Enable bash completion:

```bash
linear --setup
source ~/.bashrc
```

To disable completion:

```bash
linear --cleanup
source ~/.bashrc
```

Completions are auto-generated from the CLI command structure using [@naerth/commander-autocomplete](https://github.com/Naerth/commander-autocomplete).

## Environment Variables

- `LINEAR_API_KEY` - Personal API key (overrides stored credentials)
- `LINEAR_ACCESS_TOKEN` - OAuth access token (overrides stored credentials)

## Configuration

Credentials are stored in `~/.config/linear-cli/config.json` with secure file permissions (600).

## AI Agent Skill

This CLI includes an agent skill that teaches AI coding assistants (Claude Code, Cursor, OpenCode, etc.) how to use the Linear CLI. It uses the [Vercel Skills](https://github.com/vercel-labs/skills) ecosystem.

### Install the Skill

```bash
# Using the linear CLI (wrapper for npx skills)
linear skill install

# Or directly with npx skills
npx skills add rolaca11/linear-cli

# Install for specific agents
linear skill install -a claude-code -a cursor

# Install globally (user directory)
linear skill install --global
```

### Manage Skills

```bash
# List installed skills
linear skill list

# Update skills
linear skill update

# Uninstall
linear skill uninstall
```

Once installed, AI agents will automatically know how to use the Linear CLI when you mention Linear issues, projects, or related tasks.

## License

MIT
