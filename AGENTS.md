# Universal workflow

When the user asks to create or substantially redesign a website, landing page, dashboard, portfolio, or React interface:

1. Call the Universal MCP tool `create_design_plan` before writing frontend code.
2. Call `get_design_rules` when the task includes meaningful visual design.
3. Treat the returned design plan as the source of truth.
4. Implement static React code unless the user explicitly requests functionality.
5. Run the project and fix compilation errors.
6. Before finishing, submit the relevant React and CSS files to `review_implementation`.
7. Address high-severity findings when practical.
