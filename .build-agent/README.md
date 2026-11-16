# Build Agent Skills

Each subfolder under `.build-agent/skills/` is a **skill** — a reusable instruction set that the Build Agent loads automatically.

> **Note:** If the agent activated a skill earlier in the conversation, it may continue using it from context without re-reading the file.

## Folder structure

```
.build-agent/
└── skills/
    └── <skill-name>/          # One folder per skill
        ├── SKILL.md           # Required. Skill definition with YAML frontmatter and instructions.
        └── references/        # Optional. Supporting files the agent can read via load_skill_resource.
            └── example.ts     # Any file type: code samples, templates, docs, etc.
```

## SKILL.md format

```markdown
---
name: my-skill          # Unique identifier used to activate the skill
description: ...        # One-line summary shown to the agent when selecting skills
---

## When to use
Describe when the agent should apply this skill.

## Instructions
Step-by-step guidance for the agent.

## Next Steps
What to do after completing the skill.
```
