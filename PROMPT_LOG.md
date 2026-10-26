# App prompt log

This log records the user-authored prompts available in this conversation for the calculator application. Entries below preserve the supplied wording, including spelling and formatting. Environment metadata, tool calls, and assistant responses are not user prompts and are excluded. No earlier app prompts or prompts used in other tools were supplied.

For future work, append each prompt in chronological order with its date, tool/model if known, exact text, and a brief outcome outside the quoted prompt. Do not reconstruct missing prompts from memory or present assistant-generated suggestions as prompts the user actually submitted. If credentials or private information appear, redact them explicitly before publishing the log.

## Prompt 1 — planning and prompt-log request

Date: 2026-10-25  
Tool: Codex desktop  
Outcome: requested a project plan, supporting documentation, and a separate prompt log.

```text
I want to plan a calculator app following this instructions. Please create a file with the plan and any documentation needed, also in another file make a log of the prompts that i used for the app.
```

## Prompt 2 — assignment requirements

Date: 2026-10-25  
Tool: Codex desktop  
Context: supplied in response to a clarification about the missing instructions.  
Outcome: established the React frontend, preferred Go backend, functional requirements, time budget, and evaluation deliverables used by the plan.

```text
Objective
Build a full-stack calculator application with a React frontend and a backend microservice. The frontend should consume the backend API to perform basic and advanced arithmetic operations. Focus on clean design, maintainable code, and testable architecture.Requirements
Functional
Operations:

    Addition, Subtraction, Multiplication, Division
    Optional: Exponentiation, Square Root, Percentage

Frontend (React):

    Intuitive UI for entering input and displaying results
    Input validation and error handling
    Responsive design (basic mobile support)

Backend (REST API):

    Expose endpoints for calculator operations
    Validate input and handle edge cases (division by zero, invalid data)
    Return results in JSON format

Non-Functional

    Clean, readable, and idiomatic code (frontend and backend)
    Unit tests covering key functionality for both layers
    Documentation: setup instructions, API usage, and design rationale
    Optional: Dockerfile for full-stack deployment

Constraints

    Frontend: React (TypeScript preferred)
    Backend: Go is perferred

Deliverables

    Git repository with frontend and backend code
    README with setup instructions, API examples, and design decisions
    Unit tests and coverage report
    Optional: Dockerfile to run frontend + backend together

Instructions

    Use any AI tooling you would like
    Spend ~2–4 hours on this assignment. Prioritize correctness, clarity, and maintainability over extra features.
    Push your solution to GitHub, GitLab, or another Git repository.
    Share the repository link with us for evaluation.
    Share any prompts that you used in your work
    Make sure your README includes:
        Setup instructions
        How to run the frontend and backend
        Examples of API calls (if using REST)
        Design decisions or assumptions
```

## Prompt 3 — expression input discussion

Date: 2026-10-25  
Tool: Codex desktop  
Outcome: discussed expression input and backend parsing for operator precedence.

```text
Ok, let's start talking about the plan for the api. I want to chat about the body that we receive in the post endpoint. How would we handle if a user want's to do multiple operations at once, let's say something like 2+3+5/4? would it be better that instead of receiving the operation and operands, we receive the string of the operation so we can parse it and also make sure to respect the order of the operations?
```

## Prompt 4 — approve expression and parenthesis support

Date: 2026-10-25  
Tool: Codex desktop  
Outcome: updated the API design, plan, and README with expression input, precedence, and nested parentheses.

```text
yes let's add support for that in the design and also support for parenthesis.
```

## Prompt 5 — implement the backend foundation

Date: 2026-10-25
Tool: Codex desktop
Outcome: implemented the Go service foundation, health endpoint, calculation placeholder, configuration, shutdown, foundation tests, and updated run documentation.

```text
ok let's continue with the implementation of the plan for the backend application. For now let's focus on the basics to run the app and then we can go in depth with the implementation of the complex logic.
```

## Prompt 6 — calculator logic design discussion

Date: 2026-10-25
Tool: Codex desktop
Outcome: discussed the tokenizer, recursive-descent parser, expression tree, and evaluator, including the Interpreter pattern and Composite tree structure.

```text
ok now let's continue with the calculator logic. Before implementing anything i want to know what the design would be, to understand the logic and if we are going to use any design patter for this.
```

## Prompt 7 — implement calculator logic

Date: 2026-10-25
Tool: Codex desktop
Outcome: implemented the calculator package and HTTP integration, added unit/fuzz tests, verified live requests, and updated documentation.

```text
ok let's continue with the implementation
```
