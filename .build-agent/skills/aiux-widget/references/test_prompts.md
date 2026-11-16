# Test Prompts for `aiux-widget`

One prompt per line starting with `-`.
Add an optional `<!-- comment -->` after any prompt to explain the reasoning.

## should_trigger

Prompts that SHOULD activate this skill.

- Create an AIUX widget that shows the current user's open cases
- Add a new aix widget to the app
- I need a sys_aix_widget record for a case summary card
- Build a Lit web component that extends AIUXWidgetElement
- Make a widget for the AI portal that lists my approvals
- Clone the hello-widget and change the greeting
- Add a custom UI component to the Employee Hub
- Create a chat-compatible widget the agent can show in Otto <!-- creation first, then references/agent-tool-widget.md -->
- My widget shows up in the Widget Builder but never renders <!-- the empty component_compile_metadata symptom -->
- The component column contains the text Symbol(CallExpressionShape) <!-- the literal-only data trap -->
- Saving my widget aborts and I cannot see why <!-- id rule, or a property named data/server -->
- Why is importBoundaries wrong on my widget
- The agent tool returns data but the card stays empty <!-- input_schema key mismatch -->
- Wire my existing widget into an AI agent script tool
- Widget timed out during registration, check for syntax errors <!-- @customElement removed in the decorator form -->

## edge_cases

Prompts where the skill MIGHT trigger but behavior is ambiguous — note the expected outcome.

- Make my widget go dark when the theme changes <!-- expected: trigger, then hand off — theming inside the shadow root is owned by the aiux-widget-theming-darkmode hint -->
- Build an AIUX page that lists cases <!-- expected: do NOT trigger — a page is an SDK AIUX project, not a sys_aix_widget. See aiux-sdk-development-guide -->
- Add a widget to the Otto panel <!-- expected: trigger for creation, but Otto panel hosting and the Builder REST surface belong to aiux-widget-otto-panel -->
- Create a React component for a UI Page <!-- expected: do NOT trigger — a sys_aix_widget is not consumable by a plain React or Jelly UI Page -->
- The Widget Builder will not load my widget <!-- expected: trigger, but the likely cause is the Builder's package-manager worker failing on every path including its own default template — not the widget source. Preview instead -->
- Why does my widget return no rows for a normal user <!-- expected: trigger — GlideRecordSecure skips unreadable rows silently, so empty may mean no access rather than no data -->
- Count how many AIUX widgets exist on this instance <!-- expected: trigger a warning — every count from sys_aix_widget is a floor without the maint role -->

## should_not_trigger

Prompts that look related but belong to a different skill or no skill.

- Create a Service Portal widget <!-- sp_widget, a completely different table and framework -->
- Add a UI Builder component to my workspace <!-- sys_ux_macroponent, not sys_aix_widget -->
- Build a UI Page with a React bundle <!-- sys_ui_page; see the ui-page guides -->
- Create an AI agent that triages cases <!-- building-ai-agents; only use this skill if a widget must be displayed -->
- Set up a GenAI skill for record narration <!-- NowAssistSkillConfig; see genai-skill-tool-wiring -->
- Update the glide.ui.presence.disabled property <!-- update-system-property -->
- Run the ATF tests for my app <!-- atf-run-test -->
- Make a dashboard with reports <!-- platform reporting, not a widget -->
